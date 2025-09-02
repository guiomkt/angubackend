import { Router, Request, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';
import { supabase } from '../config/database';
import logger, { getCorrelationId, maskPhoneNumber } from '../config/logger';
import { setupIntegration as setupAgentIntegration, verifyNumber as agentVerifyNumber } from '../services/whatsappIntegrationAgent';

const router = Router();

// Preserve webhook URL and verification behavior
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token && mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post('/webhook', async (req: Request, res: Response) => {
  const correlationId = getCorrelationId(req);
  const startedAt = Date.now();
  try {
    const body = req.body;
    if (!body?.object) return res.sendStatus(404);

    const entry = body.entry?.[0]?.changes?.[0];
    const value = entry?.value;
    if (!value) return res.status(200).send('EVENT_RECEIVED');

    if (Array.isArray(value.messages)) {
      for (const message of value.messages) {
        await processInboundMessage(message, value);
      }
    }
    if (Array.isArray(value.statuses)) {
      for (const status of value.statuses) {
        await processMessageStatus(status);
      }
    }
    return res.status(200).send('EVENT_RECEIVED');
  } catch (error: any) {
    logger.error({ correlationId, action: 'webhook', step: 'process', error: error.message });
    return res.status(500).json({ success: false, message: 'Error processing webhook' });
  } finally {
    const latencyMs = Date.now() - startedAt;
    logger.info({ correlationId, action: 'webhook', status: 'finished', latency_ms: latencyMs });
  }
});

// Setup endpoint (auto/manual)
router.post('/setup', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = getCorrelationId(req);
  const startedAt = Date.now();
  try {
    const { restaurant_id, mode = 'auto', client_business_id, phone_number_id, display_phone_number } = req.body || {};
    const effectiveRestaurantId = restaurant_id || req.user?.restaurant_id;
    if (!effectiveRestaurantId) return res.status(400).json({ success: false, message: 'restaurant_id é obrigatório' });

    const data = await setupAgentIntegration({
      restaurantId: effectiveRestaurantId,
      mode,
      clientBusinessId: client_business_id,
      phoneNumberId: phone_number_id,
      displayPhoneNumber: display_phone_number,
      correlationId
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error({ correlationId, action: 'setup', step: 'ensure', error: error.message });
    if (String(error.message).includes('validation')) return res.status(400).json({ success: false, message: 'Dados inválidos' });
    if (String(error.message).includes('permission')) return res.status(403).json({ success: false, message: 'Escopos insuficientes' });
    if (String(error.message).includes('not_found')) return res.status(404).json({ success: false, message: 'Recurso não encontrado' });
    if (String(error.message).includes('pending_verification')) return res.status(422).json({ success: false, message: 'pending_verification' });
    return res.status(502).json({ success: false, message: 'Erro ao comunicar com Graph' });
  } finally {
    const latencyMs = Date.now() - startedAt;
    logger.info({ correlationId, action: 'setup', status: 'finished', latency_ms: latencyMs });
  }
});

// Verify number endpoint
router.post('/verify-number', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const correlationId = getCorrelationId(req);
  try {
    const { restaurant_id, code } = req.body || {};
    const effectiveRestaurantId = restaurant_id || req.user?.restaurant_id;
    if (!effectiveRestaurantId || !code) return res.status(400).json({ success: false, message: 'restaurant_id e code são obrigatórios' });
    const data = await agentVerifyNumber({ restaurantId: effectiveRestaurantId, code, correlationId });
    return res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ correlationId, action: 'verify-number', error: error.message });
    return res.status(500).json({ success: false, message: 'Erro interno' });
  }
});

async function processInboundMessage(message: any, value: any) {
  const from = message.from;
  const messageId = message.id;
  const messageType = message.type;
  const timestamp = message.timestamp;
  const phoneNumberId = value.metadata?.phone_number_id || value.metadata?.phone_number?.id;
  if (!phoneNumberId) return;

  const { data: integration } = await supabase
    .from('whatsapp_business_integrations')
    .select('restaurant_id, phone_number')
    .eq('phone_number_id', phoneNumberId)
    .single();
  if (!integration) return;

  const restaurant_id = integration.restaurant_id;
  let content: any = {};
  switch (messageType) {
    case 'text':
      content = { text: { body: message.text.body } };
      break;
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
      content = { media: message[messageType] };
      break;
    default:
      content = message[messageType] || {};
  }

  await supabase
    .from('whatsapp_messages')
    .insert({
      restaurant_id,
      message_id: messageId,
      to_phone: maskPhoneNumber(integration.phone_number),
      from_phone: maskPhoneNumber(from),
      message_type: messageType,
      content,
      status: 'delivered',
      direction: 'inbound',
      conversation_id: `${restaurant_id}_${from}`,
      metadata: {
        whatsapp_id: messageId,
        timestamp: new Date(parseInt(timestamp) * 1000).toISOString()
      }
    });

  await upsertContact(restaurant_id, from, value.contacts?.[0]);
}

async function processMessageStatus(status: any) {
  const messageId = status.id;
  const statusValue = status.status;
  await supabase
    .from('whatsapp_messages')
    .update({ status: statusValue })
    .eq('message_id', messageId);
}

async function upsertContact(restaurant_id: string, phone_number: string, contactInfo: any) {
  const contactData = {
    restaurant_id,
    phone_number: maskPhoneNumber(phone_number),
    name: contactInfo?.profile?.name || phone_number,
    last_message_at: new Date().toISOString(),
    status: 'active'
  };

  const { data: existing } = await supabase
    .from('whatsapp_contacts')
    .select('id, message_count')
    .eq('restaurant_id', restaurant_id)
    .eq('phone_number', maskPhoneNumber(phone_number) as string)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('whatsapp_contacts')
      .update({
        ...contactData,
        message_count: (existing.message_count || 0) + 1
      })
      .eq('id', (existing as any).id);
  } else {
    await supabase
      .from('whatsapp_contacts')
      .insert({
        ...contactData,
        message_count: 1
      });
  }
}

export default router; 