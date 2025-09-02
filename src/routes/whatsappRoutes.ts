import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';
import axios from 'axios';
import { WhatsAppController } from '../controllers/whatsappController';
import WhatsAppService from '../services/whatsappService';
import { META_URLS, BSP_CONFIG, META_CONFIG } from '../config/meta';

const router = Router();

// Tipos para as respostas da Meta API
interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface WhatsAppMessageResponse {
  messages: Array<{
    id: string;
  }>;
}

interface PhoneNumberResponse {
  data: Array<{
    id: string;
    display_phone_number: string;
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

/**
 * @swagger
 * /api/whatsapp/ensure-waba:
 *   post:
 *     summary: Método principal para integração WhatsApp
 *     description: |
 *       Executa o fluxo simplificado para garantir que o restaurante tenha uma integração WhatsApp funcional.
 *       Primeiro verifica se já existe integração válida (curto-circuito), caso contrário cria uma nova via BSP.
 *       Segue o fluxo prossiga-ou-crie (ENSURE_WABA).
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: Código de autorização OAuth (opcional se já tiver token)
 *               state:
 *                 type: string
 *                 description: Estado para validação CSRF (obrigatório se fornecer code)
 *     responses:
 *       200:
 *         description: Integração verificada ou criada com sucesso
 */
router.post('/ensure-waba', authenticateToken, WhatsAppController.ensureWABA);

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
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      console.log('Webhook verified');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  } else {
    return res.sendStatus(403);
  }
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
  try {
    const body = req.body;

    if (body.object) {
      if (body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages) {
        const changes = body.entry[0].changes[0];
        const value = changes.value;
        const messages = value.messages;

        for (const message of messages) {
          await processInboundMessage(message, value);
        }

        // Processar status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            await processMessageStatus(status);
          }
        }
      }

      return res.status(200).send('EVENT_RECEIVED');
    } else {
      return res.sendStatus(404);
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing webhook'
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/send:
 *   post:
 *     summary: Send WhatsApp message
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
 *               - message
 *             properties:
 *               to:
 *                 type: string
 *                 description: Phone number in international format
 *               message:
 *                 type: string
 *                 description: Message text to send
 *               message_type:
 *                 type: string
 *                 enum: [text, template]
 *                 default: text
 *     responses:
 *       200:
 *         description: Message sent successfully
 */
router.post('/send', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { to, message, message_type = 'text' } = req.body;
    const restaurant_id = req.user?.restaurant_id;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and message are required'
      });
    }

    if (!restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    // Buscar configurações do WhatsApp usando o serviço moderno
    const integration = await WhatsAppService.getActiveIntegration(restaurant_id);

    if (!integration) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp integration not found or inactive'
      });
    }

    // Enviar mensagem via Meta API
    const messagePayload = {
      messaging_product: 'whatsapp',
      to: to,
      type: message_type,
      text: {
        body: message
      }
    };

    const response = await axios.post(
      `${META_URLS.GRAPH_API}/${integration.phone_number_id}/messages`,
      messagePayload,
      {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const messageId = (response.data as WhatsAppMessageResponse).messages[0].id;

    // Salvar mensagem no banco
    const { error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        restaurant_id,
        message_id: messageId,
        to_phone: to,
        from_phone: integration.phone_number,
        message_type,
        content: { text: { body: message } },
        status: 'sent',
        direction: 'outbound',
        conversation_id: `${restaurant_id}_${to}`,
        metadata: {
          whatsapp_id: messageId,
          timestamp: new Date().toISOString()
        }
      });

    if (saveError) {
      console.error('Error saving message:', saveError);
    }

    // Criar ou atualizar contato
    await upsertContact(restaurant_id, to, null);

    return res.json({
      success: true,
      message_id: messageId,
      status: 'sent'
    });

  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
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
 * /api/whatsapp/oauth/authorize:
 *   get:
 *     summary: Generate OAuth URL for WhatsApp integration
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OAuth URL generated successfully
 */
router.get('/oauth/authorize', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const restaurantId = req.user?.restaurant_id;
    
    if (!userId || !restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'User or restaurant not found'
      });
    }
    
    // Generate OAuth URL with appropriate scopes
    const state = encodeURIComponent(JSON.stringify({
      user_id: userId,
      restaurant_id: restaurantId,
      flow: 'embedded_signup',
      nonce: Date.now().toString()
    }));
    
    const redirectUri = `${process.env.API_BASE_URL || 'https://api.angu.ai'}/api/whatsapp/oauth/callback-v2`;
    
    // Garantir que META_CONFIG.OAUTH_SCOPES é array e pode ser unido com join
    const scopes = Array.isArray(META_CONFIG.OAUTH_SCOPES) 
      ? META_CONFIG.OAUTH_SCOPES.join(',')
      : 'business_management,whatsapp_business_management,whatsapp_business_messaging';
    
    const authUrl = `${META_URLS.OAUTH_DIALOG}?` + new URLSearchParams({
      client_id: BSP_CONFIG.APP_ID,
      redirect_uri: redirectUri,
      state: state,
      scope: scopes,
      response_type: 'code'
    }).toString();
    
    return res.json({
      success: true,
      data: {
        authUrl,
        state
      }
    });
    
  } catch (error: any) {
    console.error('Error generating OAuth URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate OAuth URL',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/oauth/callback-v2:
 *   get:
 *     summary: OAuth callback endpoint
 *     tags: [WhatsApp]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Meta
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State parameter for CSRF protection
 *     responses:
 *       200:
 *         description: OAuth callback handled successfully
 */
router.get('/oauth/callback-v2', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Code and state parameters are required'
      });
    }
    
    // Call ensureWABA with received code and state
    // First decode state to get restaurant_id
    let stateData: { restaurant_id: string, user_id: string };
    
    try {
      stateData = JSON.parse(decodeURIComponent(state as string));
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid state parameter'
      });
    }
    
    // Ensure WABA with code
    // @ts-ignore - O método ensureWABA será adicionado ao tipo WhatsAppService
    const result = await WhatsAppService.ensureWABA({
      restaurant_id: stateData.restaurant_id,
      user_id: stateData.user_id,
      code: code as string,
      state: state as string
    });
    
    // Redirect to frontend with appropriate status
    const redirectUrl = `${process.env.FRONTEND_URL || 'https://angu.ai'}/settings/integrations?` + 
      new URLSearchParams({
        whatsapp: result.status,
        state: state as string
      }).toString();
    
    // Either redirect or return JSON based on what the frontend expects
    // For API testing, return JSON
    return res.json({
      success: true,
      message: 'OAuth process completed',
      status: result.status,
      redirect_url: redirectUrl,
      data: result
    });
    
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process OAuth callback',
      error: error.message
    });
  }
});

// Função auxiliar para processar mensagens recebidas
async function processInboundMessage(message: any, value: any) {
  try {
    const from = message.from;
    const messageId = message.id;
    const messageType = message.type;
    const timestamp = message.timestamp;

    // Buscar restaurant_id baseado no phone_number_id usando query direta
    // (o serviço atual não tem método para buscar por phone_number_id)
    const { data: integration } = await supabase
      .from('whatsapp_business_integrations')
      .select('restaurant_id, phone_number')
      .eq('phone_number_id', value.metadata.phone_number_id)
      .single();

    if (!integration) {
      console.error('Integration not found for phone_number_id:', value.metadata.phone_number_id);
      return;
    }

    const restaurant_id = integration.restaurant_id;

    // Extrair conteúdo da mensagem
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

    // Salvar mensagem no banco
    const { error: messageError } = await supabase
      .from('whatsapp_messages')
      .insert({
        restaurant_id,
        message_id: messageId,
        to_phone: integration.phone_number,
        from_phone: from,
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

    if (messageError) {
      console.error('Error saving inbound message:', messageError);
    }

    // Criar ou atualizar contato
    await upsertContact(restaurant_id, from, value.contacts?.[0]);

    console.log(`Processed inbound message from ${from} to restaurant ${restaurant_id}`);

  } catch (error) {
    console.error('Error processing inbound message:', error);
  }
}

// Função auxiliar para processar status de mensagens
async function processMessageStatus(status: any) {
  try {
    const messageId = status.id;
    const statusValue = status.status;

    // Atualizar status da mensagem
    const { error } = await supabase
      .from('whatsapp_messages')
      .update({ status: statusValue })
      .eq('message_id', messageId);

    if (error) {
      console.error('Error updating message status:', error);
    }

  } catch (error) {
    console.error('Error processing message status:', error);
  }
}

// Função auxiliar para criar ou atualizar contato
async function upsertContact(restaurant_id: string, phone_number: string, contactInfo: any) {
  try {
    const contactData = {
      restaurant_id,
      phone_number,
      name: contactInfo?.profile?.name || phone_number,
      last_message_at: new Date().toISOString(),
      status: 'active'
    };

    // Tentar atualizar primeiro
    const { data: existing } = await supabase
      .from('whatsapp_contacts')
      .select('id, message_count')
      .eq('restaurant_id', restaurant_id)
      .eq('phone_number', phone_number)
      .single();

    if (existing) {
      // Atualizar contato existente
      await supabase
        .from('whatsapp_contacts')
        .update({
          ...contactData,
          message_count: (existing.message_count || 0) + 1
        })
        .eq('id', existing.id);
    } else {
      // Criar novo contato
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

export default router;
