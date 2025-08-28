import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';
import axios from 'axios';
import crypto from 'crypto';
import { WhatsAppController } from '../controllers/whatsappController';
import WhatsAppService from '../services/whatsappService';

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
router.post('/setup', authenticateToken, WhatsAppController.setupIntegration);

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

// --- ROTAS EXISTENTES (mantidas para compatibilidade) ---

/**
 * @swagger
 * /api/whatsapp/oauth/callback:
 *   get:
 *     summary: WhatsApp OAuth callback endpoint
 *     tags: [WhatsApp]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: OAuth authorization code from Meta
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State parameter for CSRF protection
 *     responses:
 *       200:
 *         description: OAuth callback processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing authorization code
 *       500:
 *         description: Internal server error
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  console.log('🚀 OAuth Callback - Função iniciada');
  
  try {
    const { code, state } = req.query;

    console.log('🔍 OAuth Callback - Parâmetros recebidos:', { code: !!code, state: !!state });
    console.log('🔍 OAuth Callback - Variáveis de ambiente:', {
      FACEBOOK_APP_ID: !!process.env.FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET: !!process.env.FACEBOOK_APP_SECRET,
      API_BASE_URL: process.env.API_BASE_URL
    });

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    // Trocar o code por access_token
    console.log('🔍 OAuth Callback - Iniciando troca de code por token...');
    
    // Usar API_BASE_URL ou fallback para produção
    const baseUrl = process.env.API_BASE_URL || 'https://api.angu.ai';
    const redirectUri = `${baseUrl}/api/whatsapp/oauth/callback`;
    
    console.log('🔍 OAuth Callback - Redirect URI:', redirectUri);
    
    const tokenResponse = await axios.post('https://graph.facebook.com/v22.0/oauth/access_token', {
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      code: code,
      redirect_uri: redirectUri
    });

    console.log('🔍 OAuth Callback - Token response recebido:', { 
      success: !!tokenResponse.data, 
      hasAccessToken: !!(tokenResponse.data as any).access_token 
    });

    const { access_token, token_type, expires_in } = tokenResponse.data as MetaTokenResponse;

    // Calcular data de expiração
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

        // Buscar páginas do Facebook do usuário (como no exemplo funcional)
    console.log('🔍 OAuth Callback - Buscando páginas do Facebook...');
    
    // Primeiro, vamos verificar as permissões do token
    try {
      const permissionsResponse = await axios.get('https://graph.facebook.com/v22.0/me/permissions', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
      console.log('🔍 OAuth Callback - Permissões do token:', permissionsResponse.data);
    } catch (error: any) {
      console.warn('🔍 OAuth Callback - Não foi possível verificar permissões:', error.response?.data);
    }

    let pagesResponse: any;
    try {
      pagesResponse = await axios.get('https://graph.facebook.com/v22.0/me/accounts', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      console.log('🔍 OAuth Callback - Pages response recebido:', { 
        success: !!pagesResponse.data, 
        hasData: !!(pagesResponse.data as any).data,
        pagesCount: (pagesResponse.data as any).data?.length || 0,
        pagesData: JSON.stringify((pagesResponse.data as any).data, null, 2)
      });
    } catch (error: any) {
      console.error('🔍 OAuth Callback - Erro ao buscar páginas:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      throw error;
    }

    const pages = (pagesResponse.data as any).data;
    
    if (!pages || pages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No Facebook pages found. You need to have at least one Facebook page to use WhatsApp Business.'
      });
    }

    console.log('🔍 OAuth Callback - Páginas encontradas:', pages.length);

    // 🎯 FLUXO CORRETO: Buscar WABA conectado às páginas
    console.log('🔍 OAuth Callback - Iniciando busca por WABA...');
    
    let wabaId: string | null = null;
    let selectedPage: any = null;

    // Para cada página encontrada, verificar se tem WABA conectado
    for (const page of pages) {
      try {
        console.log(`🔍 OAuth Callback - Verificando página: ${page.name} (${page.id})`);
        
        // 🔑 PONTO CRÍTICO: Fazer a chamada EXATA que funciona
        const requestUrl = `https://graph.facebook.com/v22.0/${page.id}?fields=connected_whatsapp_business_account`;
        console.log(`🔍 OAuth Callback - Request: GET ${requestUrl}`);
        console.log(`🔍 OAuth Callback - Authorization: Bearer <USER_ACCESS_TOKEN>`);
        
        const wabaResponse = await axios.get(requestUrl, {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });

        console.log(`🔍 OAuth Callback - Response para ${page.name}:`, JSON.stringify(wabaResponse.data, null, 2));

        // Verificar se a resposta contém WABA conectado
        const responseData = wabaResponse.data as any;
        if (responseData.connected_whatsapp_business_account) {
          wabaId = responseData.connected_whatsapp_business_account.id;
          selectedPage = page;
          
          console.log('🔍 OAuth Callback - ✅ WABA ENCONTRADO!', {
            pageId: page.id,
            pageName: page.name,
            wabaId: wabaId
          });
          break;
        } else {
          console.log(`🔍 OAuth Callback - ❌ Página ${page.name} sem WABA conectado`);
        }
        
      } catch (error: any) {
        console.error(`🔍 OAuth Callback - Erro ao verificar página ${page.name}:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
        continue;
      }
    }

    if (!wabaId) {
      console.error('🔍 OAuth Callback - ❌ NENHUM WABA ENCONTRADO - Diagnóstico:', {
        pagesFound: pages?.length || 0,
        pagesWithTokens: pages?.filter((p: any) => !!p.access_token)?.length || 0,
        accessTokenValid: !!access_token
      });
      
      return res.status(400).json({
        success: false,
        message: `No WhatsApp Business Account found. Diagnóstico:
- Páginas encontradas: ${pages?.length || 0}
- Para conectar WhatsApp Business: 
  1. Acesse https://business.facebook.com/
  2. Vá em Configurações > Contas do WhatsApp Business
  3. Conecte uma conta WhatsApp Business à sua página
  4. Certifique-se de que você é admin da página e da WABA
- Se já tem WABA conectado, verifique as permissões do app no Facebook Developer Console`,
        debug: {
          pages_found: pages?.length || 0,
          token_permissions_needed: ['whatsapp_business_management', 'whatsapp_business_messaging', 'pages_read_engagement']
        }
      });
    }

    console.log('🔍 OAuth Callback - WhatsApp Business Account ID:', wabaId);

    // 🎯 PRÓXIMO PASSO: Buscar números de telefone do WABA
    console.log(`🔍 OAuth Callback - Buscando números de telefone do WABA: ${wabaId}`);
    
    const phoneRequestUrl = `https://graph.facebook.com/v22.0/${wabaId}/phone_numbers`;
    console.log(`🔍 OAuth Callback - Request: GET ${phoneRequestUrl}`);
    console.log(`🔍 OAuth Callback - Authorization: Bearer <USER_ACCESS_TOKEN>`);
    
    const phoneResponse = await axios.get(phoneRequestUrl, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    console.log('🔍 OAuth Callback - Phone numbers response:', JSON.stringify(phoneResponse.data, null, 2));

    const phoneData = phoneResponse.data as PhoneNumberResponse;
    const phoneNumber = phoneData.data[0];

    if (!phoneNumber) {
      console.error('🔍 OAuth Callback - ❌ Nenhum número de telefone encontrado no WABA');
      return res.status(400).json({
        success: false,
        message: 'No phone number found in WhatsApp Business Account'
      });
    }

    console.log('🔍 OAuth Callback - ✅ Número de telefone encontrado:', {
      phoneId: phoneNumber.id,
      phoneNumber: phoneNumber.display_phone_number
    });

    // Salvar integração usando o serviço moderno
    console.log('🔍 OAuth Callback - Salvando no banco de dados usando serviço moderno...');
    
    try {
      // Primeiro buscar restaurant_id baseado no state ou usar um padrão
      // Assumindo que o state contém informações do restaurante ou usar um método para descobrir
      // Por ora, vamos usar uma abordagem temporária para manter compatibilidade
      
      // Salvar na tabela antiga para compatibilidade
      const { error: tokenError } = await supabase
        .from('whatsapp_tokens')
        .insert({
          business_id: wabaId,
          token_data: {
            provider: 'meta',
            access_token,
            token_type: token_type || 'long_lived',
            expires_at: expiresAt.toISOString(),
            selected_page: selectedPage,
            waba_id: wabaId,
            phone_number_id: phoneNumber.id,
            phone_number: phoneNumber.display_phone_number,
            business_name: selectedPage?.name || 'WhatsApp Business Account',
            state: state,
            is_active: true
          },
          expires_at: expiresAt.toISOString()
        });

      if (tokenError) {
        console.warn('Aviso ao salvar token (pode já existir):', tokenError.message);
      }

      console.log('🔍 OAuth Callback - Token salvo, dados disponíveis para integração manual.');
      
    } catch (setupError) {
      console.error('Erro no setup automático:', setupError);
      // Continuamos mesmo se houver erro, pois os dados foram salvos
    }

    return res.json({
      success: true,
      message: 'WhatsApp integration completed successfully',
      redirect_url: `${process.env.FRONTEND_URL || 'https://angu.ai'}/settings/integrations?whatsapp=connected`
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during OAuth callback'
    });
  }
});

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message_id:
 *                   type: string
 *       400:
 *         description: Missing required parameters
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
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
      `https://graph.facebook.com/v22.0/${integration.phone_number_id}/messages`,
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