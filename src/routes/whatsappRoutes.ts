import { Router } from 'express';
import { Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';
import axios from 'axios';
import crypto from 'crypto';
import { WhatsAppController } from '../controllers/whatsappController';
import WhatsAppService from '../services/whatsappService';
import { META_URLS, BSP_CONFIG } from '../config/meta';
import WhatsAppIntegrationService from '../services/whatsappIntegrationService';

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

    console.log('🔍 OAuth Callback - Parâmetros recebidos:', { 
      hasCode: !!code, 
      hasState: !!state,
      codeLength: code ? (code as string).length : 0,
      stateLength: state ? (state as string).length : 0
    });
    console.log('🔍 OAuth Callback - Variáveis de ambiente:', {
      FACEBOOK_APP_ID: !!process.env.FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET: !!process.env.FACEBOOK_APP_SECRET,
      API_BASE_URL: process.env.API_BASE_URL
    });

    if (!code) {
      console.error('🔍 OAuth Callback - Código de autorização ausente');
      return res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      });
    }

    // Verificar se é um processo de Embedded Signup
    let isEmbeddedSignup = false;
    let stateData: any = null;
    
    if (state) {
      try {
        const decodedState = decodeURIComponent(state as string);
        console.log('🔍 OAuth Callback - State raw:', state);
        console.log('🔍 OAuth Callback - State decoded:', decodedState);
        
        stateData = JSON.parse(decodedState);
        isEmbeddedSignup = stateData.flow === 'embedded_signup';
        
        console.log('🔍 OAuth Callback - State parsed:', { 
          flow: stateData.flow, 
          isEmbeddedSignup,
          userId: stateData.user_id,
          restaurantId: stateData.restaurant_id,
          nonce: stateData.nonce
        });
        
        // Validar campos obrigatórios
        if (isEmbeddedSignup && (!stateData.user_id || !stateData.restaurant_id)) {
          console.error('🔍 OAuth Callback - State inválido: campos obrigatórios faltando');
          isEmbeddedSignup = false;
          stateData = null;
        }
        
      } catch (error) {
        console.log('🔍 OAuth Callback - Erro ao parsear state como JSON:', error);
        console.log('🔍 OAuth Callback - State recebido:', state);
        isEmbeddedSignup = false;
        stateData = null;
      }
    }

    // Trocar o code por access_token
    console.log('🔍 OAuth Callback - Iniciando troca de code por token...');
    
    // Usar API_BASE_URL ou fallback para produção
    const baseUrl = process.env.API_BASE_URL || 'https://api.angu.ai';
    const redirectUri = `${baseUrl}/api/whatsapp/oauth/callback`;
    
    console.log('🔍 OAuth Callback - Redirect URI:', redirectUri);
    console.log('🔍 OAuth Callback - URL para troca de token:', META_URLS.OAUTH_ACCESS_TOKEN);
    
    let tokenResponse: any;
    try {
      tokenResponse = await axios.post(META_URLS.OAUTH_ACCESS_TOKEN, {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        code: code,
        redirect_uri: redirectUri
      });

      console.log('🔍 OAuth Callback - Token response recebido:', { 
        success: !!tokenResponse.data, 
        hasAccessToken: !!(tokenResponse.data as any).access_token,
        responseKeys: Object.keys(tokenResponse.data || {}),
        rawResponse: tokenResponse.data
      });
    } catch (tokenError: any) {
      console.error('🔍 OAuth Callback - Erro na troca de token:', {
        status: tokenError.response?.status,
        statusText: tokenError.response?.statusText,
        data: tokenError.response?.data,
        message: tokenError.message
      });
      throw tokenError;
    }

    const { access_token, token_type, expires_in } = tokenResponse.data as MetaTokenResponse;

    console.log('🔍 OAuth Callback - Dados extraídos do token:', {
      hasAccessToken: !!access_token,
      tokenType: token_type,
      expiresInRaw: expires_in,
      expiresInType: typeof expires_in
    });

    // Calcular data de expiração com validação
    let expirationTime: number;
    try {
      expirationTime = expires_in && typeof expires_in === 'number' && expires_in > 0 
        ? Date.now() + (expires_in * 1000) 
        : Date.now() + (24 * 60 * 60 * 1000); // 24 horas como padrão
      
      console.log('🔍 OAuth Callback - Tempo de expiração calculado:', {
        expirationTime,
        dateNow: Date.now(),
        expiresInSeconds: expires_in
      });
      
    } catch (timeError) {
      console.error('🔍 OAuth Callback - Erro ao calcular tempo de expiração:', timeError);
      expirationTime = Date.now() + (24 * 60 * 60 * 1000); // Fallback seguro
    }
    
    let expiresAt: Date;
    try {
      expiresAt = new Date(expirationTime);
      console.log('🔍 OAuth Callback - Data de expiração criada:', {
        expiresAt: expiresAt.toISOString(),
        isValidDate: !isNaN(expiresAt.getTime())
      });
    } catch (dateError) {
      console.error('🔍 OAuth Callback - Erro ao criar data de expiração:', dateError);
      expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000)); // Fallback mais seguro
    }

    console.log('🔍 OAuth Callback - Token info final:', { 
      hasAccessToken: !!access_token, 
      tokenType: token_type, 
      expiresIn: expires_in,
      expiresAt: expiresAt.toISOString(),
      isEmbeddedSignup
    });

    // Se for Embedded Signup, processar fluxo específico
    if (isEmbeddedSignup && stateData?.user_id && stateData?.restaurant_id) {
      console.log('🔍 OAuth Callback - Processando fluxo de Embedded Signup...');
      
      try {
        // Salvar token OAuth primeiro (sempre funciona)
        console.log('🔍 OAuth Callback - Salvando token no signup_states...');
        try {
          await supabase
            .from('whatsapp_signup_states')
            .update({
              access_token: access_token,
              token_expires_at: expiresAt.toISOString()
            })
            .eq('state', state as string);
          
          console.log('🔍 OAuth Callback - ✅ Token salvo no signup_states');
        } catch (saveTokenError) {
          console.error('🔍 OAuth Callback - ❌ Erro ao salvar token no signup_states:', saveTokenError);
          throw saveTokenError;
        }

        // Salvar token OAuth do usuário para referência
        console.log('🔍 OAuth Callback - Salvando token no meta_tokens...');
        try {
          const { error: tokenError } = await supabase
            .from('meta_tokens')
            .upsert({
              user_id: stateData.user_id,
              access_token: access_token,
              expires_at: expiresAt.toISOString(),
              token_type: 'user',
              restaurant_id: stateData.restaurant_id,
              created_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

          if (tokenError) {
            console.warn('🔍 OAuth Callback - Aviso ao salvar token meta_tokens:', tokenError);
          } else {
            console.log('🔍 OAuth Callback - ✅ Token salvo no meta_tokens');
          }
        } catch (metaTokenError) {
          console.error('🔍 OAuth Callback - ❌ Erro ao salvar token no meta_tokens:', metaTokenError);
          // Não interromper o fluxo por este erro
        }

        // Tentar descobrir WABA
        console.log('🔍 OAuth Callback - Iniciando descoberta/criação de WABA...');
        try {
          const wabaId = await WhatsAppService.discoverOrCreateWABA(access_token, stateData.user_id, stateData.restaurant_id);
          
          // WABA encontrada ou criada - atualizar estado
          console.log('🔍 OAuth Callback - Atualizando estado com WABA...');
          try {
            await supabase
              .from('whatsapp_signup_states')
              .update({
                waba_id: wabaId,
                status: 'oauth_completed'
              })
              .eq('state', state as string);

            console.log('🔍 OAuth Callback - ✅ WABA encontrada/criada:', { wabaId, state: state as string });
            
            return res.json({
              success: true,
              message: 'WhatsApp Business OAuth processado com sucesso',
              data: {
                waba_id: wabaId,
                state: state as string,
                status: 'oauth_completed',
                next_step: 'register_phone',
                redirect_url: `${process.env.FRONTEND_URL || 'https://angu.ai'}/settings/integrations?whatsapp=oauth_completed&state=${encodeURIComponent(state as string)}`
              }
            });
          } catch (updateWabaError) {
            console.error('🔍 OAuth Callback - ❌ Erro ao atualizar estado com WABA:', updateWabaError);
            throw updateWabaError;
          }

        } catch (wabaError: any) {
          if (wabaError.message === 'WABA_NOT_FOUND') {
            console.log('🔍 OAuth Callback - ❌ WABA não encontrada - usuário precisa completar Embedded Signup');
            
            return res.json({
              success: true,
              message: 'OAuth processado. WhatsApp Business não encontrado.',
              data: {
                state: state as string,
                status: 'awaiting_waba_creation',
                next_step: 'complete_embedded_signup',
                redirect_url: `${process.env.FRONTEND_URL || 'https://angu.ai'}/settings/integrations?whatsapp=awaiting_waba&state=${encodeURIComponent(state as string)}`,
                instructions: {
                  title: 'Complete a configuração do WhatsApp Business',
                  description: 'Você autorizou com sucesso, mas ainda precisa criar ou conectar uma conta WhatsApp Business.',
                  steps: [
                    '1. Acesse o Facebook Business Manager',
                    '2. Vá para Configurações > Contas do WhatsApp Business', 
                    '3. Crie uma nova conta WhatsApp Business OU conecte uma existente à sua página',
                    '4. Após criar/conectar, volte aqui e clique em "Atualizar Status"'
                  ],
                  business_manager_url: 'https://business.facebook.com/settings/whatsapp-business-accounts',
                  note: 'A autorização OAuth foi bem-sucedida. Agora você precisa apenas vincular uma conta WhatsApp Business à sua página do Facebook.'
                }
              }
            });
          } else {
            console.error('🔍 OAuth Callback - ❌ Erro na descoberta de WABA:', wabaError);
            throw wabaError;
          }
        }

      } catch (error: any) {
        console.error('🔍 OAuth Callback - ❌ Erro no Embedded Signup:', error);
        
        // Marcar estado como failed
        try {
          await supabase
            .from('whatsapp_signup_states')
            .update({
              status: 'failed'
            })
            .eq('state', state as string);
          
          console.log('🔍 OAuth Callback - Estado marcado como failed');
        } catch (failError) {
          console.error('🔍 OAuth Callback - ❌ Erro ao marcar como failed:', failError);
        }
        
        return res.status(500).json({
          success: false,
          message: 'Erro ao processar Embedded Signup',
          error: error.message
        });
      }
    }

    // Buscar páginas do Facebook do usuário (como no exemplo funcional)
    console.log('🔍 OAuth Callback - Buscando páginas do Facebook...');
    
    // Primeiro, vamos verificar as permissões do token
    try {
      const permissionsResponse = await axios.get(`${META_URLS.GRAPH_API}/me/permissions`, {
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
      pagesResponse = await axios.get(`${META_URLS.GRAPH_API}/me/accounts`, {
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

    // 🎯 FLUXO CORRETO: Buscar WABA com estratégia dupla
    console.log('🔍 OAuth Callback - Iniciando busca por WABA...');
    
    let wabaId: string | null = null;
    let selectedPage: any = null;

    // ESTRATÉGIA 1: Buscar WABAs diretamente do usuário (fonte primária)
    console.log('🔍 OAuth Callback - ESTRATÉGIA 1: Buscando WABAs direto do usuário...');
    try {
      const directWabaResponse = await axios.get<{data: Array<{id: string; name: string; status: string}>}>(`${META_URLS.GRAPH_API}/me/whatsapp_business_accounts`, {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });

      console.log('🔍 OAuth Callback - Response WABAs diretos:', JSON.stringify(directWabaResponse.data, null, 2));

      if (directWabaResponse.data?.data && directWabaResponse.data.data.length > 0) {
        const directWaba = directWabaResponse.data.data[0];
        wabaId = directWaba.id;
        
        console.log('🔍 OAuth Callback - ✅ WABA ENCONTRADO VIA ESTRATÉGIA 1!', {
          wabaId: wabaId,
          wabaName: directWaba.name
        });
      } else {
        console.log('🔍 OAuth Callback - ❌ Nenhuma WABA encontrada via estratégia 1');
      }
    } catch (error: any) {
      console.log('🔍 OAuth Callback - ❌ Erro na estratégia 1:', error.response?.data || error.message);
    }

    // ESTRATÉGIA 2: Fallback via páginas (só se não encontrou na estratégia 1)
    if (!wabaId) {
      console.log('🔍 OAuth Callback - ESTRATÉGIA 2: Fallback via páginas...');
      
      // Para cada página encontrada, verificar se tem WABA conectado
      for (const page of pages) {
        try {
          console.log(`🔍 OAuth Callback - Verificando página: ${page.name} (${page.id})`);
          
          const requestUrl = `${META_URLS.GRAPH_API}/${page.id}?fields=connected_whatsapp_business_account`;
          console.log(`🔍 OAuth Callback - Request: GET ${requestUrl}`);
          
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
            
            console.log('🔍 OAuth Callback - ✅ WABA ENCONTRADO VIA ESTRATÉGIA 2!', {
              pageId: page.id,
              pageName: page.name,
              wabaId: wabaId
            });
            break;
          } else {
            console.log(`🔍 OAuth Callback - ❌ Página ${page.name} sem WABA conectado`);
          }
          
        } catch (error: any) {
          // Ignorar erro 100 (campo não existe) - é esperado quando página não tem WABA
          if (error.response?.data?.error?.code === 100) {
            console.log(`🔍 OAuth Callback - Página ${page.name} não possui campo connected_whatsapp_business_account (esperado)`);
          } else {
            console.error(`🔍 OAuth Callback - Erro ao verificar página ${page.name}:`, {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
              message: error.message
            });
          }
          continue;
        }
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
        message: "WhatsApp Business não encontrado",
        error_details: {
          title: "Configuração WhatsApp Business Necessária",
          description: "Para usar a integração do WhatsApp, você precisa conectar uma conta WhatsApp Business à sua página do Facebook.",
          steps: [
            {
              step: 1,
              title: "Acesse o Facebook Business Manager",
              action: "Clique aqui para abrir",
              url: "https://business.facebook.com/",
              description: "Faça login na sua conta do Facebook"
            },
            {
              step: 2,
              title: "Configure WhatsApp Business",
              action: "Ir para configurações",
              url: "https://business.facebook.com/settings/whatsapp-business-accounts",
              description: "Vá em Configurações > Contas do WhatsApp Business"
            },
            {
              step: 3,
              title: "Conecte à sua página",
              action: "Conectar WhatsApp",
              url: "https://business.facebook.com/settings/pages",
              description: "Conecte uma conta WhatsApp Business à sua página"
            },
            {
              step: 4,
              title: "Verifique permissões",
              action: "Verificar app",
              url: "https://developers.facebook.com/apps/3246838805460539/settings/basic/",
              description: "Certifique-se de que você é admin da página e da WABA"
            }
          ],
          troubleshooting: {
            title: "Solução de Problemas",
            common_issues: [
              "Página do Facebook não encontrada",
              "WhatsApp Business não conectado",
              "Permissões insuficientes no app",
              "Token de acesso expirado"
            ],
            support_links: [
              {
                title: "Documentação Meta",
                url: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              },
              {
                title: "Central de Ajuda WhatsApp Business",
                url: "https://business.whatsapp.com/support"
              }
            ]
          },
          technical_info: {
            pages_found: pages?.length || 0,
            token_permissions_needed: ['whatsapp_business_management', 'whatsapp_business_messaging', 'pages_read_engagement'],
            api_version: 'v22.0',
            required_scopes: ['whatsapp_business_management', 'whatsapp_business_messaging']
          }
        }
      });
    }

    console.log('🔍 OAuth Callback - WhatsApp Business Account ID:', wabaId);

    // 🎯 PRÓXIMO PASSO: Buscar números de telefone do WABA
    console.log(`🔍 OAuth Callback - Buscando números de telefone do WABA: ${wabaId}`);
    
            const phoneRequestUrl = `${META_URLS.GRAPH_API}/${wabaId}/phone_numbers`;
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

/**
 * @swagger
 * /api/whatsapp/waba/discover-or-create:
 *   post:
 *     summary: Descobre WABA existente ou inicia processo de criação
 *     description: |
 *       ESTRATÉGIA 1: Busca WABA existente do usuário usando o access token.
 *       Se não encontrar, inicia o processo de criação automática via BSP.
 *       
 *       **Fluxo:**
 *       1. Busca businesses do usuário
 *       2. Para cada business, verifica se tem WABA conectado
 *       3. Se não encontrar, inicia criação automática
 *     tags: [WhatsApp, WABA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - access_token
 *               - restaurant_id
 *             properties:
 *               access_token:
 *                 type: string
 *                 description: User access token do Facebook
 *               restaurant_id:
 *                 type: string
 *                 description: ID do restaurante
 *     responses:
 *       200:
 *         description: WABA encontrada ou processo de criação iniciado
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/waba/discover-or-create', async (req: Request, res: Response) => {
  try {
    const { access_token, restaurant_id } = req.body;

    if (!access_token || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Access token e restaurant_id são obrigatórios'
      });
    }

    console.log('🔍 Iniciando descoberta/criação de WABA...', { restaurant_id });

    // Buscar user_id baseado no restaurant_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .single();

    if (userError || !userData) {
      return res.status(400).json({
        success: false,
        message: 'Usuário não encontrado para este restaurante'
      });
    }

    const userId = userData.id;

    // ESTRATÉGIA 1: Buscar WABA existente
    try {
      const wabaId = await WhatsAppService.discoverWABA(userId, restaurant_id, access_token);
      
      console.log('🔍 ✅ WABA encontrada via estratégia 1:', wabaId);

      // Log do sucesso
      await supabase
        .from('whatsapp_integration_logs')
        .insert({
          restaurant_id,
          step: 'waba_discovery',
          strategy: 'existing_waba',
          success: true,
          details: { waba_id: wabaId, strategy: 'existing_waba' }
        });

      return res.json({
        success: true,
        message: 'WABA encontrada com sucesso',
        data: {
          waba_id: wabaId,
          status: 'found',
          strategy: 'existing_waba',
          next_step: 'register_phone'
        }
      });

    } catch (discoveryError: any) {
      console.log('🔍 ❌ WABA não encontrada, iniciando criação automática...');

      if (discoveryError.message === 'WABA_NOT_FOUND' || discoveryError.message === 'WABA_CREATION_FAILED') {
        // Iniciar processo de criação automática
        return res.json({
          success: true,
          message: 'WABA não encontrada, iniciando criação automática',
          data: {
            status: 'not_found',
            strategy: 'auto_creation',
            next_step: 'create_waba',
            message: 'Iniciando criação automática via BSP...'
          }
        });
      } else {
        throw discoveryError;
      }
    }

  } catch (error: any) {
    console.error('🔍 ❌ Erro na descoberta/criação de WABA:', error.response?.data || error.message);
    
    // Log do erro
    try {
      await supabase
        .from('whatsapp_integration_logs')
        .insert({
          restaurant_id: req.body.restaurant_id || 'unknown',
          step: 'waba_discovery',
          strategy: 'discovery_flow',
          success: false,
          error_message: error.response?.data?.error?.message || error.message,
          details: {
            error_code: error.response?.data?.error?.code,
            status: error.response?.status
          }
        });
    } catch (logError) {
      console.error('🔍 ❌ Erro ao salvar log:', logError);
    }

    return res.status(500).json({
      success: false,
      message: 'Erro ao descobrir/criar WABA',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/waba/create-strategies:
 *   post:
 *     summary: Implementa todas as estratégias de criação de WABA
 *     description: |
 *       Executa 5 estratégias diferentes para criar uma WABA automaticamente:
 *       
 *       **Estratégias implementadas:**
 *       1. client_whatsapp_applications
 *       2. whatsapp_business_accounts direto
 *       3. applications
 *       4. Fluxo oficial Meta
 *       5. Endpoint global
 *       
 *       Cada estratégia tenta por 30 segundos antes de falhar.
 *     tags: [WhatsApp, WABA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *             - access_token
 *             - restaurant_id
 *             properties:
 *               access_token:
 *                 type: string
 *                 description: User access token do Facebook
 *               restaurant_id:
 *                 type: string
 *                 description: ID do restaurante
 *     responses:
 *       200:
 *         description: WABA criada com sucesso ou todas as estratégias falharam
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/waba/create-strategies', async (req: Request, res: Response) => {
  try {
    const { access_token, restaurant_id } = req.body;

    if (!access_token || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Access token e restaurant_id são obrigatórios'
      });
    }

    console.log('🚀 Iniciando criação de WABA com múltiplas estratégias...', { restaurant_id });

    // Buscar user_id e business_id
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('restaurant_id', restaurant_id)
      .single();

    if (!userData) {
      return res.status(400).json({
        success: false,
        message: 'Usuário não encontrado'
      });
    }

    const userId = userData.id;

    // Buscar business_id do usuário
    let businessId: string;
    try {
      const businessResponse = await axios.get<BusinessListResponse>(
        `${META_URLS.GRAPH_API}/me/businesses?fields=id,name`,
        {
          headers: { 'Authorization': `Bearer ${access_token}` }
        }
      );

      const businesses = businessResponse.data?.data || [];
      if (businesses.length === 0) {
        throw new Error('Nenhum Business encontrado para o usuário');
      }

      businessId = businesses[0].id;
      console.log('🚀 Business ID encontrado:', { id: businessId, name: businesses[0].name });

    } catch (businessError: any) {
      console.error('🚀 ❌ Erro ao buscar business:', businessError.message);
      return res.status(400).json({
        success: false,
        message: 'Não foi possível encontrar um Business Manager válido',
        error: businessError.message
      });
    }

    // Verificar se temos token BSP
    const bspToken = BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN;
    if (!bspToken) {
      console.error('🚀 ❌ Token BSP não configurado');
      return res.status(500).json({
        success: false,
        message: 'Configuração BSP incompleta - token não encontrado'
      });
    }

    // ESTRATÉGIA 1: client_whatsapp_applications
    console.log('🚀 ESTRATÉGIA 1: Tentando client_whatsapp_applications...');
    try {
      const strategy1Result = await WhatsAppIntegrationService.createViaClientWhatsApp(businessId, bspToken, userId, restaurant_id);
      if (strategy1Result.success) {
        return res.json({
          success: true,
          message: 'WABA criada com sucesso via estratégia 1',
          data: {
            waba_id: strategy1Result.waba_id,
            strategy: 'client_whatsapp_applications',
            next_step: 'polling_verification'
          }
        });
      }
    } catch (error: any) {
      console.log('🚀 ❌ Estratégia 1 falhou:', error.message);
      await WhatsAppIntegrationService.logStrategyFailure('client_whatsapp_applications', error, restaurant_id);
    }

    // ESTRATÉGIA 2: whatsapp_business_accounts direto
    console.log('🚀 ESTRATÉGIA 2: Tentando whatsapp_business_accounts...');
    try {
      const strategy2Result = await WhatsAppIntegrationService.createViaDirectWABA(businessId, bspToken, userId, restaurant_id);
      if (strategy2Result.success) {
        return res.json({
          success: true,
          message: 'WABA criada com sucesso via estratégia 2',
          data: {
            waba_id: strategy2Result.waba_id,
            strategy: 'whatsapp_business_accounts',
            next_step: 'polling_verification'
          }
        });
      }
    } catch (error: any) {
      console.log('🚀 ❌ Estratégia 2 falhou:', error.message);
      await WhatsAppIntegrationService.logStrategyFailure('whatsapp_business_accounts', error, restaurant_id);
    }

    // ESTRATÉGIA 3: applications
    console.log('🚀 ESTRATÉGIA 3: Tentando applications...');
    try {
      const strategy3Result = await WhatsAppIntegrationService.createViaApplications(businessId, bspToken, userId, restaurant_id);
      if (strategy3Result.success) {
        return res.json({
          success: true,
          message: 'WABA criada com sucesso via estratégia 3',
          data: {
            waba_id: strategy3Result.waba_id,
            strategy: 'applications',
            next_step: 'polling_verification'
          }
        });
      }
    } catch (error: any) {
      console.log('🚀 ❌ Estratégia 3 falhou:', error.message);
      await WhatsAppIntegrationService.logStrategyFailure('applications', error, restaurant_id);
    }

    // ESTRATÉGIA 4: Fluxo oficial Meta
    console.log('🚀 ESTRATÉGIA 4: Tentando fluxo oficial Meta...');
    try {
      const strategy4Result = await WhatsAppIntegrationService.createViaOfficialFlow(businessId, bspToken, userId, restaurant_id);
      if (strategy4Result.success) {
        return res.json({
          success: true,
          message: 'WABA criada com sucesso via estratégia 4',
          data: {
            waba_id: strategy4Result.waba_id,
            strategy: 'official_flow',
            next_step: 'polling_verification'
          }
        });
      }
    } catch (error: any) {
      console.log('🚀 ❌ Estratégia 4 falhou:', error.message);
      await WhatsAppIntegrationService.logStrategyFailure('official_flow', error, restaurant_id);
    }

    // ESTRATÉGIA 5: Endpoint global
    console.log('🚀 ESTRATÉGIA 5: Tentando endpoint global...');
    try {
      const strategy5Result = await WhatsAppIntegrationService.createViaGlobalEndpoint(bspToken, userId, restaurant_id);
      if (strategy5Result.success) {
        return res.json({
          success: true,
          message: 'WABA criada com sucesso via estratégia 5',
          data: {
            waba_id: strategy5Result.waba_id,
            strategy: 'global_endpoint',
            next_step: 'polling_verification'
          }
        });
      }
    } catch (error: any) {
      console.log('🚀 ❌ Estratégia 5 falhou:', error.message);
      await WhatsAppIntegrationService.logStrategyFailure('global_endpoint', error, restaurant_id);
    }

    // Todas as estratégias falharam
    console.log('🚀 ❌ Todas as estratégias falharam');
    
    // Log final de falha
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id,
        step: 'waba_creation',
        strategy: 'all_strategies_failed',
        success: false,
        error_message: 'Todas as 5 estratégias de criação falharam',
        details: {
          business_id: businessId,
          strategies_tried: [
            'client_whatsapp_applications',
            'whatsapp_business_accounts',
            'applications',
            'official_flow',
            'global_endpoint'
          ]
        }
      });

    return res.json({
      success: false,
      message: 'Todas as estratégias de criação falharam',
      data: {
        status: 'all_strategies_failed',
        business_id: businessId,
        next_step: 'manual_creation',
        message: 'Complete a criação manualmente no Facebook Business Manager',
        retry_after: 300 // 5 minutos
      }
    });

  } catch (error: any) {
    console.error('🚀 ❌ Erro geral na criação de WABA:', error.response?.data || error.message);
    
    // Log do erro
    try {
      await supabase
        .from('whatsapp_integration_logs')
        .insert({
          restaurant_id: req.body.restaurant_id || 'unknown',
          step: 'waba_creation',
          strategy: 'creation_flow',
          success: false,
          error_message: error.response?.data?.error?.message || error.message,
          details: {
            error_code: error.response?.data?.error?.code,
            status: error.response?.status
          }
        });
    } catch (logError) {
      console.error('🚀 ❌ Erro ao salvar log:', logError);
    }

    return res.status(500).json({
      success: false,
      message: 'Erro interno na criação de WABA',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/waba/polling-system:
 *   post:
 *     summary: Sistema de polling para verificar criação de WABA
 *     description: |
 *       Sistema robusto de polling que verifica se a WABA foi criada com sucesso.
 *       Executa até 10 tentativas com intervalo de 3 segundos entre cada uma.
 *       
 *       **Características:**
 *       - 10 tentativas máximas
 *       - 3 segundos de intervalo
 *       - Verificação via múltiplos endpoints
 *       - Logs detalhados de cada tentativa
 *     tags: [WhatsApp, WABA]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - business_id
 *               - user_token
 *               - restaurant_id
 *             properties:
 *               business_id:
 *                 type: string
 *                 description: ID do Business Manager
 *               user_token:
 *                 type: string
 *                 description: User access token do Facebook
 *               restaurant_id:
 *                 type: string
 *                 description: ID do restaurante
 *               max_attempts:
 *                 type: number
 *                 default: 10
 *                 description: Número máximo de tentativas
 *     responses:
 *       200:
 *         description: Polling concluído com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/waba/polling-system', async (req: Request, res: Response) => {
  try {
    const { business_id, user_token, restaurant_id, max_attempts = 10 } = req.body;

    if (!business_id || !user_token || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'business_id, user_token e restaurant_id são obrigatórios'
      });
    }

    console.log('⏳ Iniciando sistema de polling para WABA...', { 
      business_id, 
      restaurant_id, 
      max_attempts 
    });

    // Log do início do polling
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id,
        step: 'polling_system',
        strategy: 'polling_verification',
        success: true,
        details: {
          business_id,
          max_attempts,
          start_time: new Date().toISOString()
        }
      });

    const pollingResult = await WhatsAppIntegrationService.pollForWABA(business_id, user_token, restaurant_id, max_attempts);

    if (pollingResult.found) {
      console.log('⏳ ✅ WABA encontrada via polling:', pollingResult.waba_id);
      
      // Log do sucesso
      await supabase
        .from('whatsapp_integration_logs')
        .insert({
          restaurant_id,
          step: 'polling_system',
          strategy: 'polling_verification',
          success: true,
          details: {
            waba_id: pollingResult.waba_id,
            attempts: pollingResult.attempts,
            end_time: new Date().toISOString()
          }
        });

      return res.json({
        success: true,
        message: 'WABA encontrada com sucesso via polling',
        data: {
          waba_id: pollingResult.waba_id,
          attempts: pollingResult.attempts,
          status: 'found',
          next_step: 'register_phone'
        }
      });
    } else {
      console.log('⏳ ❌ WABA não encontrada após todas as tentativas');
      
      // Log da falha
      await supabase
        .from('whatsapp_integration_logs')
        .insert({
          restaurant_id,
          step: 'polling_system',
          strategy: 'polling_verification',
          success: false,
          error_message: 'WABA não encontrada após todas as tentativas de polling',
          details: {
            business_id,
            attempts: pollingResult.attempts,
            end_time: new Date().toISOString()
          }
        });

      return res.json({
        success: false,
        message: 'WABA não encontrada após polling',
        data: {
          status: 'not_found',
          attempts: pollingResult.attempts,
          next_step: 'manual_verification',
          message: 'Verifique manualmente no Facebook Business Manager'
        }
      });
    }

  } catch (error: any) {
    console.error('⏳ ❌ Erro no sistema de polling:', error.response?.data || error.message);
    
    // Log do erro
    try {
      await supabase
        .from('whatsapp_integration_logs')
        .insert({
          restaurant_id: req.body.restaurant_id || 'unknown',
          step: 'polling_system',
          strategy: 'polling_verification',
          success: false,
          error_message: error.response?.data?.error?.message || error.message,
          details: {
            error_code: error.response?.data?.error?.code,
            status: error.response?.status
          }
        });
    } catch (logError) {
      console.error('⏳ ❌ Erro ao salvar log:', logError);
    }

    return res.status(500).json({
      success: false,
      message: 'Erro interno no sistema de polling',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/waba/complete-flow:
 *   post:
 *     summary: Fluxo principal que orquestra toda a integração
 *     description: |
 *       Endpoint principal que executa o fluxo completo de integração:
 *       1. Troca code por token
 *       2. Descobre business_id
 *       3. Busca WABA existente
 *       4. Cria WABA se necessário (5 estratégias)
 *       5. Sistema de polling
 *       6. Finaliza integração
 *     tags: [WhatsApp, Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - state
 *               - restaurant_id
 *             properties:
 *               code:
 *                 type: string
 *                 description: Código de autorização OAuth
 *               state:
 *                 type: string
 *                 description: State parameter
 *               restaurant_id:
 *                 type: string
 *                 description: ID do restaurante
 *     responses:
 *       200:
 *         description: Integração concluída com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/waba/complete-flow', async (req: Request, res: Response) => {
  try {
    const { code, state, restaurant_id } = req.body;

    if (!code || !state || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'code, state e restaurant_id são obrigatórios'
      });
    }

    console.log('🎯 Iniciando fluxo completo de integração WhatsApp...', { restaurant_id });

    // Log do início do fluxo
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id,
        step: 'complete_flow',
        strategy: 'full_integration',
        success: true,
        details: {
          start_time: new Date().toISOString(),
          has_code: !!code,
          has_state: !!state
        }
      });

    // 1. Trocar code por token
    console.log('🎯 Passo 1: Trocando code por token...');
    const tokenData = await WhatsAppIntegrationService.exchangeCodeForToken(code, state, restaurant_id);
    
    if (!tokenData.success) {
      throw new Error(`Falha na troca de token: ${tokenData.message}`);
    }

    console.log('🎯 ✅ Token obtido com sucesso');

    // 2. Descobrir business_id
    console.log('🎯 Passo 2: Descobrindo business_id...');
    const businessId = await WhatsAppIntegrationService.discoverBusinessId(tokenData.data!.access_token);
    
    if (!businessId) {
      throw new Error('Não foi possível encontrar um Business Manager válido');
    }

    console.log('🎯 ✅ Business ID encontrado:', businessId);

    // 3. ESTRATÉGIA 1: Buscar WABA existente
    console.log('🎯 Passo 3: Buscando WABA existente...');
    const existingWABA = await WhatsAppIntegrationService.discoverExistingWABA(tokenData.data!.access_token, restaurant_id);
    
    if (existingWABA.found && existingWABA.waba_id) {
      console.log('🎯 ✅ WABA existente encontrada:', existingWABA.waba_id);
      
      // Finalizar integração
      const finalResult = await WhatsAppIntegrationService.finalizeIntegration(
        existingWABA.waba_id, 
        tokenData.data!, 
        restaurant_id
      );
      
      return res.json({
        success: true,
        message: 'Integração concluída com WABA existente',
        data: {
          waba_id: existingWABA.waba_id,
          strategy: 'existing_waba',
          status: 'completed',
          integration_id: finalResult.integration_id
        }
      });
    }

    // 4. ESTRATÉGIA 2: Tentar criar WABA (5 tentativas)
    console.log('🎯 Passo 4: Tentando criar WABA automaticamente...');
    
    const bspToken = BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN;
    if (!bspToken) {
      throw new Error('Token BSP não configurado');
    }

    let wabaResult = null;
    const strategies = [
      { name: 'client_whatsapp_applications', fn: WhatsAppIntegrationService.createViaClientWhatsApp },
      { name: 'whatsapp_business_accounts', fn: WhatsAppIntegrationService.createViaDirectWABA },
      { name: 'applications', fn: WhatsAppIntegrationService.createViaApplications },
      { name: 'official_flow', fn: WhatsAppIntegrationService.createViaOfficialFlow },
      { name: 'global_endpoint', fn: WhatsAppIntegrationService.createViaGlobalEndpoint }
    ];

    // Tentar cada estratégia
    for (const strategy of strategies) {
      try {
        console.log(`🎯 Tentando estratégia: ${strategy.name}...`);
        
        wabaResult = await strategy.fn(businessId, bspToken, tokenData.data!.user_id, restaurant_id);
        
        if (wabaResult.success) {
          console.log(`🎯 ✅ WABA criada via estratégia: ${strategy.name}`);
          
          // Polling e finalização
                  const finalResult = await WhatsAppIntegrationService.pollAndFinalize(
          wabaResult, 
          tokenData.data!, 
          restaurant_id,
          strategy.name
        );
          
          return res.json({
            success: true,
            message: `Integração concluída via estratégia: ${strategy.name}`,
            data: {
              waba_id: wabaResult.waba_id,
              strategy: strategy.name,
              status: 'completed',
              integration_id: finalResult.integration_id
            }
          });
        }
      } catch (error: any) {
        console.log(`🎯 ❌ Estratégia ${strategy.name} falhou:`, error.message);
        await WhatsAppIntegrationService.logStrategyFailure(strategy.name, error, restaurant_id);
        continue;
      }
    }

    // 5. Se todas falharam, marcar como awaiting_waba_creation
    console.log('🎯 ❌ Todas as estratégias falharam');
    
    // Log final de falha
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id,
        step: 'complete_flow',
        strategy: 'all_strategies_failed',
        success: false,
        error_message: 'Todas as estratégias de criação falharam',
        details: {
          business_id: businessId,
          strategies_tried: strategies.map(s => s.name),
          end_time: new Date().toISOString()
        }
      });

    return res.json({
      success: false,
      message: 'Todas as estratégias de criação falharam',
      data: {
        status: 'awaiting_waba_creation',
        business_id: businessId,
        next_step: 'manual_creation',
        message: 'Complete a criação manualmente no Facebook Business Manager',
        retry_after: 300 // 5 minutos
      }
    });

  } catch (error: any) {
    console.error('🎯 ❌ Erro no fluxo completo:', error.response?.data || error.message);
    
    // Log do erro
    try {
      await supabase
        .from('whatsapp_integration_logs')
        .insert({
          restaurant_id: req.body.restaurant_id || 'unknown',
          step: 'complete_flow',
          strategy: 'full_integration',
          success: false,
          error_message: error.response?.data?.error?.message || error.message,
          details: {
            error_code: error.response?.data?.error?.code,
            status: error.response?.status
          }
        });
    } catch (logError) {
      console.error('🎯 ❌ Erro ao salvar log:', logError);
    }

    return res.status(500).json({
      success: false,
      message: 'Erro interno no fluxo completo',
      error: error.response?.data?.error?.message || error.message
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

// ============================================================================
// ENDPOINTS CORRIGIDOS PARA FLUXO COMPLETO DE INTEGRAÇÃO WHATSAPP BUSINESS CLOUD API
// ============================================================================

/**
 * @swagger
 * /api/whatsapp/auth/exchange-token:
 *   post:
 *     summary: Troca authorization code por user access token
 *     tags: [WhatsApp Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, state]
 *             properties:
 *               code:
 *                 type: string
 *                 description: Authorization code do Facebook
 *               state:
 *                 type: string
 *                 description: State parameter para validação
 *               restaurant_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *     responses:
 *       200:
 *         description: Token trocado com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
router.post('/auth/exchange-token', async (req: Request, res: Response) => {
  try {
    const { code, state, restaurant_id } = req.body;

    if (!code || !state || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Code, state e restaurant_id são obrigatórios'
      });
    }

    console.log('🔄 Iniciando troca de token...');

    const tokenResult = await WhatsAppIntegrationService.exchangeCodeForToken(
      code, 
      state, 
      restaurant_id
    );

    if (!tokenResult.success) {
      return res.status(400).json({
        success: false,
        message: tokenResult.message,
        error: tokenResult.error
      });
    }

    return res.json({
      success: true,
      message: 'Token trocado com sucesso',
      data: tokenResult.data
    });

  } catch (error: any) {
    console.error('🔄 ❌ Erro na troca de token:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno na troca de token',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/waba/discover-or-create:
 *   post:
 *     summary: Descobre WABA existente ou inicia processo de criação
 *     tags: [WhatsApp Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [access_token, restaurant_id]
 *             properties:
 *               access_token:
 *                 type: string
 *                 description: User access token do Facebook
 *               restaurant_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *     responses:
 *       200:
 *         description: WABA encontrada ou processo iniciado
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
router.post('/waba/discover-or-create', async (req: Request, res: Response) => {
  try {
    const { access_token, restaurant_id } = req.body;

    if (!access_token || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Access token e restaurant_id são obrigatórios'
      });
    }

    console.log('🔍 Iniciando descoberta de WABA...');

    // ✅ CORRIGIDO: Usa a nova função que já descobre business_id internamente
    const existingWABA = await WhatsAppIntegrationService.discoverExistingWABA(
      access_token, 
      restaurant_id
    );

    if (existingWABA.found && existingWABA.waba_id) {
      console.log('🔍 ✅ WABA existente encontrada:', existingWABA.waba_id);
      
      return res.json({
        success: true,
        message: 'WABA existente encontrada',
        data: {
          waba_id: existingWABA.waba_id,
          strategy: existingWABA.strategy,
          status: 'found',
          business_id: existingWABA.business_id
        }
      });
    }

    // Se não encontrou, retornar status para criação
    return res.json({
      success: true,
      message: 'WABA não encontrada, iniciando processo de criação',
      data: {
        status: 'not_found',
        business_id: existingWABA.business_id,
        next_step: 'create_via_bsp'
      }
    });

  } catch (error: any) {
    console.error('🔍 ❌ Erro na descoberta de WABA:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno na descoberta de WABA',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/waba/create-via-bsp:
 *   post:
 *     summary: Cria WABA via BSP usando endpoint correto
 *     tags: [WhatsApp Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, restaurant_id]
 *             properties:
 *               business_id:
 *                 type: string
 *                 description: Business ID do cliente
 *               restaurant_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *     responses:
 *       200:
 *         description: WABA criada com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
router.post('/waba/create-via-bsp', async (req: Request, res: Response) => {
  try {
    const { business_id, restaurant_id } = req.body;

    if (!business_id || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Business ID e restaurant_id são obrigatórios'
      });
    }

    console.log('🚀 Iniciando criação de WABA via BSP...');

    // ✅ CORRIGIDO: Usa a nova função que implementa o endpoint correto
    const wabaResult = await WhatsAppIntegrationService.createWABAViaBSP(
      business_id,
      restaurant_id
    );

    if (wabaResult.success && wabaResult.waba_id) {
      return res.json({
        success: true,
        message: 'WABA criada com sucesso via BSP',
        data: {
          waba_id: wabaResult.waba_id,
          strategy: 'bsp_client_whatsapp_business_accounts',
          next_step: 'polling_verification'
        }
      });
    }

    return res.json({
      success: false,
      message: 'Falha na criação de WABA via BSP',
      error: wabaResult.error
    });

  } catch (error: any) {
    console.error('🚀 ❌ Erro na criação via BSP:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno na criação via BSP',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/waba/polling-system:
 *   post:
 *     summary: Sistema de polling para verificar criação de WABA
 *     tags: [WhatsApp Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id, access_token, restaurant_id]
 *             properties:
 *               business_id:
 *                 type: string
 *                 description: Business ID do Facebook
 *               access_token:
 *                 type: string
 *                 description: User access token do Facebook
 *               restaurant_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *               max_attempts:
 *                 type: integer
 *                 default: 10
 *                 description: Número máximo de tentativas
 *     responses:
 *       200:
 *         description: Polling concluído
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
router.post('/waba/polling-system', async (req: Request, res: Response) => {
  try {
    const { business_id, access_token, restaurant_id, max_attempts = 10 } = req.body;

    if (!business_id || !access_token || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Business ID, access token e restaurant_id são obrigatórios'
      });
    }

    console.log('⏳ Iniciando sistema de polling...');

    const pollingResult = await WhatsAppIntegrationService.pollForWABA(
      business_id, 
      access_token, 
      restaurant_id,
      max_attempts
    );

    if (pollingResult.found && pollingResult.waba_id) {
      return res.json({
        success: true,
        message: 'WABA encontrada via polling',
        data: {
          waba_id: pollingResult.waba_id,
          attempts: pollingResult.attempts,
          status: 'found',
          next_step: 'finalize_integration'
        }
      });
    }

    return res.json({
      success: false,
      message: 'WABA não encontrada após polling',
      data: {
        attempts: pollingResult.attempts,
        status: 'not_found',
        next_step: 'retry_later',
        retry_after: 300 // 5 minutos
      }
    });

  } catch (error: any) {
    console.error('⏳ ❌ Erro no sistema de polling:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno no sistema de polling',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @swagger
 * /api/whatsapp/waba/complete-flow:
 *   post:
 *     summary: Fluxo principal que orquestra todo o processo de integração
 *     tags: [WhatsApp Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, state, restaurant_id]
 *             properties:
 *               code:
 *                 type: string
 *                 description: Authorization code do Facebook
 *               state:
 *                 type: string
 *                 description: State parameter para validação
 *               restaurant_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *     responses:
 *       200:
 *         description: Integração concluída com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */
router.post('/waba/complete-flow', async (req: Request, res: Response) => {
  try {
    const { code, state, restaurant_id } = req.body;

    if (!code || !state || !restaurant_id) {
      return res.status(400).json({
        success: false,
        message: 'Code, state e restaurant_id são obrigatórios'
      });
    }

    console.log('🎯 Iniciando fluxo completo de integração...');

    // 1. Trocar code por token
    console.log('🎯 Passo 1: Trocando code por access token...');
    const tokenResult = await WhatsAppIntegrationService.exchangeCodeForToken(
      code, 
      state, 
      restaurant_id
    );

    if (!tokenResult.success || !tokenResult.data) {
      return res.status(400).json({
        success: false,
        message: 'Falha na troca de token',
        error: tokenResult.error
      });
    }

    // 2. ESTRATÉGIA 1: Buscar WABA existente
    console.log('🎯 Passo 2: Buscando WABA existente...');
    const existingWABA = await WhatsAppIntegrationService.discoverExistingWABA(
      tokenResult.data.access_token, 
      restaurant_id
    );
    
    if (existingWABA.found && existingWABA.waba_id) {
      console.log('🎯 ✅ WABA existente encontrada:', existingWABA.waba_id);
      
      // Finalizar integração
      const finalResult = await WhatsAppIntegrationService.finalizeIntegration(
        existingWABA.waba_id, 
        tokenResult.data, 
        restaurant_id
      );
      
      return res.json({
        success: true,
        message: 'Integração concluída com WABA existente',
        data: {
          waba_id: existingWABA.waba_id,
          strategy: existingWABA.strategy,
          status: 'completed',
          integration_id: finalResult.integration_id
        }
      });
    }

    // 3. ESTRATÉGIA 2: Criar WABA via BSP
    console.log('🎯 Passo 3: Criando WABA via BSP...');
    
    if (!existingWABA.business_id) {
      throw new Error('Business ID não encontrado para criação');
    }

    const wabaResult = await WhatsAppIntegrationService.createWABAViaBSP(
      existingWABA.business_id,
      restaurant_id
    );
    
    if (wabaResult.success && wabaResult.waba_id) {
      console.log('🎯 ✅ WABA criada via BSP:', wabaResult.waba_id);
      
      // Executar polling e finalizar
      const finalResult = await WhatsAppIntegrationService.pollAndFinalize(
        wabaResult, 
        tokenResult.data, 
        restaurant_id,
        'bsp_client_whatsapp_business_accounts'
      );
      
      return res.json({
        success: true,
        message: 'Integração concluída via BSP',
        data: {
          waba_id: wabaResult.waba_id,
          strategy: 'bsp_client_whatsapp_business_accounts',
          status: 'completed',
          integration_id: finalResult.integration_id
        }
      });
    }

    // 4. Se falhou, retornar erro
    console.log('🎯 ❌ Falha na criação via BSP');
    
    return res.json({
      success: false,
      message: 'Falha na criação de WABA via BSP',
      data: {
        status: 'creation_failed',
        business_id: existingWABA.business_id,
        next_step: 'check_app_capabilities',
        message: 'Verifique se o App tem capability BSP habilitada'
      }
    });

  } catch (error: any) {
    console.error('🎯 ❌ Erro no fluxo completo:', error.response?.data || error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno no fluxo completo',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

export default router;
