import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';
import axios from 'axios';
import crypto from 'crypto';
import { WhatsAppController } from '../controllers/whatsappController';
import WhatsAppService from '../services/whatsappService';
import { META_URLS, BSP_CONFIG } from '../config/meta';
import logger, { getCorrelationId, maskPhoneNumber, safe } from '../config/logger';
import { setupIntegration as setupAgentIntegration, verifyNumber as agentVerifyNumber } from '../services/whatsappIntegrationAgent';

const router = Router();
// Tipos para as respostas da Meta API
interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MetaBusinessResponse {
  data: Array<{
    id: string;
    name: string;
  }>;
}

interface WhatsAppMessageResponse {
  messages: Array<{
    id: string;
  }>;
}

interface WhatsAppBusinessAccountResponse {
  owned_whatsapp_business_accounts: {
    data: Array<{
      id: string;
    }>;
  };
}

interface PhoneNumberResponse {
  data: Array<{
    id: string;
    display_phone_number: string;
  }>;
}

interface OAuthTokenResponse {
  access_token: string;
  user_id: string;
  expires_in: number;
  token_type: string;
}

interface BusinessListResponse {
  data: Array<{
    id: string;
    name: string;
  }>;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     WhatsAppMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         message_id:
 *           type: string
 *         to_phone:
 *           type: string
 *         from_phone:
 *           type: string
 *         message_type:
 *           type: string
 *           enum: [text, template, media, location, contact, interactive]
 *         content:
 *           type: object
 *         status:
 *           type: string
 *           enum: [sent, delivered, read, failed, pending]
 *         direction:
 *           type: string
 *           enum: [inbound, outbound]
 *         conversation_id:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *     WhatsAppContact:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         phone_number:
 *           type: string
 *         name:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, inactive, blocked]
 *         last_message_at:
 *           type: string
 *           format: date-time
 *         message_count:
 *           type: number
 */

// --- NOVAS ROTAS USANDO O SERVIÇO MODERNO ---

/**
 * @swagger
 * /api/whatsapp/setup:
 *   post:
 *     summary: Setup WhatsApp integration using modern service
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wabaId
 *               - phoneNumberId
 *               - accessToken
 *             properties:
 *               wabaId:
 *                 type: string
 *               phoneNumberId:
 *                 type: string
 *               accessToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Integration setup successfully
 */
// OBS: substituído por agente de integração consolidado no serviço, mas mantendo controller atual
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
    logger.error({ correlationId, action: 'setup', step: 'ensureWABA', error: error.message });
    // Mapeamento de erros conforme especificação
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

/**
 * @swagger
 * /api/whatsapp/integration/status:
 *   get:
 *     summary: Get integration status using modern service
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 */
router.get('/integration/status', authenticateToken, WhatsAppController.getIntegrationStatus);

/**
 * @swagger
 * /api/whatsapp/template/send:
 *   post:
 *     summary: Send template message using modern service
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - template_name
 *               - language
 *             properties:
 *               to:
 *                 type: string
 *               template_name:
 *                 type: string
 *               language:
 *                 type: string
 *               parameters:
 *                 type: array
 *     responses:
 *       200:
 *         description: Template message sent successfully
 */
router.post('/template/send', authenticateToken, WhatsAppController.sendTemplateMessage);

// Removido fluxo OAuth legado daqui. Reutilizar /api/auth/meta/login e /api/auth/meta/callback

// Removido /api/whatsapp/oauth/callback legado. Usar /api/auth/meta/callback

/**
 * @swagger
 * /api/whatsapp/webhook:
 *   get:
 *     summary: WhatsApp webhook verification
 *     tags: [WhatsApp]
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification mode
 *       - in: query
 *         name: hub.challenge
 *         required: true
 *         schema:
 *           type: string
 *         description: Challenge token
 *       - in: query
 *         name: hub.verify_token
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification token
 *     responses:
 *       200:
 *         description: Webhook verified successfully
 *       403:
 *         description: Invalid verification token
 */
// Preserva exatamente a URL do webhook e comportamento de verificação
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token && mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * @swagger
 * /api/whatsapp/webhook:
 *   post:
 *     summary: Receive WhatsApp webhook events
 *     tags: [WhatsApp]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               object:
 *                 type: string
 *               entry:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       500:
 *         description: Internal server error
 */
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

// Helpers usados pelo webhook
async function processInboundMessage(message: any, value: any) {
  try {
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
  } catch (error) {
    console.error('Error processing inbound message:', error);
  }
}

async function processMessageStatus(status: any) {
  try {
    const messageId = status.id;
    const statusValue = status.status;

    await supabase
      .from('whatsapp_messages')
      .update({ status: statusValue })
      .eq('message_id', messageId);
  } catch (error) {
    console.error('Error processing message status:', error);
  }
}

async function upsertContact(restaurant_id: string, phone_number: string, contactInfo: any) {
  try {
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
      .eq('phone_number', phone_number)
      .single();

    if (existing) {
      await supabase
        .from('whatsapp_contacts')
        .update({
          ...contactData,
          message_count: (existing.message_count || 0) + 1
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('whatsapp_contacts')
        .insert({
          ...contactData,
          message_count: 1
        });
    }
  } catch (error) {
    console.error('Error upserting contact:', error);
  }
}

// Removido envio direto. Envio deve ser implementado por serviço dedicado e templates aprovados.

// New: verify-number
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

// Health endpoint
router.get('/health', async (req: Request, res: Response) => {
  const { restaurant_id } = req.query as any;
  if (!restaurant_id) return res.status(400).json({ success: false, message: 'restaurant_id é obrigatório' });
  const { data } = await supabase
    .from('whatsapp_business_integrations')
    .select('business_account_id, phone_number_id, metadata, updated_at')
    .eq('restaurant_id', restaurant_id)
    .single();
  return res.json({
    success: true,
    data: {
      status: data ? 'active' : 'inactive',
      waba_id: data?.business_account_id || null,
      phone_number_id: data?.phone_number_id || null,
      last_webhook_trigger: data?.updated_at || null,
      quality_rating: data?.metadata?.quality_rating || null
    }
  });
});

/**
 * @swagger
 * /api/whatsapp/messages:
 *   get:
 *     summary: Get WhatsApp messages for restaurant
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: phone_number
 *         schema:
 *           type: string
 *         description: Filter messages by phone number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Number of messages to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *           default: 0
 *         description: Number of messages to skip
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WhatsAppMessage'
 */
router.get('/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurant_id = req.user?.restaurant_id;
    const { phone_number, limit = 50, offset = 0 } = req.query;

    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    let query = supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (phone_number) {
      query = query.or(`to_phone.eq.${phone_number},from_phone.eq.${phone_number}`);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages'
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/contacts:
 *   get:
 *     summary: Get WhatsApp contacts for restaurant
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contacts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WhatsAppContact'
 */
router.get('/contacts', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurant_id = req.user?.restaurant_id;

    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    const { data, error } = await supabase
      .from('whatsapp_contacts')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .order('last_message_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve contacts'
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/integrations:
 *   get:
 *     summary: Get WhatsApp integrations for restaurant
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Integrations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/integrations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurant_id = req.user?.restaurant_id;

    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    const { data, error } = await supabase
      .from('whatsapp_business_integrations')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Get integrations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve integrations'
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/integrations/{id}/disconnect:
 *   post:
 *     summary: Disconnect WhatsApp integration
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Integration ID
 *     responses:
 *       200:
 *         description: Integration disconnected successfully
 *       400:
 *         description: Invalid integration ID
 *       500:
 *         description: Internal server error
 */
router.post('/integrations/:id/disconnect', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const restaurant_id = req.user?.restaurant_id;

    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Verificar se a integração pertence ao restaurante
    const { data: integration, error: getError } = await supabase
      .from('whatsapp_business_integrations')
      .select('*')
      .eq('id', id)
      .eq('restaurant_id', restaurant_id)
      .single();

    if (getError || !integration) {
      return res.status(400).json({
        success: false,
        message: 'Integration not found'
      });
    }

    // Desativar a integração
    const { error: updateError } = await supabase
      .from('whatsapp_business_integrations')
      .update({
        is_active: false,
        connection_status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    return res.json({
      success: true,
      message: 'Integration disconnected successfully'
    });

  } catch (error) {
    console.error('Disconnect integration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to disconnect integration'
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/oauth/status:
 *   get:
 *     summary: Check OAuth integration status
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     integration:
 *                       type: object
 */
router.get('/oauth/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const restaurant_id = req.user?.restaurant_id;

    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Usar o serviço moderno primeiro
    const integration = await WhatsAppService.getActiveIntegration(restaurant_id);

    if (integration) {
      return res.json({
        success: true,
        data: {
          connected: true,
          integration: integration
        }
      });
    }

    // Fallback para compatibilidade com sistema antigo
    const { data: oldIntegration, error } = await supabase
      .from('whatsapp_business_integrations')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true)
      .single();

    const isConnected = !error && oldIntegration;

    return res.json({
      success: true,
      data: {
        connected: isConnected,
        integration: isConnected ? oldIntegration : null
      }
    });

  } catch (error) {
    console.error('OAuth status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check OAuth status'
    });
  }
});

// --- NOVAS ROTAS PARA EMBEDDED SIGNUP META (BSP) ---

/**
 * @swagger
 * /api/whatsapp/signup/start:
 *   get:
 *     summary: Inicia o fluxo de Embedded Signup da Meta para WhatsApp Business
 *     description: |
 *       Gera URL de autorização OAuth com escopos mínimos para conectar WhatsApp Business.
 *       Esta rota inicia o processo de configuração de uma nova conta WhatsApp Business
 *       através do fluxo oficial da Meta de Embedded Signup.
 *       
 *       **Escopos solicitados:**
 *       - whatsapp_business_management
 *       - whatsapp_business_messaging
 *       - pages_show_list
 *       - pages_read_engagement
 *       
 *       **Fluxo:**
 *       1. Usuário chama esta rota
 *       2. Sistema gera URL de autorização Meta
 *       3. Usuário é redirecionado para Facebook
 *       4. Após autorização, Facebook redireciona para callback
 *       5. Sistema processa tokens e configura WhatsApp Business
 *     tags: [WhatsApp, Embedded Signup]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: URL de autorização gerada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     authUrl:
 *                       type: string
 *                       description: URL de autorização da Meta
 *                     state:
 *                       type: string
 *                       description: Estado criptografado para validação
 *       401:
 *         description: Token de autenticação inválido ou expirado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/signup/start', authenticateToken, WhatsAppController.startEmbeddedSignup);

/**
 * @swagger
 * /api/whatsapp/oauth/callback-v2:
 *   get:
 *     summary: WhatsApp OAuth callback endpoint (versão modernizada)
 *     description: |
 *       Endpoint de callback modernizado usando o novo serviço de Embedded Signup.
 *       Automatiza a criação de WABA para BSPs (Business Solution Providers).
 *     tags: [WhatsApp, Embedded Signup]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth authorization code from Meta
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: State parameter for CSRF protection
 *     responses:
 *       200:
 *         description: OAuth callback processed successfully
 *       400:
 *         description: Missing authorization code or state
 *       500:
 *         description: Internal server error
 */
router.get('/oauth/callback-v2', WhatsAppController.handleOAuthCallback);

/**
 * @swagger
 * /api/whatsapp/signup/status:
 *   get:
 *     summary: Verifica o status do processo de Embedded Signup
 *     description: |
 *       Retorna o status atual do processo de configuração do WhatsApp Business,
 *       incluindo informações sobre WABA, números de telefone e status de verificação.
 *       
 *       **Pode ser usado de duas formas:**
 *       1. Com autenticação (usuário logado) - busca pelo userId/restaurantId
 *       2. Com parâmetro state - busca pelo state do processo OAuth
 *     tags: [WhatsApp, Embedded Signup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State do processo OAuth (opcional, para busca sem autenticação)
 *     responses:
 *       200:
 *         description: Status verificado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [pending, oauth_completed, waba_detected, awaiting_number_verification, completed, failed]
 *                     waba_id:
 *                       type: string
 *                       description: ID da conta WhatsApp Business
 *                     phone_number_id:
 *                       type: string
 *                       description: ID do número de telefone
 *                     phone_number:
 *                       type: string
 *                       description: Número de telefone formatado
 *                     business_name:
 *                       type: string
 *                       description: Nome do negócio
 *                     business_id:
 *                       type: string
 *                       description: ID do Business Manager
 *                     verification_status:
 *                       type: string
 *                       description: Status da verificação
 *                     needs_phone_registration:
 *                       type: boolean
 *                       description: Se precisa registrar número de telefone
 *       401:
 *         description: Token de autenticação inválido ou expirado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/signup/status', WhatsAppController.getEmbeddedSignupStatus);

/**
 * @swagger
 * /api/whatsapp/signup/verify-phone:
 *   post:
 *   summary: Verifica um número de telefone para WhatsApp Business
 *   description: |
 *     Envia código de verificação via SMS/ligação para validar um número de telefone
 *     durante o processo de Embedded Signup.
 *   tags: [WhatsApp, Embedded Signup]
 *   security:
 *     - bearerAuth: []
 *   requestBody:
 *     required: true
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           required:
 *             - phone_number
 *           properties:
 *             phone_number:
 *               type: string
 *               description: Número de telefone a ser verificado (formato internacional)
 *               example: "+5511999999999"
 *   responses:
 *     200:
 *       description: Código de verificação enviado com sucesso
 *     400:
 *       description: Dados inválidos
 *     401:
 *       description: Token de autenticação inválido ou expirado
 *     500:
 *       description: Erro interno do servidor
 */
router.post('/signup/verify-phone', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const restaurantId = req.user?.restaurant_id;
    const { phone_number } = req.body;

    if (!userId || !restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuário ou restaurante não encontrado'
      });
    }

    if (!phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Número de telefone é obrigatório'
      });
    }

    const result = await WhatsAppService.verifyPhoneNumber(userId, restaurantId, phone_number);
    
    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Erro ao verificar número de telefone:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao verificar número',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/signup/register-phone:
 *   post:
 *     summary: Registra um número de telefone no WhatsApp Business
 *     description: |
 *       Registra um novo número de telefone na conta WhatsApp Business (WABA)
 *       durante o processo de Embedded Signup. Envia código de verificação via SMS/ligação.
 *     tags: [WhatsApp, Embedded Signup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone_number
 *             properties:
 *               phone_number:
 *                 type: string
 *                 description: Número de telefone a ser registrado (formato internacional)
 *                 example: "+5511999999999"
 *               pin:
 *                 type: string
 *                 description: PIN de 6 dígitos para verificação (opcional, usa padrão se não fornecido)
 *                 example: "152563"
 *     responses:
 *       200:
 *         description: Número registrado com sucesso, código de verificação enviado
 *       400:
 *         description: Dados inválidos ou WABA não encontrada
 *       401:
 *         description: Token de autenticação inválido ou expirado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/signup/register-phone', authenticateToken, WhatsAppController.registerPhoneNumber);

/**
 * @swagger
 * /api/whatsapp/signup/verify-code:
 *   post:
 *     summary: Confirma o código de verificação do número de telefone
 *     description: |
 *       Confirma o código de verificação recebido via SMS/ligação para validar
 *       o número de telefone durante o processo de Embedded Signup.
 *     tags: [WhatsApp, Embedded Signup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone_number_id
 *               - verification_code
 *             properties:
 *               phone_number_id:
 *                 type: string
 *                 description: ID do número de telefone sendo verificado
 *                 example: "1234567890123456"
 *               verification_code:
 *                 type: string
 *                 description: Código de verificação recebido
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Verificação confirmada com sucesso
 *       400:
 *         description: Dados inválidos ou código incorreto
 *       401:
 *         description: Token de autenticação inválido ou expirado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/signup/verify-code', authenticateToken, WhatsAppController.verifyPhoneNumberCode);

/**
 * @swagger
 * /api/whatsapp/signup/refresh-waba:
 *   post:
 *     summary: Força nova verificação de WABA após criação pelo usuário
 *     description: |
 *       Quando o usuário recebe status 'awaiting_waba_creation', ele deve criar
 *       uma WABA manualmente no Facebook Business Manager. Após criar,
 *       deve chamar esta rota para verificar novamente.
 *     tags: [WhatsApp, Embedded Signup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - state
 *             properties:
 *               state:
 *                 type: string
 *                 description: State do processo de signup
 *                 example: "encoded_state_string"
 *     responses:
 *       200:
 *         description: WABA verificada com sucesso
 *       400:
 *         description: State inválido ou dados faltando
 *       401:
 *         description: Token de autenticação inválido
 *       404:
 *         description: Processo de signup não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/signup/refresh-waba', authenticateToken, WhatsAppController.refreshWABAStatus);

/**
 * @swagger
 * /api/whatsapp/signup/confirm-verification:
 *   post:
 *   summary: Confirma o código de verificação do número de telefone (LEGACY)
 *   description: |
 *     Confirma o código de verificação recebido via SMS/ligação para validar
 *     o número de telefone durante o processo de Embedded Signup.
 *     
 *     **NOTA:** Esta rota é mantida para compatibilidade. Use /signup/verify-phone.
 *   tags: [WhatsApp, Embedded Signup]
 *   security:
 *     - bearerAuth: []
 *   requestBody:
 *     required: true
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           required:
 *             - phone_number
 *             - verification_code
 *           properties:
 *             phone_number:
 *               type: string
 *               description: Número de telefone sendo verificado
 *               example: "+5511999999999"
 *             verification_code:
 *               type: string
 *               description: Código de verificação recebido
 *               example: "123456"
 *   responses:
 *     200:
 *       description: Verificação confirmada com sucesso
 *     400:
 *       description: Dados inválidos ou código incorreto
 *     401:
 *       description: Token de autenticação inválido ou expirado
 *     500:
 *       description: Erro interno do servidor
 */
router.post('/signup/confirm-verification', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const restaurantId = req.user?.restaurant_id;
    const { phone_number, verification_code } = req.body;

    if (!userId || !restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuário ou restaurante não encontrado'
      });
    }

    if (!phone_number || !verification_code) {
      return res.status(400).json({
        success: false,
        message: 'Número de telefone e código de verificação são obrigatórios'
      });
    }

    const result = await WhatsAppService.confirmPhoneVerification(userId, restaurantId, phone_number, verification_code);
    
    return res.json({
      success: true,
      data: result
    });

  } catch (error: any) {
    console.error('Erro ao confirmar verificação:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao confirmar verificação',
      error: error.message
    });
  }
});

// --- NOVAS ROTAS PARA FLUXO COMPLETO DO WHATSAPP BUSINESS CLOUD API ---

/**
 * @swagger
 * /api/whatsapp/auth/exchange-token:
 *   post:
 *     summary: Troca authorization code por user access token
 *     description: |
 *       Endpoint para trocar o código de autorização OAuth por um access token válido.
 *       Esta é a etapa 3 do fluxo: após o usuário autorizar no Facebook, trocamos o code
 *       por um token que será usado para descobrir/criar WABA.
 *     tags: [WhatsApp, OAuth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - state
 *             properties:
 *               code:
 *                 type: string
 *                 description: Código de autorização recebido do Facebook
 *               state:
 *                 type: string
 *                 description: State parameter para validação CSRF
 *     responses:
 *       200:
 *         description: Token trocado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     user_id:
 *                       type: string
 *                     expires_in:
 *                       type: number
 *                     token_type:
 *                       type: string
 *       400:
 *         description: Código ou state inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/auth/exchange-token', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Código de autorização e state são obrigatórios'
      });
    }

    console.log('🔄 Iniciando troca de code por access token...', { 
      hasCode: !!code, 
      hasState: !!state,
      codeLength: code.length,
      stateLength: state.length
    });

    // Decodificar e validar state
    let stateData: any;
    try {
      stateData = JSON.parse(decodeURIComponent(state));
      console.log('🔄 State decodificado:', { 
        flow: stateData.flow, 
        userId: stateData.user_id,
        restaurantId: stateData.restaurant_id 
      });
    } catch (error) {
      console.error('🔄 ❌ Erro ao decodificar state:', error);
      return res.status(400).json({
        success: false,
        message: 'State inválido ou malformado'
      });
    }

    // Validar campos obrigatórios
    if (!stateData.user_id || !stateData.restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'State não contém user_id ou restaurant_id válidos'
      });
    }

    // Trocar code por access_token
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.API_BASE_URL || 'https://api.angu.ai'}/api/whatsapp/oauth/callback-v2`;

    if (!clientId || !clientSecret) {
      console.error('🔄 ❌ Credenciais do Facebook não configuradas');
      return res.status(500).json({
        success: false,
        message: 'Configuração do servidor incompleta'
      });
    }

    console.log('🔄 Trocando code por access_token...');
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code
    });

    const tokenResponse = await axios.get<OAuthTokenResponse>(
      `${META_URLS.OAUTH_ACCESS_TOKEN}?${tokenParams.toString()}`
    );

    const { access_token, token_type, expires_in } = tokenResponse.data;
    const expiresIn = expires_in || 3600; // 1 hora padrão

    console.log('🔄 ✅ Access token obtido com sucesso');

    // Salvar token no banco
    const tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
    
    // Salvar em meta_tokens
    await supabase
      .from('meta_tokens')
      .upsert({
        user_id: stateData.user_id,
        restaurant_id: stateData.restaurant_id,
        access_token: access_token,
        token_type: 'user',
        expires_at: tokenExpiresAt,
        integration_type: 'whatsapp_business',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,restaurant_id' });

    // Atualizar signup state
    await supabase
      .from('whatsapp_signup_states')
      .update({
        access_token: access_token,
        token_expires_at: tokenExpiresAt,
        status: 'token_exchanged'
      })
      .eq('state', state);

    // Log da operação
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: stateData.restaurant_id,
        step: 'token_exchange',
        strategy: 'oauth_flow',
        success: true,
        details: {
          user_id: stateData.user_id,
          token_type,
          expires_in: expiresIn,
          facebook_app_id: clientId
        }
      });

    console.log('🔄 ✅ Token salvo no banco e estado atualizado');

    return res.json({
      success: true,
      message: 'Token trocado com sucesso',
      data: {
        access_token,
        user_id: stateData.user_id,
        restaurant_id: stateData.restaurant_id,
        expires_in: expiresIn,
        token_type,
        next_step: 'discover_waba'
      }
    });

  } catch (error: any) {
    console.error('🔄 ❌ Erro na troca de token:', error.response?.data || error.message);
    
    // Log do erro
    try {
      const stateData = req.body.state ? JSON.parse(decodeURIComponent(req.body.state)) : {};
      await supabase
        .from('whatsapp_integration_logs')
        .insert({
          restaurant_id: stateData.restaurant_id || 'unknown',
          step: 'token_exchange',
          strategy: 'oauth_flow',
          success: false,
          error_message: error.response?.data?.error?.message || error.message,
          details: {
            error_code: error.response?.data?.error?.code,
            status: error.response?.status
          }
        });
    } catch (logError) {
      console.error('🔄 ❌ Erro ao salvar log:', logError);
    }

    return res.status(500).json({
      success: false,
      message: 'Erro ao trocar token de autorização',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// Minimal orchestrator entrypoint
/**
 * @swagger
 * /api/whatsapp/ensure:
 *   post:
 *     summary: Orquestrador ENSURE_WABA (prossegue-ou-cria)
 *     tags: [WhatsApp]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurant_id]
 *             properties:
 *               restaurant_id:
 *                 type: string
 *               code:
 *                 type: string
 *               state:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resultado do orquestrador
 */
router.post('/ensure', WhatsAppController.ensureWABA);

export default router;
