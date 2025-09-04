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
  status: 'active' | 'pending' | 'Verificado' | 'Não Verificado';
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

/**
 * Performs the core WhatsApp Business Account setup logic.
 * This includes WABA discovery, phone number discovery/claiming, webhook subscription,
 * and persisting the integration details to the database.
 * @param restaurant_id The ID of the restaurant to perform setup for.
 * @param correlationId A tracking ID for logging.
 * @returns An object with the final status and details of the integration.
 */
async function performWhatsAppSetup(restaurant_id: string, correlationId: string) {
  logger.info({ correlationId, action: 'performWhatsAppSetup.start', restaurant_id }, 'Background setup process started');
  
  // This function encapsulates the logic previously in the POST /setup endpoint.
  // We're keeping the detailed logging from that endpoint.
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

    // This is a critical guard. If we just completed OAuth, a token MUST exist.
    if (!oauthToken || !oauthToken.access_token || !oauthToken.expires_at) {
        throw new Error('No valid OAuth token found to perform setup.');
    }

    const graphToken = BSP_CONFIG.PERMANENT_TOKEN || '';
    const tokenFingerprint = getTokenFingerprint(graphToken);

    if (!graphToken) {
      throw new Error('BSP_PERMANENT_TOKEN is missing.');
    }

    const resolved_business_id: string | null = oauthToken?.business_id || null;
    const discovery_business_id = BSP_CONFIG.BSP_BUSINESS_ID;
    if (!discovery_business_id) {
      throw new Error('BSP_BUSINESS_ID is not configured on the server.');
    }
    
    let waba_id: string | null = null;
    let resolved_phone_number_id: string | null = null;
    let resolved_display_phone_number: string | null = null;
    let connection_status: 'active' | 'pending_verification' | 'unclaimed' = 'unclaimed';

    // Discover WABA
    const wabaUrl = `${WHATSAPP_API_URL}/${discovery_business_id}/owned_whatsapp_business_accounts`;
    // Add explicit type for the axios response to fix TS2339
    const wabaResp = await axios.get<{ data: { id: string }[] }>(wabaUrl, { params: { access_token: graphToken } });
    waba_id = wabaResp.data?.data?.[0]?.id || null;

    if (!waba_id) {
      throw new Error('WABA discovery failed.');
    }
    await writeIntegrationLog({ restaurant_id, step: 'waba_discovery', success: true, details: { waba_id } });

    // Discover Phone Numbers
    const phoneUrl = `${WHATSAPP_API_URL}/${waba_id}/phone_numbers`;
    const phoneResp = await axios.get<GraphPhoneResponse>(phoneUrl, { params: { access_token: graphToken } });
    
    // Fetch ALL numbers, and then determine which are verified.
    const allNumbers = phoneResp.data?.data || [];
    const allVerifiedNumbers = allNumbers.filter((p: any) => p.verified_name);

    if (allVerifiedNumbers.length > 0) {
      // Use the first verified number for the main columns for compatibility
      const primaryNumber = allVerifiedNumbers[0];
      resolved_phone_number_id = primaryNumber.id;
      resolved_display_phone_number = primaryNumber.display_phone_number;
      connection_status = 'active';
      logger.info({ correlationId, restaurant_id, action: 'performWhatsAppSetup', step: 'phone_discovery', status: 'success', found_numbers: allVerifiedNumbers.length }, 'Found verified phone numbers');
    } else {
      connection_status = 'unclaimed'; // No verified number, user must claim one manually.
      logger.warn({ correlationId, restaurant_id, action: 'performWhatsAppSetup', step: 'phone_discovery', status: 'unclaimed' }, 'No verified phone numbers found.');
    }

    // Subscribe app to WABA messages - THIS IS THE CRITICAL STEP
    // It tells Meta to send message events for this specific WABA to our app's webhook.
    const subscribeUrl = `${WHATSAPP_API_URL}/${waba_id}/subscribed_apps`;
    try {
      logger.info({ correlationId, restaurant_id, waba_id, action: 'performWhatsAppSetup', step: 'waba_subscribe' }, 'Subscribing app to WABA');
      await axios.post(subscribeUrl, { subscribed_fields: ['messages'], access_token: graphToken }, { headers: { 'Content-Type': 'application/json' } });
      logger.info({ correlationId, restaurant_id, waba_id, action: 'performWhatsAppSetup', step: 'waba_subscribe', status: 'success' }, 'Successfully subscribed app to WABA');
    } catch (subError: any) {
        // This can sometimes fail if already subscribed. We log a warning but don't treat it as a fatal error.
        logger.warn({
            correlationId,
            restaurant_id,
            waba_id,
            action: 'performWhatsAppSetup',
            step: 'waba_subscribe',
            status: 'error_ignored',
            error: subError.message
        }, 'Failed to subscribe app to WABA, possibly already subscribed. Continuing setup.');
    }
    
    // Persist integration details
    const integrationData = {
      restaurant_id,
      business_account_id: resolved_business_id || waba_id,
      phone_number_id: resolved_phone_number_id,
      phone_number: resolved_display_phone_number,
      connection_status,
      // The missing fields that caused the not-null constraint violation
      access_token: oauthToken.access_token,
      token_expires_at: oauthToken.expires_at,
      metadata: { 
        waba_id,
        // Cache the full list of numbers found, with a user-friendly status
        phone_numbers_cache: allNumbers.map(n => ({
            phone_number_id: n.id,
            display_phone_number: n.display_phone_number,
            status: n.verified_name ? 'Verificado' : 'Não Verificado'
        }))
      }
    };

    // Manual upsert logic to avoid ON CONFLICT issue
    const { data: existing, error: selectError } = await supabase
      .from('whatsapp_business_integrations')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    if (selectError) {
      logger.error({ correlationId, restaurant_id, action: 'performWhatsAppSetup.persist.select_error', error: selectError.message }, 'Error checking for existing integration');
      throw selectError;
    }

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('whatsapp_business_integrations')
        .update(integrationData)
        .eq('id', existing.id);
      if (updateError) {
        logger.error({ correlationId, restaurant_id, action: 'performWhatsAppSetup.persist.update_error', error: updateError.message }, 'Error updating integration');
        throw updateError;
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('whatsapp_business_integrations')
        .insert(integrationData);
      if (insertError) {
        logger.error({ correlationId, restaurant_id, action: 'performWhatsAppSetup.persist.insert_error', error: insertError.message }, 'Error inserting new integration');
        throw insertError;
      }
    }
    
    logger.info({ correlationId, action: 'performWhatsAppSetup.persist.success', restaurant_id }, 'Integration row persisted');
    
    return { restaurant_id, waba_id, phone_number_id: resolved_phone_number_id, status: connection_status };

  } catch (error: any) {
    const errMsg = error?.response?.data?.error?.message || error?.message || 'Unknown setup error';
    logger.error({ correlationId, restaurant_id, action: 'performWhatsAppSetup.error', error: errMsg }, 'Background setup process failed');
    await writeIntegrationLog({ restaurant_id, step: 'complete_flow', success: false, error_message: errMsg });
    throw error;
  }
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

  const closePopupScript = `<!DOCTYPE html><html><head><script>window.close();</script></head><body><p>Conectado. Pode fechar esta janela.</p></body></html>`;

  try {
    if (!code || !state) {
      logger.error({ correlationId, action: 'oauth_callback.error', reason: 'missing_params' }, 'Missing code or state parameters');
      return res.status(400).send('Parâmetros inválidos.');
    }

    const parsed = verifyState(state);
    if (!parsed?.restaurant_id || !parsed.nonce) {
      logger.error({ correlationId, action: 'oauth_callback.error', reason: 'invalid_state' }, 'Invalid state parameter');
      return res.status(400).send('State inválido.');
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
      // No setup is needed here, just close the popup.
      return res.send(closePopupScript);
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
      // This path did not return a value, causing the build error.
      // We should stop and return an error response.
      return res.status(500).send('Erro ao salvar o token de autenticação.');
    } 
    
    logger.info({ correlationId, action: 'oauth_callback.token_persist.success', restaurant_id, token_id: tokenData[0]?.id }, 'OAuth token persisted successfully');
    
    // Fire-and-forget the setup process. Don't block the response.
    performWhatsAppSetup(restaurant_id, correlationId).catch(error => {
          logger.error({
              correlationId,
              restaurant_id,
              action: 'oauth_callback.background_setup_failed',
              error: error?.message
          }, 'The background setup process initiated by OAuth callback failed.');
      });

    await writeIntegrationLog({ restaurant_id, step: 'oauth_callback', success: true });

    return res.send(closePopupScript);

  } catch (error: any) {
    const restaurant_id = (req.query && typeof req.query.state === 'string' && verifyState(req.query.state)?.restaurant_id) || undefined;
    logger.error({ correlationId, restaurant_id, action: 'oauth_callback.error', step: 'exception', error: error?.message }, 'OAuth callback error');
    await writeIntegrationLog({ restaurant_id, step: 'oauth_callback', success: false, error_message: error?.message });
    return res.status(500).send('Ocorreu um erro no servidor.');
  }
});

router.get('/oauth/success', (req, res) => {
  res.send('<html><body><p>Login com Meta concluído. Você pode fechar esta janela.</p></body></html>');
});

// 2. Setup (Now a lightweight wrapper)
router.post('/setup', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const restaurant_id = req.user?.restaurant_id;

  if (!restaurant_id) {
    return res.status(400).json({ success: false, error: 'restaurant_id é obrigatório' });
  }

  try {
    logger.info({ correlationId, restaurant_id, action: 'setup.manual_trigger' }, 'Manual setup triggered');
    const setupResult = await performWhatsAppSetup(restaurant_id, correlationId);
    return res.json({ success: true, data: setupResult });
  } catch (error: any) {
    const errMsg = error?.response?.data?.error?.message || error?.message || 'Unknown setup error';
    return res.status(500).json({ success: false, error: errMsg });
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

  logger.info({ action: 'webhook.verification', mode, token_present: !!token }, '[webhook] Verification request received');

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    logger.info({ action: 'webhook.verification.success', challenge }, '[webhook] verification success');
    res.status(200).send(challenge);
    return;
  }
  
  logger.warn({ action: 'webhook.verification.failed', mode, token_matches: token === WEBHOOK_VERIFY_TOKEN }, '[webhook] verification failed');
  res.status(403).send('Forbidden');
});

// 4. Webhook - Events (POST)
router.post('/webhook', async (req, res) => {
  const correlationId = getCorrelationId(req as any);
  try {
    const body = req.body as any;

    // Log the entire webhook payload for debugging
    logger.info({ correlationId, action: 'webhook.received', body: safe(body) }, '[webhook] event received');

    if (!body?.entry) {
      logger.warn({ correlationId, action: 'webhook.ignored', reason: 'no_entry_field' }, 'Webhook payload ignored (no .entry)');
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

          if (!restaurant_id) {
            logger.warn({ correlationId, action: 'webhook.ignored', reason: 'no_restaurant_found', waba_id, phone_number_id }, 'Webhook message ignored (restaurant not found)');
            continue;
          }

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

            // Sync with chat_* tables
            try {
              let chat_contact_id: string | null = null;

              const { data: existingChatContact, error: selectError } = await supabase
                .from('chat_contacts')
                .select('id, unread_count')
                .eq('restaurant_id', restaurant_id)
                .eq('phone_number', wa_id)
                .maybeSingle();

              if (selectError) throw selectError;

              if (!existingChatContact) {
                const { data: newContact, error: insertError } = await supabase
                  .from('chat_contacts')
                  .insert({
                    restaurant_id,
                    phone_number: wa_id,
                    name: contact_name,
                    status: 'active',
                    customer_type: 'new',
                    last_message_at: new Date().toISOString(),
                    unread_count: 1,
                  })
                  .select('id')
                  .single();
                if (insertError) throw insertError;
                chat_contact_id = newContact.id;
                logger.info({ correlationId, restaurant_id, action: 'webhook', step: 'chat_contact.synced.new', contact_id: chat_contact_id }, 'Sync: New chat contact created');
              } else {
                chat_contact_id = existingChatContact.id;
                const { error: updateError } = await supabase
                  .from('chat_contacts')
                  .update({
                    name: contact_name,
                    last_message_at: new Date().toISOString(),
                    unread_count: (existingChatContact.unread_count || 0) + 1,
                    status: 'active'
                  })
                  .eq('id', chat_contact_id);
                if (updateError) throw updateError;
                logger.info({ correlationId, restaurant_id, action: 'webhook', step: 'chat_contact.synced.update', contact_id: chat_contact_id }, 'Sync: Chat contact updated');
              }

              if (chat_contact_id) {
                const { data: existingChatConv, error: convSelectError } = await supabase
                  .from('chat_conversations')
                  .select('id')
                  .eq('restaurant_id', restaurant_id)
                  .eq('contact_id', chat_contact_id)
                  .maybeSingle();
                
                if (convSelectError) throw convSelectError;

                if (!existingChatConv) {
                  const { error: insertError } = await supabase.from('chat_conversations').insert({
                    restaurant_id,
                    contact_id: chat_contact_id,
                    status: 'open',
                  });
                  if (insertError) throw insertError;
                  logger.info({ correlationId, restaurant_id, action: 'webhook', step: 'chat_conv.created' }, 'Sync: New chat conversation created');
                } else {
                  const { error: updateError } = await supabase.from('chat_conversations').update({
                    updated_at: new Date().toISOString(),
                    status: 'open'
                  }).eq('id', existingChatConv.id);
                  if (updateError) throw updateError;
                  logger.info({ correlationId, restaurant_id, action: 'webhook', step: 'chat_conv.updated' }, 'Sync: Chat conversation updated');
                }

                const type = msg.type as string;
                const typeContent = msg[type] || {};
                const contentText = typeContent.body || typeContent.caption || `[${type}]`;

                const { error: messageInsertError } = await supabase.from('chat_messages').insert({
                  restaurant_id,
                  sender_id: chat_contact_id,
                  sender_type: 'customer',
                  content: contentText,
                  content_type: type,
                  is_read: false,
                });
                if (messageInsertError) throw messageInsertError;
                logger.info({ correlationId, restaurant_id, action: 'webhook', step: 'chat_msg.created' }, 'Sync: Chat message created');
              }
            } catch (syncError: any) {
              logger.error({ correlationId, restaurant_id, action: 'webhook', step: 'chat_sync.fail', wa_id, error: syncError.message }, 'Failed to sync with chat tables');
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
              logger.info({ correlationId, restaurant_id, action: 'webhook', step: 'wa_conv.created', conversation_id: conversation_id_str, phone_number_id }, '[webhook] conversation persisted');
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
            const timestamp = msg.timestamp;

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
              metadata: { timestamp }
            }).select('id').single();
            
            logger.info({ 
              correlationId, 
              restaurant_id, 
              action: 'webhook', 
              step: 'wa_msg.persisted', 
              message_id: msg.id, 
              conversation_id: conversation_id_str,
              phone_number_id,
              message_db_id: messageInsert.data?.id
            }, '[webhook] message persisted');
          }
        } else if (value.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            const message_id = status.id;
            const new_status = status.status;
            await supabase.from('whatsapp_messages').update({ status: new_status }).eq('message_id', message_id);
            await writeConnectionLog({ waba_id, action: 'message_status_update', details: { message_id, status: new_status } });
            logger.info({ correlationId, action: 'webhook', step: 'msg_status.updated', message_id, new_status }, 'Message status updated');
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

        // Map ALL numbers with a user-friendly status
        numbers = (resp.data?.data || []).map((n) => ({
          phone_number_id: n.id,
          display_phone_number: n.display_phone_number,
          status: n.verified_name ? 'Verificado' : 'Não Verificado',
        }));

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
  const correlationId = getCorrelationId(req as any);
  const restaurant_id = req.user?.restaurant_id;
  const { phone_number_id } = req.query as Record<string, string>;

  if (!restaurant_id) {
    logger.warn({ correlationId, action: 'whatsapp.conversations', error: 'missing_restaurant_id' }, 'Missing restaurant_id in request');
    return res.status(400).json({ success: false, error: 'Restaurante não identificado' });
  }

  try {
    logger.info({ correlationId, restaurant_id, phone_number_id, action: 'whatsapp.conversations.fetch' }, 'Fetching WhatsApp conversations');
    
    // Try to use the stored procedure first
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_conversations_with_details', { 
        p_restaurant_id: restaurant_id,
        p_phone_number_id: phone_number_id || null
      });

      if (error) {
        logger.warn({ correlationId, restaurant_id, action: 'whatsapp.conversations.rpc_error', error: error.message }, 'Error using RPC function, falling back to manual query');
        throw error; // This will be caught by the outer try-catch and trigger the fallback
      }
      
      logger.info({ correlationId, restaurant_id, action: 'whatsapp.conversations.rpc_success', count: data?.length || 0 }, 'Successfully fetched conversations with RPC');
      return res.json({ success: true, data });
    } catch (rpcError) {
      // Fallback implementation if the function doesn't exist
      logger.info({ correlationId, restaurant_id, action: 'whatsapp.conversations.using_fallback' }, 'Using fallback query for conversations');
      
      // Get base conversations
      let query = supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('restaurant_id', restaurant_id);

      if (phone_number_id) {
        query = query.eq('phone_number_id', phone_number_id);
      }

      const { data: conversations, error } = await query.order('last_message_at', { ascending: false });

      if (error) {
        logger.error({ correlationId, restaurant_id, action: 'whatsapp.conversations.fallback_error', error: error.message }, 'Error in fallback query');
        return res.status(500).json({ success: false, error: 'Erro ao listar conversas' });
      }

      // Enhance conversations with contact details and last message
      const enhancedConversations = [];
      for (const conv of conversations) {
        // Get contact info
        let contact = null;
        if (conv.contact_id) {
          const { data: contactData } = await supabase
            .from('whatsapp_contacts')
            .select('*')
            .eq('id', conv.contact_id)
            .single();
          
          if (contactData) {
            contact = {
              id: contactData.id,
              name: contactData.name,
              phone_number: contactData.phone_number,
              status: contactData.status
            };
          }
        }

        // Get last message
        const { data: lastMessageData } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('conversation_id', conv.conversation_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastMessage = lastMessageData ? {
          id: lastMessageData.id,
          content: lastMessageData.content,
          message_type: lastMessageData.message_type,
          direction: lastMessageData.direction,
          created_at: lastMessageData.created_at
        } : null;

        enhancedConversations.push({
          ...conv,
          contact,
          last_message: lastMessage
        });
      }

      logger.info({ correlationId, restaurant_id, action: 'whatsapp.conversations.fallback_success', count: enhancedConversations.length }, 'Successfully fetched conversations with fallback');
      return res.json({ success: true, data: enhancedConversations });
    }
  } catch (error: any) {
    logger.error({ correlationId, restaurant_id, action: 'whatsapp.conversations.exception', error: error.message }, 'Exception fetching conversations');
    return res.status(500).json({ success: false, error: 'Erro ao listar conversas' });
  }
});

// Messages by conversation
router.get('/messages', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req as any);
  const restaurant_id = req.user?.restaurant_id;
  const { conversation_id, contact_id } = req.query as Record<string, string>;

  if (!restaurant_id) {
    logger.warn({ correlationId, action: 'whatsapp.messages', error: 'missing_restaurant_id' }, 'Missing restaurant_id in request');
    return res.status(400).json({ success: false, error: 'Restaurante não identificado' });
  }

  try {
    // We can fetch by either conversation_id or contact_id
    if (!conversation_id && !contact_id) {
      logger.warn({ correlationId, restaurant_id, action: 'whatsapp.messages', error: 'missing_identifier' }, 'Missing conversation_id or contact_id');
      return res.status(400).json({ success: false, error: 'É necessário fornecer conversation_id ou contact_id' });
    }

    let query = supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('restaurant_id', restaurant_id);

    if (conversation_id) {
      logger.info({ correlationId, restaurant_id, conversation_id, action: 'whatsapp.messages.fetch_by_conv' }, 'Fetching messages by conversation_id');
      query = query.eq('conversation_id', conversation_id);
    } else if (contact_id) {
      // If contact_id is provided, first get the contact's phone number
      logger.info({ correlationId, restaurant_id, contact_id, action: 'whatsapp.messages.fetch_by_contact' }, 'Fetching messages by contact_id');
      const { data: contact, error: contactError } = await supabase
        .from('whatsapp_contacts')
        .select('phone_number')
        .eq('id', contact_id)
        .eq('restaurant_id', restaurant_id)
        .single();

      if (contactError || !contact) {
        logger.error({ correlationId, restaurant_id, action: 'whatsapp.messages', error: 'contact_not_found' }, 'Contact not found');
        return res.status(404).json({ success: false, error: 'Contato não encontrado' });
      }

      // Then find the conversation for this contact
      const conversation_id_str = `wa_${restaurant_id}_${contact.phone_number}`;
      query = query.eq('conversation_id', conversation_id_str);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      logger.error({ correlationId, restaurant_id, action: 'whatsapp.messages.error', error: error.message }, 'Error fetching messages');
      return res.status(500).json({ success: false, error: 'Erro ao listar mensagens' });
    }

    logger.info({ correlationId, restaurant_id, action: 'whatsapp.messages.success', count: data?.length || 0 }, 'Successfully fetched messages');
    return res.json({ success: true, data });
    
  } catch (error: any) {
    logger.error({ correlationId, restaurant_id, action: 'whatsapp.messages.exception', error: error.message }, 'Exception fetching messages');
    return res.status(500).json({ success: false, error: 'Erro ao listar mensagens' });
  }
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
    // Re-instating the correct join logic now that the schema will be updated.
    const { data: conversations, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select(`
        contact_id,
        whatsapp_contacts ( * )
      `)
      .eq('restaurant_id', restaurant_id)
      .eq('phone_number_id', phone_number_id);

    if (convError) {
      logger.error({ correlationId, restaurant_id, action: 'get_contacts.db_error', error: convError.message }, 'Error fetching conversations for contacts');
      return res.status(500).json({ success: false, error: 'Erro ao buscar conversas' });
    }

    const contacts = conversations.map(c => c.whatsapp_contacts).filter(Boolean);

    logger.info({ correlationId, restaurant_id, action: 'get_contacts.success', source: 'db', count: contacts.length }, 'Contacts fetched from DB via conversations');
    return res.json({ success: true, data: contacts });

  } catch (error: any) {
    logger.error({ correlationId, restaurant_id, action: 'get_contacts.error', error: error?.message }, 'Failed to get contacts');
    return res.status(500).json({ success: false, error: 'Erro ao buscar contatos' });
  }
});

// 8. Disconnect/Forget Integration
router.post('/disconnect', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  const correlationId = getCorrelationId(req);
  const restaurant_id = req.user?.restaurant_id;

  if (!restaurant_id) {
    return res.status(400).json({ success: false, error: 'Restaurante não identificado' });
  }

  logger.warn({ correlationId, restaurant_id, action: 'disconnect.start' }, 'Starting WhatsApp disconnection process');

  try {
    // Delete in order to respect foreign key constraints
    
    // 1. Delete integration config
    const { error: integError } = await supabase
      .from('whatsapp_business_integrations')
      .delete()
      .eq('restaurant_id', restaurant_id);

    if (integError) throw new Error(`Failed to delete integration: ${integError.message}`);
    logger.info({ correlationId, restaurant_id, action: 'disconnect.step', step: 'delete_integration' }, 'Integration config deleted');

    // 2. Delete OAuth tokens
    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .delete()
      .eq('restaurant_id', restaurant_id);

    if (tokenError) throw new Error(`Failed to delete oauth tokens: ${tokenError.message}`);
    logger.info({ correlationId, restaurant_id, action: 'disconnect.step', step: 'delete_tokens' }, 'OAuth tokens deleted');
    
    logger.info({ correlationId, restaurant_id, action: 'disconnect.success' }, 'WhatsApp disconnection successful');
    return res.json({ success: true, message: 'Integração removida com sucesso' });

  } catch (error: any) {
    logger.error({ correlationId, restaurant_id, action: 'disconnect.error', error: error?.message }, 'Failed to disconnect WhatsApp integration');
    return res.status(500).json({ success: false, error: 'Erro ao remover integração' });
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
      .from('whatsapp_contacts') // Fix: Was incorrectly pointing to chat_contacts
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