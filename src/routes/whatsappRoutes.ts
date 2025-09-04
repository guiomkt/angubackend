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
    quality_rating?: string;
  }>;
}

interface PhoneNumberInfo {
  phone_number_id: string;
  display_phone_number: string;
  status: 'active' | 'pending';
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
  logger.info({ correlationId, action: 'oauth_login.start', restaurant_id }, 'OAuth login started');
  try {
    if (!FACEBOOK_APP_ID || !REDIRECT_URI) {
      logger.error({ correlationId, action: 'oauth_login.error', restaurant_id }, 'Meta OAuth not configured');
      res.status(500).json({ success: false, error: 'Meta OAuth não configurado' });
      return;
    }

    const state = signState({
      restaurant_id,
      ts: Date.now(),
      nonce: crypto.randomUUID(),
    });

    const authUrl = `${META_URLS.OAUTH_DIALOG}?client_id=${encodeURIComponent(FACEBOOK_APP_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(OAUTH_SCOPES)}&response_type=code`;

    logger.info({ correlationId, action: 'oauth_login.url_generated', restaurant_id, authUrl }, 'OAuth login URL generated');
    await writeIntegrationLog({ restaurant_id: restaurant_id || undefined, step: 'oauth', success: true, details: { action: 'login_url', auth_url_generated: true } });

    res.json({ success: true, data: { authUrl, state } });
  } catch (error: any) {
    logger.error({ correlationId, action: 'oauth_login.error', restaurant_id, error: error?.message }, 'OAuth login error');
    await writeIntegrationLog({ restaurant_id: restaurant_id || undefined, step: 'oauth', success: false, error_message: error?.message });
    res.status(500).json({ success: false, error: 'Erro ao iniciar OAuth' });
  }
});

// 1. OAuth - Callback
router.get('/oauth/callback', async (req, res) => {
  const correlationId = getCorrelationId(req as any);
  const { code, state } = req.query as Record<string, string>;
  logger.info({ correlationId, action: 'oauth_callback.start', code_present: !!code, state_present: !!state }, 'OAuth callback started');

  const frontendUrl = process.env.FRONTEND_URL || 'https://www.angu.ai';
  const successRedirectUrl = `${frontendUrl}/whatsapp-oauth-success`;
  
  try {
    if (!code || !state) {
      logger.error({ correlationId, action: 'oauth_callback.error', reason: 'missing_params' }, 'Missing code or state parameters');
      res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
      return;
    }

    const parsed = verifyState(state);
    if (!parsed?.restaurant_id || !parsed.nonce) {
      logger.error({ correlationId, action: 'oauth_callback.error', reason: 'invalid_state' }, 'Invalid state parameter');
      res.status(400).json({ success: false, error: 'State inválido' });
      return;
    }

    const { restaurant_id, nonce } = parsed as { restaurant_id: string, nonce: string };
    logger.info({ correlationId, action: 'oauth_callback.code_state_parsed', restaurant_id, nonce_present: !!nonce }, 'Code and state parsed');

    // Check for duplicate nonce
    const { data: existingToken, error: nonceError } = await supabase
      .from('oauth_tokens')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .eq('metadata->>nonce', nonce)
      .maybeSingle();

    if (nonceError || existingToken) {
      logger.warn({ correlationId, restaurant_id, nonce, action: 'oauth_callback', step: 'nonce_check', status: 'duplicate' }, 'duplicate_oauth_callback');
      logger.info({ correlationId, action: 'oauth_callback.redirecting', status: 'duplicate' }, 'Redirecting for duplicate nonce');
      return res.redirect(successRedirectUrl);
    }

    const url = `${META_URLS.OAUTH_ACCESS_TOKEN}?client_id=${encodeURIComponent(FACEBOOK_APP_ID)}&client_secret=${encodeURIComponent(FACEBOOK_APP_SECRET)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${encodeURIComponent(code)}`;

    logger.info({ correlationId, action: 'oauth_callback.token_exchange', restaurant_id }, '🔵 Starting token exchange');
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
    } catch (e) {
      logger.warn({ correlationId, restaurant_id, action: 'oauth_callback', step: 'token_exchange', status: 'warn', error: (e as any)?.message }, 'Failed to exchange for long-lived token, using short-lived token.');
    }

    // Persist oauth token
    logger.info({ correlationId, action: 'oauth_callback.token_persist', restaurant_id }, '🔵 Persisting token to database');
    const { data: tokenData, error: tokenInsertError } = await supabase.from('oauth_tokens').insert({
      provider: 'meta',
      business_id: 'unknown', // Will be resolved in /setup
      restaurant_id,
      access_token,
      token_type: 'long_lived',
      expires_at,
      scope: OAUTH_SCOPES.split(',').map(s => s.trim()),
      is_active: true,
      metadata: { user_access_token: '[REDACTED]', nonce }
    }).select('id');

    if (tokenInsertError) {
      logger.error({ correlationId, action: 'oauth_callback.token_persist.error', restaurant_id, error: tokenInsertError.message }, 'Failed to persist OAuth token');
    } else {
      logger.info({ correlationId, action: 'oauth_callback.token_persist.success', restaurant_id, token_id: tokenData[0]?.id }, 'OAuth token persisted successfully');
    }

    await writeIntegrationLog({ restaurant_id, step: 'oauth_callback', success: true });

    // Send response to close the popup and notify the opener
    logger.info({ correlationId, action: 'oauth_callback.redirecting', restaurant_id, url: successRedirectUrl }, 'Redirecting to frontend callback page');
    res.redirect(successRedirectUrl);

  } catch (error: any) {
    const restaurant_id = (req.query && typeof req.query.state === 'string' && verifyState(req.query.state)?.restaurant_id) || undefined;
    logger.error({ correlationId, restaurant_id, action: 'oauth_callback.error', step: 'exception', error: error?.message }, 'OAuth callback error');
    await writeIntegrationLog({ restaurant_id, step: 'oauth_callback', success: false, error_message: error?.message });
    res.status(500).json({ success: false, error: 'Erro no callback OAuth' });
  }
});

router.get('/oauth/success', (req, res) => {
  res.send('<html><body><p>Login com Meta concluído. Você pode fechar esta janela.</p></body></html>');
});

// 2. Setup
router.post('/setup', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  logger.info({ correlationId, action: 'setup.start', restaurant_id: req.user?.restaurant_id }, 'Setup started');
  const { restaurant_id: bodyRestaurantId, mode, client_business_id, phone_number_id, display_phone_number, cc, phone_number } = req.body || {};
  const restaurant_id = bodyRestaurantId || req.user?.restaurant_id;
  const token_source = 'bsp_permanent';
  let graphToken = '';

  // VERY CLEAR LOG AT START - should appear immediately when endpoint is called
  logger.info({
    action: 'setup.start',
    correlationId,
    restaurant_id,
    source: 'setup_endpoint_entry',
    timestamp: new Date().toISOString(),
    body_excerpt: {
      mode,
      restaurant_id_in_body: !!bodyRestaurantId,
      restaurant_id_in_auth: !!req.user?.restaurant_id
    }
  }, '🔴 SETUP ENDPOINT CALLED - should see this if frontend calls /api/whatsapp/setup 🔴');

  // Log the request payload to ensure we're being called correctly
  logger.info({ 
    action: 'setup.request', 
    correlationId, 
    restaurant_id, 
    payload: { 
      mode, 
      client_business_id, 
      phone_number_id: phone_number_id ? `${phone_number_id.substring(0, 5)}...` : null,
      display_phone_number: display_phone_number ? maskPhoneNumber(display_phone_number) : null,
      cc, 
      phone_number: phone_number ? maskPhoneNumber(phone_number) : null
    }
  }, 'Setup request received');

  if (!restaurant_id) {
    logger.error({ action: 'setup.error', correlationId, error: 'missing_restaurant_id' }, 'Missing restaurant_id in setup request');
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

    // [VALIDATION] Ensure BSP_BUSINESS_ID is not misconfigured as the App ID.
    if (BSP_CONFIG.BSP_BUSINESS_ID === FACEBOOK_APP_ID) {
      logger.error({ correlationId, restaurant_id, action: 'setup', step: 'init', status: 'error', error: 'BSP_BUSINESS_ID is misconfigured as FACEBOOK_APP_ID.' });
      res.status(400).json({ status: "error", message: "BSP_BUSINESS_ID misconfigured" });
      return;
    }

    const resolved_business_id: string | null = client_business_id || oauthToken?.business_id || null;
    // The business_id from OAuth is for identifying the client, but for WABA discovery, we must use our BSP Business ID.
    const discovery_business_id = BSP_CONFIG.BSP_BUSINESS_ID;
    let waba_id: string | null = null;
    let resolved_phone_number_id: string | null = phone_number_id || null;
    let resolved_display_phone_number: string | null = display_phone_number || null;
    let connection_status: 'active' | 'pending_verification' = 'active';

    // Discover WABA via our BSP Business ID
    if (!discovery_business_id) {
        logger.error({ correlationId, restaurant_id, action: 'setup', step: 'init', status: 'error', error: 'BSP_BUSINESS_ID is not configured.' });
        res.status(500).json({ status: "error", action: "invalid_bsp_token", message: 'BSP Business ID is not configured on the server.' });
        return;
    }

    const url = `${WHATSAPP_API_URL}/${discovery_business_id}/owned_whatsapp_business_accounts`;
    const t0 = Date.now();
    try {
      logger.info({ correlationId, restaurant_id, action: 'setup', step: 'waba_discovery', status: 'pending', graph_endpoint: url, token_source, token_fingerprint: tokenFingerprint, discovery_business_id }, 'Attempting WABA discovery');
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
      logger.error({ correlationId, restaurant_id, action: 'setup', step: 'waba_discovery', status: 'error', error: error_message, http_status }, 'WABA discovery failed');
      await writeIntegrationLog({ restaurant_id, step: 'waba_discovery', success: false, error_message, details: { graph_endpoint: url, http_status, discovery_business_id } });
      throw e;
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
        const newNumber = newList.find((p: any) => !p.verified_name && p.display_phone_number.endsWith(phone_number));
        
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
        logger.error({ correlationId, restaurant_id, action: 'setup', step: 'subscribe', status: 'error', error: error_message, http_status }, 'Subscription failed');
        await writeIntegrationLog({ restaurant_id, step: 'subscribe', success: false, error_message, details: { graph_endpoint: url, http_status } });
        throw e;
      }
    }

    // Step 3: Configure Webhook for the App
    const webhook_url = `${API_BASE_URL}/api/whatsapp/webhook`;
    try {
      const appId = FACEBOOK_APP_ID;
      const appSecret = FACEBOOK_APP_SECRET;
      const appAccessToken = `${appId}|${appSecret}`;
      const url = `${WHATSAPP_API_URL}/${appId}/subscriptions`;
      const subscribed_fields = ["messages", "message_template_status_update", "account_update"];
      
      logger.info({ correlationId, restaurant_id, action: 'setup', step: 'webhook_config', status: 'pending', graph_endpoint: url, appId }, 'Configuring app webhook with App Access Token');
      
      await axios.post(url, {
        object: 'whatsapp_business_account',
        callback_url: webhook_url,
        verify_token: WEBHOOK_VERIFY_TOKEN,
        fields: subscribed_fields.join(','),
        include_values: true,
        access_token: appAccessToken
      }, { headers: { 'Content-Type': 'application/json' } });

      logger.info({ correlationId, restaurant_id, action: 'setup', step: 'webhook_config', status: 'success' }, 'Webhook configured successfully');
      await writeIntegrationLog({ restaurant_id, step: 'webhook_config', success: true, details: { webhook_url, subscribed_fields } });
    } catch (e: any) {
      const http_status = e?.response?.status || 500;
      const error_message = e?.response?.data?.error?.message || e.message;
      // It's possible the webhook is already configured, so we can treat some errors as non-fatal.
      if (error_message.includes("already subscribed")) {
        logger.warn({ correlationId, restaurant_id, action: 'setup', step: 'webhook_config', status: 'already_configured' }, 'Webhook was already configured.');
        await writeIntegrationLog({ restaurant_id, step: 'webhook_config', success: true, details: { note: 'already_configured' } });
      } else {
        logger.error({ correlationId, restaurant_id, action: 'setup', step: 'webhook_config', status: 'error', error: error_message, http_status }, 'Webhook configuration failed');
        await writeIntegrationLog({ restaurant_id, step: 'webhook_config', success: false, error_message, details: { http_status } });
        throw e;
      }
    }


    // Persist webhook record idempotently
    try {
      logger.info({ correlationId, restaurant_id, action: 'setup', step: 'webhook_persist', status: 'pending' }, 'Persisting webhook configuration');
      const existingWebhook = await supabase
        .from('whatsapp_webhooks')
        .select('id')
        .eq('restaurant_id', restaurant_id)
        .maybeSingle();
      if (existingWebhook.data?.id) {
        await supabase.from('whatsapp_webhooks').update({ webhook_url, verify_token: WEBHOOK_VERIFY_TOKEN, is_active: true, last_triggered: null }).eq('id', existingWebhook.data.id);
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'webhook_persist', status: 'updated', webhook_id: existingWebhook.data.id }, 'Webhook record updated');
      } else {
        const insertResult = await supabase.from('whatsapp_webhooks').insert({ restaurant_id, webhook_url, verify_token: WEBHOOK_VERIFY_TOKEN, is_active: true }).select('id');
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'webhook_persist', status: 'created', webhook_id: insertResult.data?.[0]?.id }, 'Webhook record created');
      }
    } catch (e: any) {
      logger.error({ correlationId, restaurant_id, action: 'setup', step: 'webhook_persist', status: 'error', error: e.message }, 'Failed to persist webhook record');
    }

    // Ensure connection status is active when we have a phone number resolved and webhook configured
    if (resolved_phone_number_id) {
      connection_status = 'active';
    }

    // Upsert whatsapp_business_integrations by restaurant_id
    logger.info({ correlationId, restaurant_id, action: 'setup', step: 'integration_persist', status: 'pending' }, 'Beginning integration persistence');
    try {
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

      logger.info({ 
        correlationId, 
        action: 'setup.persist.attempt', 
        restaurant_id, 
        payload: {
          restaurant_id,
          business_account_id: insertOrUpdate.business_account_id,
          phone_number_id: insertOrUpdate.phone_number_id ? `${insertOrUpdate.phone_number_id.substring(0, 5)}...` : null,
          phone_number: insertOrUpdate.phone_number ? maskPhoneNumber(insertOrUpdate.phone_number) : null,
          connection_status: insertOrUpdate.connection_status
        }
      }, 'Attempting to persist whatsapp_business_integrations');

      let persistResult;
      if (current.data) {
        const { data, error: upErr } = await supabase
          .from('whatsapp_business_integrations')
          .update(insertOrUpdate)
          .eq('id', current.data.id)
          .select('id');
        if (upErr) {
          logger.error({ 
            correlationId,
            action: 'setup.persist.error', 
            restaurant_id, 
            error: upErr.message, 
            details: upErr
          }, 'Failed to update integration row');
          throw upErr;
        }
        persistResult = data?.[0]?.id || current.data.id;
        logger.info({ correlationId, action: 'setup.persist.updated', restaurant_id, integration_id: persistResult }, 'Integration row updated successfully');
      } else {
        const { data, error: insErr } = await supabase
          .from('whatsapp_business_integrations')
          .insert(insertOrUpdate)
          .select('id');
        if (insErr) {
          logger.error({ 
            correlationId,
            action: 'setup.persist.error', 
            restaurant_id, 
            error: insErr.message,
            details: insErr
          }, 'Failed to insert integration row');
          throw insErr;
        }
        persistResult = data?.[0]?.id;
        logger.info({ correlationId, action: 'setup.persist.inserted', restaurant_id, integration_id: persistResult }, 'Integration row inserted successfully');
      }
      logger.info({ correlationId, action: 'setup.persist.success', restaurant_id, integration_id: persistResult }, 'Integration row persisted');
    } catch (persistError: any) {
      // Surface persistence failures
      logger.error({ 
        correlationId,
        action: 'setup.persist.failed', 
        restaurant_id, 
        error: persistError.message,
        details: {
          code: persistError.code,
          hint: persistError.hint,
          details: persistError.details
        }
      }, 'Failed to persist WhatsApp integration');
      throw persistError;
    }

    // Update signup state
    try {
      logger.info({ correlationId, restaurant_id, action: 'setup', step: 'signup_state_update', status: 'pending' }, 'Updating signup state');
      
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
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'signup_state_update', status: 'updated' }, 'Signup state updated');
      } else {
        const insertResult = await supabase.from('whatsapp_signup_states').insert(signupPayload).select('id');
        logger.info({ correlationId, restaurant_id, action: 'setup', step: 'signup_state_update', status: 'created', signup_state_id: insertResult.data?.[0]?.id }, 'Signup state created');
      }
    } catch (e: any) {
      logger.warn({ correlationId, restaurant_id, action: 'setup', step: 'signup_state_update', status: 'error', error: e.message }, 'Failed to update signup state (non-fatal)');
    }

    // Read back persisted integration row for structured logging
    const { data: persistedInteg } = await supabase
      .from('whatsapp_business_integrations')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    logger.info({ 
      correlationId,
      action: "setup.persist", 
      restaurant_id, 
      integration: {
        restaurant_id,
        waba_id,
        phone_number_id: resolved_phone_number_id ? `${resolved_phone_number_id.substring(0, 5)}...` : null,
        display_phone_number: resolved_display_phone_number ? maskPhoneNumber(resolved_display_phone_number) : null,
        connection_status
      }, 
      db_row_exists: !!persistedInteg 
    }, "Integration state persisted successfully.");

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
              logger.info({ correlationId, restaurant_id, action: 'webhook', step: 'contact_created', contact_id, wa_id }, 'New WhatsApp contact created');
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
                .insert({ 
                  restaurant_id, 
                  contact_id, 
                  conversation_id: conversation_id_str, 
                  status: 'open', 
                  last_message_at: new Date().toISOString(), 
                  phone_number_id: metadata.phone_number_id
                })
                .select('id')
                .single();
              conversation_id = insConv.data?.id;
              logger.info({ correlationId, restaurant_id, action: 'webhook', step: 'conversation_created', conversation_id: conversation_id_str, phone_number_id }, 'New WhatsApp conversation created');
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

            const messageInsert = await supabase.from('whatsapp_messages').insert({
              restaurant_id,
              message_id: msg.id,
              to_phone: our_phone || metadata.display_phone_number || '',
              from_phone: wa_id,
              message_type: type,
              content,
              status: 'delivered',
              direction: 'inbound',
              conversation_id: conversation_id_str,
              phone_number_id,
              metadata: { timestamp: msg.timestamp }
            }).select('id').single();
            
            logger.info({ 
              correlationId, 
              restaurant_id, 
              action: 'webhook', 
              step: 'message_persisted', 
              message_id: msg.id, 
              conversation_id: conversation_id_str,
              phone_number_id,
              message_db_id: messageInsert.data?.id
            }, 'WhatsApp message persisted');
          }
        } else if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            const message_id = status.id;
            const new_status = status.status;
            await supabase.from('whatsapp_messages').update({ status: new_status }).eq('message_id', message_id);
            await writeConnectionLog({ waba_id, action: 'message_status_update', details: { message_id, status: new_status } });
            logger.info({ correlationId, action: 'webhook', step: 'message_status_updated', message_id, new_status }, 'Message status updated');
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
  const { restaurant_id: bodyRestaurantId, to, type = 'text', message, from_phone_number_id } = req.body || {};
  const restaurant_id = bodyRestaurantId || req.user?.restaurant_id;
  if (!restaurant_id || !to || !message || !from_phone_number_id) {
    res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
    return;
  }

  try {
    const integ = await supabase
      .from('whatsapp_business_integrations')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();
    
    const from_phone = integ.data?.phone_number || '';

    if (!from_phone_number_id) {
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

    const url = `${WHATSAPP_API_URL}/${from_phone_number_id}/messages`;
    const t0 = Date.now();
    const resp = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${BSP_CONFIG.PERMANENT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    const latency_ms = Date.now() - t0;
    const json: any = resp.data;

    logger.info({ correlationId, restaurant_id, action: 'send_message', step: 'messages', status: 'success', http_status: resp.status, graph_endpoint: url, latency_ms, from_phone_number_id, details: safe({ to, type }) }, 'Message send result');

    const graphMessageId = json?.messages?.[0]?.id || json?.messages?.id || null;
    const conversation_id_str = `wa_${restaurant_id}_${to}`;

    // Ensure conversation exists
    const existingConv = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('conversation_id', conversation_id_str)
      .maybeSingle();
    
    const existingConvData = existingConv?.data;
    if (!existingConvData?.id) {
      // Create a new conversation if needed
      await supabase
        .from('whatsapp_conversations')
        .insert({ 
          restaurant_id, 
          conversation_id: conversation_id_str, 
          status: 'open', 
          last_message_at: new Date().toISOString(),
          phone_number_id: from_phone_number_id
        });
      logger.info({ correlationId, restaurant_id, action: 'send_message', step: 'conversation_created', conversation_id: conversation_id_str }, 'New conversation created for outbound message');
    } else {
      // Update last_message_at
      await supabase
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', existingConvData.id);
    }

    // Store the message
    let messageInsert;
    try {
      messageInsert = await supabase.from('whatsapp_messages').insert({
        restaurant_id,
        message_id: graphMessageId || crypto.randomUUID(),
        to_phone: to,
        from_phone: from_phone,
        message_type: type,
        content: type === 'text' ? { body: message } : message,
        status: 'sent',
        direction: 'outbound',
        conversation_id: conversation_id_str,
        phone_number_id: from_phone_number_id,
        metadata: { request_id: correlationId }
      }).select('id').single();
    } catch (error) {
      logger.error({ correlationId, restaurant_id, action: 'send_message', step: 'message_persist_error', error: (error as any)?.message });
      messageInsert = { data: null };
    }

    const message_db_id = messageInsert?.data?.id;
    logger.info({ correlationId, restaurant_id, action: 'send_message', step: 'message_persisted', message_db_id, conversation_id: conversation_id_str }, 'Outbound message persisted');

    res.json({ success: true, data: { message_id: graphMessageId } });
  } catch (error: any) {
    logger.error({ correlationId, action: 'send_message', step: 'messages', status: 'error', error: error?.message }, 'Send message error');
    res.status(500).json({ success: false, error: 'Erro ao enviar mensagem' });
  }
});

// Status endpoint
router.get('/status', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req as any);
  const restaurant_id = req.user?.restaurant_id;
  logger.info({ correlationId, action: 'status.start', restaurant_id }, 'Status check started');

  if (!restaurant_id) {
    logger.warn({ correlationId, action: 'status.read', restaurant_id: null }, 'Unauthorized status request - missing restaurant_id');
    return res.status(401).json({ success: false, error: 'Unauthorized: missing restaurant context' });
  }

  try {
    const { data, error } = await supabase
      .from('whatsapp_business_integrations')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    if (error) {
      logger.error({ correlationId, action: "status.read", restaurant_id, error: error.message, reason: 'db_query_error' }, "Error querying WhatsApp integration");
      return res.json({ success: true, data: { status: 'not_connected', numbers: [], error: 'db_error' } });
    }

    if (!data) {
      logger.info({ correlationId, action: 'status.not_connected', restaurant_id }, 'No integration found, returning not_connected');
      return res.json({ success: true, data: { status: 'not_connected', numbers: [] } });
    }
    
    logger.info({ correlationId, action: 'status.integration_found', restaurant_id, status: data.connection_status }, 'Integration found');
    
    const metadata = (data.metadata || {}) as any;
    const waba_id = metadata.waba_id || null;
    const cached_numbers = metadata.phone_numbers_cache || [];
    let returned_status = data.connection_status || 'not_connected';
    let numbers: PhoneNumberInfo[] = [];
    
    if (returned_status === 'active' && waba_id) {
      try {
        const url = `${WHATSAPP_API_URL}/${waba_id}/phone_numbers`;
        logger.info({ correlationId, action: "status.fetch_numbers", restaurant_id, waba_id, graph_endpoint: url }, "Fetching phone numbers from Graph API");
        
        const resp = await axios.get<GraphPhoneResponse>(url, { params: { access_token: BSP_CONFIG.PERMANENT_TOKEN } });
        numbers = (resp.data?.data || []).map((n) => ({
          phone_number_id: n.id,
          display_phone_number: n.display_phone_number,
          status: n.quality_rating === 'GREEN' ? 'active' : 'pending',
        }));
        
        logger.info({ correlationId, action: "status.fetch_numbers.success", restaurant_id, numbers_count: numbers.length }, "Successfully fetched phone numbers from Graph API");

        // Asynchronously update cache in DB if new numbers are found
        if (numbers.length > 0) {
          const updatedMetadata = { ...metadata, phone_numbers_cache: numbers };
          supabase.from('whatsapp_business_integrations')
            .update({ metadata: updatedMetadata })
            .eq('id', data.id)
            .then(({ error: cacheError }) => {
              if (cacheError) {
                logger.warn({ correlationId, restaurant_id, action: "status.cache_numbers.error", error: cacheError.message }, "Failed to cache phone numbers in metadata");
              } else {
                logger.info({ correlationId, restaurant_id, action: "status.cache_numbers.success" }, "Phone numbers cached successfully");
              }
            });
        }
      } catch (fetchError: any) {
        logger.error({ correlationId, restaurant_id, action: "status.fetch_numbers.error", error: fetchError.message }, "Error fetching phone numbers from Graph API, will use cache if available.");
        // On error, use cached numbers
        if (cached_numbers.length > 0) {
          numbers = cached_numbers;
          logger.info({ correlationId, action: "status.using_cached_numbers", restaurant_id, count: numbers.length }, "Using cached numbers due to Graph API error");
        }
      }
    }

    // Fallback logic if numbers array is still empty
    if (numbers.length === 0) {
      if (cached_numbers.length > 0) {
        numbers = cached_numbers;
        logger.info({ correlationId, action: "status.fallback_cache", restaurant_id }, "No numbers from Graph API, using cached numbers");
      } else if (data.phone_number_id && data.phone_number) {
        logger.info({ correlationId, action: "status.fallback_db", restaurant_id }, "No numbers from Graph or cache, using single DB stored number");
        numbers = [{
          phone_number_id: data.phone_number_id,
          display_phone_number: data.phone_number,
          status: 'active'
        }];
      }
    }

    logger.info({ correlationId, action: 'status.response_sent', restaurant_id }, 'Status response sent');

    return res.json({
      success: true,
      data: {
        status: returned_status,
        restaurant_id: data.restaurant_id,
        numbers,
        waba_id
      }
    });
  } catch (error: any) {
    logger.error({ correlationId, action: "status.read.error", restaurant_id, error: error.message }, "Unexpected error in status endpoint");
    return res.json({
      success: true,
      data: { status: 'not_connected', numbers: [], error: 'unexpected_error' }
    });
  }
});

// Get connected numbers
router.get('/numbers', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const restaurant_id = req.user?.restaurant_id;

  try {
    const { data: integData, error: integError } = await supabase
      .from('whatsapp_business_integrations')
      .select('metadata')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    if (integError || !integData) {
      return res.json({ success: true, data: [] });
    }

    const waba_id = (integData.metadata as any)?.waba_id;
    if (!waba_id) {
      return res.json({ success: true, data: [] });
    }

    const url = `${WHATSAPP_API_URL}/${waba_id}/phone_numbers`;
    const resp = await axios.get<GraphPhoneResponse>(url, { params: { access_token: BSP_CONFIG.PERMANENT_TOKEN } });
    
    const numbers = (resp.data?.data || []).map((n) => ({
      phone_number_id: n.id,
      display_phone_number: n.display_phone_number,
      status: n.quality_rating === 'GREEN' ? 'active' : 'pending', // Simplified status
    }));
    
    return res.json({ success: true, data: numbers });
  } catch (error: any) {
    logger.error({ correlationId, restaurant_id, action: 'get_numbers', status: 'error', error: error?.message }, 'Get numbers error');
    return res.status(500).json({ success: false, error: 'Erro ao buscar números' });
  }
});


// Conversations
router.get('/conversations', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const restaurant_id = req.user?.restaurant_id;
  const { phone_number_id } = req.query as Record<string, string>;

  let query = supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('restaurant_id', restaurant_id);

  if (phone_number_id) {
    query = query.eq('phone_number_id', phone_number_id);
  }

  const { data, error } = await query.order('last_message_at', { ascending: false });

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

// 6. Get Contacts/Conversations
router.get('/contacts', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const restaurant_id = req.user?.restaurant_id;
  const { phone_number_id } = req.query as { phone_number_id?: string };

  if (!restaurant_id || !phone_number_id) {
    return res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
  }

  logger.info({ correlationId, restaurant_id, phone_number_id, action: 'get_contacts.start' }, 'Fetching contacts');

  try {
    // As we cannot alter the chat_contacts table, we will join through whatsapp_conversations
    // which has the phone_number_id we need to filter by.
    const { data: conversations, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select(`
        contact_id,
        chat_contacts ( * )
      `)
      .eq('restaurant_id', restaurant_id)
      .eq('phone_number_id', phone_number_id);

    if (convError) {
      logger.error({ correlationId, restaurant_id, action: 'get_contacts.db_error', error: convError.message }, 'Error fetching conversations for contacts');
      return res.status(500).json({ success: false, error: 'Erro ao buscar conversas' });
    }

    // Extract the contact details from the join.
    const contacts = conversations.map(c => c.chat_contacts).filter(Boolean);

    logger.info({ correlationId, restaurant_id, action: 'get_contacts.success', source: 'db', count: contacts.length }, 'Contacts fetched from DB via conversations');
    return res.json({ success: true, data: contacts });

  } catch (error: any) {
    logger.error({ correlationId, restaurant_id, action: 'get_contacts.error', error: error?.message }, 'Failed to get contacts');
    return res.status(500).json({ success: false, error: 'Erro ao buscar contatos' });
  }
});


// 7. Get Messages for a Conversation
router.get('/messages', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const restaurant_id = req.user?.restaurant_id;
  const { contact_id } = req.query as { contact_id?: string };

  if (!restaurant_id || !contact_id) {
    return res.status(400).json({ success: false, error: 'Parâmetros inválidos' });
  }

  logger.info({ correlationId, restaurant_id, contact_id, action: 'get_messages.start' }, 'Fetching messages');

  try {
    // To get messages for a contact, we first need the contact's phone number.
    const { data: contact, error: contactError } = await supabase
      .from('chat_contacts')
      .select('phone_number')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
        logger.error({ correlationId, restaurant_id, action: 'get_messages.contact_error', error: contactError?.message }, 'Could not find contact to fetch messages');
        return res.status(404).json({ success: false, error: 'Contato não encontrado' });
    }
    
    // Then, find the corresponding conversation_id string.
    const conversation_id_str = `wa_${restaurant_id}_${contact.phone_number}`;

    const { data: messages, error: messagesError } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('conversation_id', conversation_id_str)
      .order('created_at', { ascending: true });

    if (messagesError) {
      logger.error({ correlationId, restaurant_id, action: 'get_messages.db_error', error: messagesError.message }, 'Error fetching messages from DB');
      return res.status(500).json({ success: false, error: 'Erro ao buscar mensagens do banco de dados' });
    }
    
    logger.info({ correlationId, restaurant_id, action: 'get_messages.success', count: messages.length }, 'Messages fetched from DB');
    return res.json({ success: true, data: messages });

  } catch (error: any) {
    logger.error({ correlationId, restaurant_id, action: 'get_messages.error', error: error?.message }, 'Failed to get messages');
    return res.status(500).json({ success: false, error: 'Erro ao buscar mensagens' });
  }
});

export default router; 