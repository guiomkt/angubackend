import axios from 'axios';
import { supabase } from '../config/database';
import { META_URLS, BSP_CONFIG } from '../config/meta';
import logger, { maskPhoneNumber } from '../config/logger';

export type SetupMode = 'auto' | 'manual';

export interface SetupRequest {
  restaurantId: string;
  mode?: SetupMode;
  clientBusinessId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  correlationId?: string;
}

export interface SetupResponse {
  restaurant_id: string;
  business_id?: string | null;
  waba_id?: string | null;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  status: string;
}

async function getActiveOAuthToken(restaurantId: string) {
  const { data } = await supabase
    .from('oauth_tokens')
    .select('access_token, expires_at, business_id, scope')
    .eq('provider', 'meta')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .gte('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function subscribeAppToWaba(wabaId: string, userAccessToken: string, correlationId?: string) {
  const url = `${META_URLS.GRAPH_API}/${wabaId}/subscribed_apps`;
  const started = Date.now();
  const res = await axios.post(url, {}, { headers: { Authorization: `Bearer ${userAccessToken}` } });
  logger.info({ correlationId, action: 'subscribe_app', step: 'subscribe_app', status: 'ok', latency_ms: Date.now() - started, waba_id: wabaId, http_status: res.status, graph_endpoint: `/${wabaId}/subscribed_apps` });
}

async function setWebhook(webhookUrl: string, verifyToken: string, correlationId?: string) {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return;
  const appAccessToken = `${appId}|${appSecret}`;
  const url = `${META_URLS.GRAPH_API}/${appId}/subscriptions`;
  const started = Date.now();
  try {
    const res = await axios.post(url, {
      object: 'whatsapp_business_account',
      callback_url: webhookUrl,
      verify_token: verifyToken,
      fields: 'messages'
    }, {
      headers: { Authorization: `Bearer ${appAccessToken}` }
    });
    logger.info({ correlationId, action: 'set_webhook', step: 'set_webhook', status: 'ok', latency_ms: Date.now() - started, http_status: res.status, graph_endpoint: `/${appId}/subscriptions` });
  } catch (err: any) {
    logger.warn({ correlationId, action: 'set_webhook', step: 'set_webhook', status: 'skipped', error_message: err.response?.data?.error?.message, http_status: err.response?.status });
  }
}

async function upsertWebhookRecord(restaurantId: string, wabaId: string, webhookUrl: string, verifyToken: string) {
  await supabase
    .from('whatsapp_webhooks')
    .upsert({
      restaurant_id: restaurantId,
      waba_id: wabaId,
      webhook_url: webhookUrl,
      verify_token: verifyToken,
      is_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'restaurant_id' });
}

async function upsertIntegration(restaurantId: string, wabaId: string, phoneNumberId: string | null, displayPhoneNumber: string | null, accessToken?: string | null) {
  const masked = displayPhoneNumber ? maskPhoneNumber(displayPhoneNumber) : null;
  const record: any = {
    restaurant_id: restaurantId,
    business_account_id: wabaId,
    phone_number_id: phoneNumberId,
    phone_number: masked,
    is_active: true,
    connection_status: 'connected',
    webhook_url: `${process.env.API_BASE_URL || ''}/api/whatsapp/webhook`,
    webhook_verify_token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    metadata: {},
    updated_at: new Date().toISOString()
  };
  if (accessToken) record.access_token = accessToken;
  await supabase
    .from('whatsapp_business_integrations')
    .upsert(record, { onConflict: 'restaurant_id' });
}

async function logIntegration(restaurantId: string, step: string, strategy: string | null, success: boolean, error_message?: string, details?: any) {
  await supabase.from('whatsapp_integration_logs').insert({ restaurant_id: restaurantId, step, strategy, success, error_message, details: details || {} });
}

async function logConnection(restaurantId: string, action: string, details?: any, wabaId?: string) {
  await supabase.from('whatsapp_connection_logs').insert({ restaurant_id: restaurantId, action, details: details || {}, created_at: new Date().toISOString() });
}

async function findWabaIdByPhone(userAccessToken: string, phoneNumberId: string): Promise<string | null> {
  // Enumerate WABAs and their phone numbers to find ownership of phoneNumberId
  const wabRes = await axios.get<{ data?: Array<{ id: string; name: string }> }>(`${META_URLS.GRAPH_API}/me/whatsapp_business_accounts?fields=id,name`, { headers: { Authorization: `Bearer ${userAccessToken}` } });
  const wabList: Array<{ id: string; name: string }> = (wabRes.data?.data) || [];
  for (const w of wabList) {
    const pnRes = await axios.get<{ data?: Array<{ id: string; display_phone_number: string }> }>(`${META_URLS.GRAPH_API}/${w.id}/phone_numbers?fields=id,display_phone_number`, { headers: { Authorization: `Bearer ${userAccessToken}` } });
    const pns: Array<{ id: string; display_phone_number: string }> = pnRes.data?.data || [];
    if (pns.some(p => p.id === phoneNumberId)) return w.id;
  }
  return null;
}

export async function setupIntegration(req: SetupRequest): Promise<SetupResponse> {
  const correlationId = req.correlationId;
  const restaurantId = req.restaurantId;
  const mode: SetupMode = (req.mode || 'auto');

  // Reentrância/idempotência: curto-circuita se já ativo
  const { data: existing } = await supabase
    .from('whatsapp_business_integrations')
    .select('business_account_id, phone_number_id, phone_number, is_active')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (existing?.is_active && existing.business_account_id && existing.phone_number_id) {
    await logIntegration(restaurantId, 'complete_flow', mode, true, undefined, { idempotent: true });
    return {
      restaurant_id: restaurantId,
      business_id: null,
      waba_id: existing.business_account_id,
      phone_number_id: existing.phone_number_id,
      display_phone_number: existing.phone_number,
      status: 'active'
    };
  }

  const webhookUrl = `${process.env.API_BASE_URL || ''}/api/whatsapp/webhook`;
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';

  if (mode === 'manual') {
    if (!req.phoneNumberId) throw new Error('validation: phone_number_id obrigatório no modo manual');
    const oauth = await getActiveOAuthToken(restaurantId);
    if (!oauth) throw new Error('permission: token OAuth Meta ausente ou expirado');

    const wabaId = await findWabaIdByPhone(oauth.access_token, req.phoneNumberId);
    if (!wabaId) throw new Error('not_found: phone_number_id não pertence a nenhum WABA acessível');

    await subscribeAppToWaba(wabaId, oauth.access_token, correlationId);
    await setWebhook(webhookUrl, verifyToken, correlationId);
    await upsertWebhookRecord(restaurantId, wabaId, webhookUrl, verifyToken);

    // Persistir vínculo
    await upsertIntegration(restaurantId, wabaId, req.phoneNumberId, req.displayPhoneNumber || null, null);
    await supabase.from('whatsapp_signup_states').upsert({ restaurant_id: restaurantId, status: 'completed', updated_at: new Date().toISOString() }, { onConflict: 'restaurant_id' });
    await logConnection(restaurantId, 'link_manual', { phone_number_id: req.phoneNumberId }, wabaId);
    await logIntegration(restaurantId, 'complete_flow', 'manual', true, undefined, { waba_id: wabaId, phone_number_id: req.phoneNumberId });

    return { restaurant_id: restaurantId, business_id: oauth.business_id || null, waba_id: wabaId, phone_number_id: req.phoneNumberId, display_phone_number: req.displayPhoneNumber || null, status: 'active' };
  }

  // AUTO via BSP
  const systemToken = BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN;
  if (!systemToken) throw new Error('permission: BSP token ausente');

  const clientBusinessId = req.clientBusinessId;
  if (!clientBusinessId) {
    // Se não informado, tentar descobrir pelo oauth token
    const oauth = await getActiveOAuthToken(restaurantId);
    if (oauth?.business_id) {
      (req as any).clientBusinessId = oauth.business_id;
    }
  }
  if (!req.clientBusinessId) throw new Error('validation: client_business_id é obrigatório no modo auto');

  // Tentar criar/assegurar WABA
  let createdWabaId: string | null = null;
  try {
    const createRes = await axios.post<{ id?: string }>(`${META_URLS.GRAPH_API}/${req.clientBusinessId}/whatsapp_business_accounts`, { name: process.env.APP_NAME || 'Integration' }, { headers: { Authorization: `Bearer ${systemToken}` } });
    createdWabaId = (createRes.data && (createRes.data as any).id) ? (createRes.data as any).id : null;
  } catch (err: any) {
    // Fallback: tentar listar já existentes
    try {
      const wabList = await axios.get<{ data?: Array<{ id: string; name: string }> }>(`${META_URLS.GRAPH_API}/${req.clientBusinessId}/whatsapp_business_accounts?fields=id,name`, { headers: { Authorization: `Bearer ${systemToken}` } });
      const first = Array.isArray(wabList.data?.data) && wabList.data!.data!.length > 0 ? wabList.data!.data![0] : undefined;
      createdWabaId = first?.id || null;
    } catch (_) {}
  }
  if (!createdWabaId) {
    await supabase.from('whatsapp_signup_states').upsert({ restaurant_id: restaurantId, status: 'awaiting_waba_creation', updated_at: new Date().toISOString() }, { onConflict: 'restaurant_id' });
    await logIntegration(restaurantId, 'waba_creation', 'auto', false, 'WABA creation failed');
    return { restaurant_id: restaurantId, business_id: req.clientBusinessId, waba_id: null, phone_number_id: null, display_phone_number: null, status: 'pending_verification' };
  }

  // Assinar app + webhook
  const oauth = await getActiveOAuthToken(restaurantId);
  const userToken = oauth?.access_token || systemToken; // prefer user token for subscribe
  await subscribeAppToWaba(createdWabaId, userToken, correlationId);
  await setWebhook(webhookUrl, verifyToken, correlationId);
  await upsertWebhookRecord(restaurantId, createdWabaId, webhookUrl, verifyToken);

  // Persistência com estado pendente se número não fornecido
  await upsertIntegration(restaurantId, createdWabaId, req.phoneNumberId || null, req.displayPhoneNumber || null, null);
  await supabase.from('whatsapp_signup_states').upsert({ restaurant_id: restaurantId, status: req.phoneNumberId ? 'completed' : 'oauth_completed', waba_id: createdWabaId, updated_at: new Date().toISOString() }, { onConflict: 'restaurant_id' });
  await logConnection(restaurantId, 'subscribe_app', { waba_id: createdWabaId }, createdWabaId);
  await logConnection(restaurantId, 'set_webhook', { webhook_url: webhookUrl }, createdWabaId);

  return { restaurant_id: restaurantId, business_id: req.clientBusinessId, waba_id: createdWabaId, phone_number_id: req.phoneNumberId || null, display_phone_number: req.displayPhoneNumber || null, status: req.phoneNumberId ? 'active' : 'pending_verification' };
}

export async function verifyNumber(params: { restaurantId: string; code: string; correlationId?: string }): Promise<{ restaurant_id: string; status: string }> {
  const restaurantId = params.restaurantId;
  // Recuperar phone_number_id e token
  const { data: integration } = await supabase
    .from('whatsapp_business_integrations')
    .select('phone_number_id, business_account_id')
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (!integration?.phone_number_id) throw new Error('validation: phone_number_id não configurado');

  const oauth = await getActiveOAuthToken(restaurantId);
  const accessToken = oauth?.access_token || BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN;
  if (!accessToken) throw new Error('permission: token ausente');

  try {
    const url = `${META_URLS.GRAPH_API}/${integration.phone_number_id}/verify_code`;
    await axios.post(url, { code: params.code }, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (err: any) {
    const status = err.response?.status;
    if (status && status >= 500) throw new Error('retryable: Graph temporarily unavailable');
    throw new Error('verification_failed');
  }

  await supabase.from('whatsapp_signup_states').upsert({ restaurant_id: restaurantId, status: 'completed', updated_at: new Date().toISOString() }, { onConflict: 'restaurant_id' });
  await logConnection(restaurantId, 'verify_number', { phone_number_id: integration.phone_number_id }, integration.business_account_id);
  await logIntegration(restaurantId, 'phone_verification', null, true, undefined, { phone_number_id: integration.phone_number_id });

  return { restaurant_id: restaurantId, status: 'active' };
} 