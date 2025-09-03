import { Router } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { supabase } from '../config/database';
import logger, { getCorrelationId, safe, maskPhoneNumber } from '../config/logger';
import { authenticate, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import { META_CONFIG, META_URLS, BSP_CONFIG } from '../config/meta';

const router = Router();

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || '';
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}`;
const OAUTH_SCOPES = (process.env.OAUTH_SCOPES || META_CONFIG.OAUTH_SCOPES).split(',').map(s => s.trim()).join(',');
const WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

function signState(payload: Record<string, any>): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString('base64url');
  const sig = crypto.createHmac('sha256', FACEBOOK_APP_SECRET).update(b64).digest('hex');
  return `${b64}.${sig}`;
}

function verifyState(state: string): any | null {
  const [b64, sig] = state.split('.') as [string, string];
  const expected = crypto.createHmac('sha256', FACEBOOK_APP_SECRET).update(b64).digest('hex');
  if (expected !== sig) return null;
  try {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getTokenFingerprint(token: string | null | undefined): string {
  if (!token) return 'none';
  return `${token.slice(0, 5)}...`;
}

interface GraphPhoneResponse {
  data: Array<{
    id: string;
    display_phone_number: string;
    verified_name?: string;
  }>;
}

async function writeIntegrationLog(params: {
  restaurant_id?: string;
  step: string;
  success: boolean;
  error_message?: string | null;
  details?: Record<string, any>;
}) {
  try {
    await supabase.from('whatsapp_integration_logs').insert({
      restaurant_id: params.restaurant_id || null,
      step: params.step,
      success: params.success,
      error_message: params.error_message || null,
      details: params.details || {}
    });
  } catch {}
}

async function writeConnectionLog(params: {
  restaurant_id?: string;
  waba_id?: string;
  action: string;
  details?: Record<string, any>;
}) {
  try {
    await supabase.from('whatsapp_connection_logs').insert({
      restaurant_id: params.restaurant_id || null,
      waba_id: params.waba_id || null,
      action: params.action,
      details: params.details || {}
    });
  } catch {}
}

async function getRestaurantIdFromUser(req: AuthenticatedRequest): Promise<string | null> {
  return req.user?.restaurant_id || null;
}

// 1. OAuth - Login
router.get('/oauth/login', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const restaurant_id = await getRestaurantIdFromUser(req);
  try {
    if (!FACEBOOK_APP_ID || !REDIRECT_URI) {
      res.status(500).json({ success: false, error: 'Meta OAuth não configurado' });
      return;
    }

    const state = signState({
      restaurant_id,
      ts: Date.now(),
      nonce: crypto.randomUUID(),
    });

    const authUrl = `${META_URLS.OAUTH_DIALOG}?client_id=${encodeURIComponent(FACEBOOK_APP_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(OAUTH_SCOPES)}&response_type=code`;

    logger.info({ correlationId, restaurant_id, action: 'oauth_login', step: 'oauth', status: 'ready' }, 'OAuth login URL generated');
    await writeIntegrationLog({ restaurant_id: restaurant_id || undefined, step: 'oauth', success: true, details: { action: 'login_url', auth_url_generated: true } });

    res.json({ success: true, data: { authUrl, state } });
  } catch (error: any) {
    logger.error({ correlationId, restaurant_id, action: 'oauth_login', step: 'oauth', status: 'error', error: error?.message }, 'OAuth login error');
    await writeIntegrationLog({ restaurant_id: restaurant_id || undefined, step: 'oauth', success: false, error_message: error?.message });
    res.status(500).json({ success: false, error: 'Erro ao iniciar OAuth' });
  }
});

// 1. OAuth - Callback
router.get('/oauth/callback', async (req, res) => {
  const correlationId = getCorrelationId(req as any);
  const { code, state } = req.query as Record<string, string>;

  try {
    if (!code || !state) {
      res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
      return;
    }

    const parsed = verifyState(state);
    if (!parsed?.restaurant_id) {
      res.status(400).json({ success: false, error: 'State inválido' });
      return;
    }

    const restaurant_id = parsed.restaurant_id as string;

    const url = `${META_URLS.OAUTH_ACCESS_TOKEN}?client_id=${encodeURIComponent(FACEBOOK_APP_ID)}&client_secret=${encodeURIComponent(FACEBOOK_APP_SECRET)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${encodeURIComponent(code)}`;

    const t0 = Date.now();
    const tokenResp = await axios.get(url);
    const latency_ms = Date.now() - t0;
    const tokenJson: any = tokenResp.data;

    const user_access_token = tokenJson.access_token as string;
    const expires_in = tokenJson.expires_in as number | undefined;

    // Try long-lived exchange
    let access_token = user_access_token;
    let expires_at = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    try {
      const llUrl = `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(FACEBOOK_APP_ID)}&client_secret=${encodeURIComponent(FACEBOOK_APP_SECRET)}&fb_exchange_token=${encodeURIComponent(user_access_token)}`;
      const t1 = Date.now();
      const llResp = await axios.get(llUrl);
      const latency_ms2 = Date.now() - t1;
      const llJson: any = llResp.data;
      if (llJson.access_token) {
        access_token = llJson.access_token;
        if (llJson.expires_in) {
          expires_at = new Date(Date.now() + Number(llJson.expires_in) * 1000).toISOString();
        }
        logger.info({ correlationId, restaurant_id, action: 'oauth_callback', step: 'token_exchange', status: 'success', http_status: 200, graph_endpoint: `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}/oauth/access_token`, latency_ms: latency_ms2 }, 'Exchanged to long-lived token');
      }
    } catch {}

    // Resolve client business id
    let client_business_id: string | null = null;
    try {
      const bizUrl = `${WHATSAPP_API_URL}/me?fields=id,name,businesses.limit(10){id,name}&access_token=${encodeURIComponent(access_token)}`;
      const t2 = Date.now();
      const bizResp = await axios.get(bizUrl);
      const latency_ms3 = Date.now() - t2;
      const bizJson: any = bizResp.data;
      const list = bizJson?.businesses?.data || [];
      client_business_id = list.length > 0 ? list[0].id : null;
      logger.info({ correlationId, restaurant_id, action: 'oauth_callback', step: 'waba_discovery', status: 'success', http_status: 200, graph_endpoint: `${WHATSAPP_API_URL}/me`, latency_ms: latency_ms3 }, 'Resolved business id');
    } catch (e: any) {
      await writeIntegrationLog({ restaurant_id, step: 'waba_discovery', success: false, error_message: e?.message });
    }

    // Persist oauth token
    await supabase.from('oauth_tokens').insert({
      provider: 'meta',
      business_id: client_business_id || 'unknown',
      restaurant_id,
      access_token,
      token_type: 'long_lived',
      expires_at,
      scope: OAUTH_SCOPES.split(',').map(s => s.trim()),
      is_active: true,
      metadata: { user_access_token: '[REDACTED]' }
    });

    await writeIntegrationLog({ restaurant_id, step: 'oauth', success: true, details: { business_id: client_business_id } });

    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>
<script>
  try {
    if (window.opener && typeof window.opener.postMessage === 'function') {
      window.opener.postMessage({ type: 'META_OAUTH_SUCCESS' }, '*');
    }
  } catch (e) {}
  try { window.close(); } catch (e) {}
  </script>
  <p>OAuth concluído. Você pode fechar esta janela.</p>
  </body></html>`);
  } catch (error: any) {
    const restaurant_id = (req.query && typeof req.query.state === 'string' && verifyState(req.query.state)?.restaurant_id) || undefined;
    logger.error({ correlationId, restaurant_id, action: 'oauth_callback', step: 'oauth', status: 'error', error: error?.message }, 'OAuth callback error');
    await writeIntegrationLog({ restaurant_id, step: 'oauth', success: false, error_message: error?.message });
    res.status(500).json({ success: false, error: 'Erro no callback OAuth' });
  }
});

router.get('/oauth/success', (req, res) => {
  res.send('<html><body><p>Login com Meta concluído. Você pode fechar esta janela.</p></body></html>');
});

// 2. Setup
router.post('/setup', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const { restaurant_id: bodyRestaurantId, mode, client_business_id, phone_number_id, display_phone_number, cc, phone_number } = req.body || {};
  const restaurant_id = bodyRestaurantId || req.user?.restaurant_id;
  const token_source = 'bsp_permanent';
  let graphToken = '';

  if (!restaurant_id) {
    res.status(400).json({ success: false, error: 'restaurant_id é obrigatório' });
    return;
  }

  try {
    const tokenRow = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('provider', 'meta')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const oauthToken = tokenRow.data;
    graphToken = BSP_CONFIG.PERMANENT_TOKEN || '';
    const tokenFingerprint = getTokenFingerprint(graphToken);

    if (!graphToken) {
      logger.error({ correlationId, restaurant_id, action: 'setup', step: 'init', status: 'error', error: 'BSP_PERMANENT_TOKEN is missing.' });
      res.status(400).json({ status: "error", action: "invalid_bsp_token", message: 'BSP permanent token is not configured.' });
      return;
    }

    let resolved_business_id: string | null = client_business_id || oauthToken?.business_id || null;
    let waba_id: string | null = null;
    let resolved_phone_number_id: string | null = phone_number_id || null;
    let resolved_display_phone_number: string | null = display_phone_number || null;
    let connection_status: 'active' | 'pending_verification' = 'active';

    // Discover WABA via business id
    if (!resolved_business_id && mode === 'auto') {
      resolved_business_id = process.env.BSP_BUSINESS_ID || null;
    }

    if (resolved_business_id) {
      const url = `${WHATSAPP_API_URL}/${resolved_business_id}/owned_whatsapp_business_accounts`;
      const t0 = Date.now();
      try {
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'waba_discovery', status: 'pending', graph_endpoint: url, token_source, token_fingerprint: tokenFingerprint }, 'Attempting WABA discovery');
        const resp = await axios.get(url, { params: { access_token: graphToken } });
        const latency_ms = Date.now() - t0;
        const j: any = resp.data;
        const list = j?.data || [];
        if (list.length > 0) waba_id = list[0].id;
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'waba_discovery', status: 'success', http_status: 200, graph_endpoint: url, latency_ms }, 'WABA discovered');
        await writeIntegrationLog({ restaurant_id, step: 'waba_discovery', success: true, details: { graph_endpoint: url, http_status: 200, waba_id } });
      } catch (e: any) {
        const http_status = e?.response?.status || 500;
        const error_message = e?.response?.data?.error?.message || e.message;
        await writeIntegrationLog({ restaurant_id, step: 'waba_discovery', success: false, error_message, details: { graph_endpoint: url, http_status } });
        throw e;
      }
    }

    // Step 2: Find or Claim Phone Number
    if (waba_id) {
      const url = `${WHATSAPP_API_URL}/${waba_id}/phone_numbers`;
      logger.info({ correlationId, restaurant_id, action: 'setup', step: 'phone_discovery', status: 'pending', graph_endpoint: url, token_source, token_fingerprint: tokenFingerprint }, 'Attempting phone number discovery');
      const resp = await axios.get<GraphPhoneResponse>(url, { params: { access_token: graphToken } });
      const phoneList = resp.data?.data || [];
      const verifiedNumber = phoneList.find((p: any) => p.verified_name);

      if (verifiedNumber) {
        resolved_phone_number_id = verifiedNumber.id;
        resolved_display_phone_number = verifiedNumber.display_phone_number;
        connection_status = 'active';
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'phone_discovery', status: 'success' }, 'Found existing verified phone number');
      } else if (cc && phone_number) {
        // No verified number found, try to claim one
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'phone_claim', status: 'pending', waba_id }, 'No verified number found, attempting to claim a new one.');
        const claimUrl = `${WHATSAPP_API_URL}/${waba_id}/phone_numbers`;
        await axios.post(claimUrl, { cc, phone_number, method: 'sms' }, { params: { access_token: graphToken }, headers: { 'Content-Type': 'application/json' } });
        
        await writeIntegrationLog({ restaurant_id, step: 'phone_registration', success: true, details: { graph_endpoint: claimUrl, phone_number: maskPhoneNumber(`${cc}${phone_number}`) } });
        
        // Re-fetch numbers to get the ID of the new one
        const refetchResp = await axios.get<GraphPhoneResponse>(url, { params: { access_token: graphToken } });
        const newList = refetchResp.data?.data || [];
        const newNumber = newList.find((p: any) => p.display_phone_number.endsWith(phone_number));
        
        if (newNumber) {
            resolved_phone_number_id = newNumber.id;
            resolved_display_phone_number = newNumber.display_phone_number;
        }

        connection_status = 'pending_verification';
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'phone_claim', status: 'success', waba_id, phone_number_id: resolved_phone_number_id }, 'Phone number claimed, verification pending.');
      } else {
        logger.warn({ correlationId, restaurant_id, action: 'setup', step: 'phone_discovery', status: 'unclaimed' }, 'No phone numbers found and no new number provided to claim.');
        res.status(200).json({ success: true, data: { status: 'unclaimed', action: 'claim_required', waba_id } });
        return;
      }
    }


    // Subscribe app to WABA messages
    if (waba_id) {
      const url = `${WHATSAPP_API_URL}/${waba_id}/subscribed_apps`;
      const t2 = Date.now();
      try {
        const request_body = { subscribed_fields: ['messages'] };
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'subscribe', status: 'pending', graph_endpoint: url, token_source, token_fingerprint: tokenFingerprint, request_body }, 'Attempting to subscribe app');
        const resp = await axios.post(url, { ...request_body, access_token: graphToken }, { headers: { 'Content-Type': 'application/json' } });
        const latency_ms = Date.now() - t2;
        const json: any = resp.data ?? {};
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'subscribe', status: 'success', http_status: 200, graph_endpoint: url, latency_ms }, 'Subscribe app result');
        await writeIntegrationLog({ restaurant_id, step: 'subscribe', success: true, details: { graph_endpoint: url, http_status: 200 } });
      } catch (e: any) {
        const http_status = e?.response?.status || 500;
        const error_message = e?.response?.data?.error?.message || e.message;
        await writeIntegrationLog({ restaurant_id, step: 'subscribe', success: false, error_message, details: { graph_endpoint: url, http_status } });
        throw e;
      }
    }

    const webhook_url = `${API_BASE_URL}/api/whatsapp/webhook`;

    // Persist webhook record idempotently
    const existingWebhook = await supabase
      .from('whatsapp_webhooks')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();
    if (existingWebhook.data?.id) {
      await supabase.from('whatsapp_webhooks').update({ webhook_url, verify_token: WEBHOOK_VERIFY_TOKEN, is_active: true, last_triggered: null }).eq('id', existingWebhook.data.id);
    } else {
      await supabase.from('whatsapp_webhooks').insert({ restaurant_id, webhook_url, verify_token: WEBHOOK_VERIFY_TOKEN, is_active: true });
    }

    // Upsert whatsapp_business_integrations by restaurant_id
    const current = await supabase
      .from('whatsapp_business_integrations')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    const insertOrUpdate = {
      restaurant_id,
      business_account_id: resolved_business_id || waba_id || 'unknown',
      phone_number_id: resolved_phone_number_id,
      phone_number: resolved_display_phone_number,
      webhook_url,
      webhook_verify_token: WEBHOOK_VERIFY_TOKEN,
      connection_status,
      metadata: { mode, waba_id }
    } as any;

    if (current.data) {
      await supabase.from('whatsapp_business_integrations').update(insertOrUpdate).eq('id', current.data.id);
    } else {
      await supabase.from('whatsapp_business_integrations').insert(insertOrUpdate);
    }

    // Update signup state
    const signupState = await supabase
      .from('whatsapp_signup_states')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    const signupPayload: any = {
      restaurant_id,
      status: connection_status === 'active' ? 'completed' : 'pending_verification',
      waba_id: waba_id,
      phone_number_id: resolved_phone_number_id,
      phone_number: resolved_display_phone_number,
      business_id: resolved_business_id
    };

    if (signupState.data?.id) {
      await supabase.from('whatsapp_signup_states').update(signupPayload).eq('id', signupState.data.id);
    }

    res.json({ success: true, data: { restaurant_id, business_id: resolved_business_id, waba_id, phone_number_id: resolved_phone_number_id, display_phone_number: resolved_display_phone_number, status: connection_status } });
  } catch (error: any) {
    const errMsg = error?.response?.data?.error?.message || error?.message || 'Unknown setup error'
    const status = error?.response?.status || 500
    const graphError = error?.response?.data?.error || null;

    // If unclaimed hint appears here, respond with claim_required
    if (/not\s*claimed|not\s*found/i.test(String(errMsg))) {
      res.status(200).json({ success: true, data: { status: 'unclaimed', action: 'claim_required' } });
      return;
    }
    // Handle invalid OAuth token error specifically
    if (graphError && graphError.code === 190) { // Graph API error code for invalid token
      const errorDetails = {
        token_source,
        token_fingerprint: getTokenFingerprint(graphToken),
        original_error: {
          message: graphError.message,
          code: graphError.code,
          type: graphError.type,
          fbtrace_id: graphError.fbtrace_id
        }
      };
      logger.error({ correlationId, restaurant_id, action: 'setup', step: 'complete_flow', status: 'error', error: 'Invalid OAuth access token', details: errorDetails }, 'Setup error: Invalid OAuth access token');
      await writeIntegrationLog({ restaurant_id, step: 'complete_flow', success: false, error_message: 'Invalid OAuth access token', details: { ...errorDetails, http_status: status } });
      res.status(401).json({ status: "error", action: "retry_with_bsp", message: "Invalid OAuth access token", error_details: errorDetails.original_error });
      return;
    }
    logger.error({ correlationId, restaurant_id, action: 'setup', step: 'complete_flow', status: 'error', error: errMsg, http_status: status, details: { ...error?.response?.data, graphError } }, 'Setup error');
    await writeIntegrationLog({ restaurant_id, step: 'complete_flow', success: false, error_message: errMsg, details: { http_status: status } });
    res.status(500).json({ success: false, error: errMsg });
  }
});

// Claim phone number
router.post('/claim', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const { restaurant_id: bodyRestaurantId, cc, phone_number, method = 'sms' } = req.body || {};
  const restaurant_id = bodyRestaurantId || req.user?.restaurant_id;

  if (!restaurant_id || !cc || !phone_number) {
    res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
    return;
  }

  try {
    // discover business + waba again
    const tokenRow = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('provider', 'meta')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const oauthToken = tokenRow.data;
    const graphToken = BSP_CONFIG.PERMANENT_TOKEN || '';

    // Fetch WABA via business id from integration row if present
    let waba_id: string | null = null;
    const { data: integData } = await supabase
      .from('whatsapp_business_integrations')
      .select('metadata')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();
    const metadata: any = integData ? (integData as any).metadata : null;
    if (metadata && typeof metadata === 'object' && metadata.waba_id) {
      waba_id = String(metadata.waba_id);
    } else if (oauthToken?.business_id) {
      const urlW = `${WHATSAPP_API_URL}/${oauthToken.business_id}/owned_whatsapp_business_accounts`;
      const r = await axios.get<{ data: Array<{ id: string }> }>(urlW, { params: { access_token: graphToken } });
      waba_id = r.data?.data?.[0]?.id || null;
    }

    if (!waba_id) {
      res.status(400).json({ success: false, error: 'WABA não encontrada para claim' });
      return;
    }

    const url = `${WHATSAPP_API_URL}/${waba_id}/phone_numbers`;
    const t0 = Date.now();
    try {
      const resp = await axios.post(url, { cc, phone_number, method }, { params: { access_token: graphToken }, headers: { 'Content-Type': 'application/json' } });
      const latency_ms = Date.now() - t0;
      await writeIntegrationLog({ restaurant_id, step: 'phone_registration', success: true, details: { graph_endpoint: url, http_status: resp.status, phone_number: maskPhoneNumber(`${cc}${phone_number}`) } as any });
      res.json({ success: true, data: { status: 'verification_sent', waba_id } });
    } catch (e: any) {
      const http_status = e?.response?.status || 500;
      const error_message = e?.response?.data?.error?.message || e.message;
      await writeIntegrationLog({ restaurant_id, step: 'phone_registration', success: false, error_message, details: { graph_endpoint: url, http_status } });
      res.status(500).json({ success: false, error: error_message });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Erro no claim' });
  }
});

// 3. Verify Number
router.post('/verify-number', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const { restaurant_id: bodyRestaurantId, code } = req.body || {};
  const restaurant_id = bodyRestaurantId || req.user?.restaurant_id;

  if (!restaurant_id || !code) {
    res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
    return;
  }

  try {
    const integ = await supabase
      .from('whatsapp_business_integrations')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    const phone_number_id = integ.data?.phone_number_id;
    if (!phone_number_id) {
      res.status(400).json({ success: false, error: 'Telefone não configurado' });
      return;
    }

    const url = `${WHATSAPP_API_URL}/${phone_number_id}/verify_code`;
    const t0 = Date.now();
    const resp = await axios.post(url, { code, access_token: BSP_CONFIG.PERMANENT_TOKEN }, { headers: { 'Content-Type': 'application/json' } });
    const latency_ms = Date.now() - t0;

    logger.info({ correlationId, restaurant_id, action: 'verify_number', step: 'phone_verification', status: 'success', http_status: resp.status, graph_endpoint: url, latency_ms }, 'Verify number result');
    await writeConnectionLog({ restaurant_id, action: 'verify_number', details: { http_status: resp.status } });

    await supabase.from('whatsapp_business_integrations').update({ connection_status: 'active' }).eq('restaurant_id', restaurant_id);
    await supabase.from('whatsapp_signup_states').update({ status: 'completed', verification_status: 'verified' }).eq('restaurant_id', restaurant_id);

    res.json({ success: true, data: { status: 'completed' } });
  } catch (error: any) {
    logger.error({ correlationId, restaurant_id, action: 'verify_number', step: 'phone_verification', status: 'error', error: error?.message }, 'Verify number error');
    await writeIntegrationLog({ restaurant_id, step: 'phone_verification', success: false, error_message: error?.message });
    res.status(500).json({ success: false, error: 'Erro ao verificar número' });
  }
});

// 4. Webhook - Verification (GET)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).send('Forbidden');
});

// 4. Webhook - Events (POST)
router.post('/webhook', async (req, res) => {
  const correlationId = getCorrelationId(req as any);
  try {
    const body = req.body as any;

    if (!body?.entry) {
      res.status(200).json({ received: true });
      return;
    }

    for (const entry of body.entry) {
      const waba_id = entry.id;
      for (const change of entry.changes || []) {
        const field = change.field;
        const value = change.value || {};

        if (field === 'messages' && value.messages && Array.isArray(value.messages)) {
          const metadata = value.metadata || {};
          const phone_number_id = metadata.phone_number_id;
          // Find restaurant by phone_number_id
          const integ = await supabase
            .from('whatsapp_business_integrations')
            .select('restaurant_id, phone_number')
            .eq('phone_number_id', phone_number_id)
            .maybeSingle();

          const restaurant_id = integ.data?.restaurant_id;
          const our_phone = integ.data?.phone_number;

          await writeConnectionLog({ restaurant_id: restaurant_id || undefined, waba_id, action: 'messages', details: { count: value.messages.length } });

          if (!restaurant_id) continue;

          for (const msg of value.messages) {
            const wa_id = (value.contacts && value.contacts[0]?.wa_id) || msg.from;
            const contact_name = (value.contacts && value.contacts[0]?.profile?.name) || null;

            // Upsert contact
            const existingContact = await supabase
              .from('whatsapp_contacts')
              .select('id')
              .eq('restaurant_id', restaurant_id)
              .eq('phone_number', wa_id)
              .maybeSingle();

            let contact_id = existingContact.data?.id;
            if (!contact_id) {
              const ins = await supabase
                .from('whatsapp_contacts')
                .insert({ restaurant_id, phone_number: wa_id, name: contact_name, status: 'active', last_message_at: new Date().toISOString() })
                .select('id')
                .single();
              contact_id = ins.data?.id;
            } else {
              await supabase.from('whatsapp_contacts').update({ name: contact_name, last_message_at: new Date().toISOString() }).eq('id', contact_id);
            }

            // Upsert conversation (unique by conversation_id)
            const conversation_id_str = `wa_${restaurant_id}_${wa_id}`;
            const existingConv = await supabase
              .from('whatsapp_conversations')
              .select('id')
              .eq('conversation_id', conversation_id_str)
              .maybeSingle();

            let conversation_id = existingConv.data?.id;
            if (!conversation_id) {
              const insConv = await supabase
                .from('whatsapp_conversations')
                .insert({ restaurant_id, contact_id, conversation_id: conversation_id_str, status: 'open', last_message_at: new Date().toISOString() })
                .select('id')
                .single();
              conversation_id = insConv.data?.id;
            } else {
              await supabase.from('whatsapp_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation_id);
            }

            // Idempotency: skip if message_id exists
            const existsMsg = await supabase
              .from('whatsapp_messages')
              .select('id')
              .eq('message_id', msg.id)
              .maybeSingle();
            if (existsMsg.data?.id) continue;

            const type = msg.type as string;
            const content = msg[type] ? msg[type] : { body: undefined };

            await supabase.from('whatsapp_messages').insert({
              restaurant_id,
              message_id: msg.id,
              to_phone: our_phone || metadata.display_phone_number || '',
              from_phone: wa_id,
              message_type: type,
              content,
              status: 'delivered',
              direction: 'inbound',
              conversation_id: conversation_id_str,
              metadata: { timestamp: msg.timestamp }
            });
          }
        } else if (field === 'message_template_status_update') {
          const t = value?.message_templates || [];
          for (const tmpl of t) {
            const name = tmpl.name;
            const status = tmpl.status;
            await supabase.from('whatsapp_templates').update({ status, rejection_reason: tmpl?.rejection_reason || null }).eq('template_name', name);
          }
        } else if (field === 'account_update' || field === 'phone_number_name_update') {
          await writeConnectionLog({ action: field, waba_id, details: value });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    logger.error({ action: 'webhook', step: 'events', status: 'error', error: error?.message }, 'Webhook error');
    res.status(200).json({ received: true });
  }
});

// 5. Send Message
router.post('/send', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const { restaurant_id: bodyRestaurantId, to, type = 'text', message } = req.body || {};
  const restaurant_id = bodyRestaurantId || req.user?.restaurant_id;
  if (!restaurant_id || !to || !message) {
    res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
    return;
  }

  try {
    const integ = await supabase
      .from('whatsapp_business_integrations')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    const phone_number_id = integ.data?.phone_number_id;
    const from_phone = integ.data?.phone_number || '';

    if (!phone_number_id) {
      res.status(400).json({ success: false, error: 'Integração WhatsApp não configurada' });
      return;
    }

    const payload: any = {
      messaging_product: 'whatsapp',
      to,
      type
    };
    if (type === 'text') {
      payload.text = { body: message };
    } else {
      payload[type] = message;
    }

    const url = `${WHATSAPP_API_URL}/${phone_number_id}/messages`;
    const t0 = Date.now();
    const resp = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${BSP_CONFIG.PERMANENT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const latency_ms = Date.now() - t0;
    const json: any = resp.data;

    logger.info({ correlationId, restaurant_id, action: 'send_message', step: 'messages', status: 'success', http_status: resp.status, graph_endpoint: url, latency_ms, details: safe({ to, type }) }, 'Message send result');

    const graphMessageId = json?.messages?.[0]?.id || json?.messages?.id || null;

    await supabase.from('whatsapp_messages').insert({
      restaurant_id,
      message_id: graphMessageId || crypto.randomUUID(),
      to_phone: to,
      from_phone,
      message_type: type,
      content: type === 'text' ? { body: message } : message,
      status: 'sent',
      direction: 'outbound',
      conversation_id: `wa_${restaurant_id}_${to}`,
      metadata: { request_id: correlationId }
    });

    res.json({ success: true, data: { message_id: graphMessageId } });
  } catch (error: any) {
    logger.error({ correlationId, action: 'send_message', step: 'messages', status: 'error', error: error?.message }, 'Send message error');
    res.status(500).json({ success: false, error: 'Erro ao enviar mensagem' });
  }
});

// Status endpoint
router.get('/status', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const restaurant_id = req.user?.restaurant_id;
  const { data } = await supabase
    .from('whatsapp_business_integrations')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .maybeSingle();

  const status = data?.verification_status === 'verified' ? 'active' : (data ? 'pending_verification' : 'not_connected');
  res.json({ success: true, data: { status, integration: data } });
});

// Conversations
router.get('/conversations', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const restaurant_id = req.user?.restaurant_id;
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .order('last_message_at', { ascending: false });
  if (error) {
    res.status(500).json({ success: false, error: 'Erro ao listar conversas' });
    return;
  }
  res.json({ success: true, data });
});

// Messages by conversation
router.get('/messages', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const restaurant_id = req.user?.restaurant_id;
  const { conversation_id } = req.query as Record<string, string>;
  if (!conversation_id) {
    res.status(400).json({ success: false, error: 'conversation_id é obrigatório' });
    return;
  }
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('restaurant_id', restaurant_id)
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true });
  if (error) {
    res.status(500).json({ success: false, error: 'Erro ao listar mensagens' });
    return;
  }
  res.json({ success: true, data });
});

export default router; 