import { supabase } from '../config/database';
import axios from 'axios';
import { META_URLS, BSP_CONFIG } from '../config/meta';

// --- Interfaces para as estratégias de criação ---

interface WABACreationResult {
  success: boolean;
  waba_id?: string;
  error?: string;
  details?: any;
}

interface PollingResult {
  found: boolean;
  waba_id?: string;
  attempts: number;
  status: string;
}

interface TokenExchangeResult {
  success: boolean;
  message: string;
  data?: {
    access_token: string;
    user_id: string;
    expires_in: number;
    token_type: string;
  };
}

// --- ESTRATÉGIA 1: client_whatsapp_applications ---

/**
 * Cria WABA via endpoint client_whatsapp_applications
 * Esta é a estratégia mais comum para BSPs
 */
export async function createViaClientWhatsApp(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  try {
    console.log('🚀 ESTRATÉGIA 1: client_whatsapp_applications iniciada...');
    
    const startTime = Date.now();
    const timeout = 30000; // 30 segundos
    
    const response = await axios.post(
      `${META_URLS.GRAPH_API}/${BSP_CONFIG.BSP_BUSINESS_ID}/client_whatsapp_applications`,
      {
        name: `WhatsApp Business - ${Date.now()}`,
        business_id: businessId,
        category: "BUSINESS_TO_CUSTOMER"
      },
      {
        headers: { 
          'Authorization': `Bearer ${bspToken}`,
          'Content-Type': 'application/json'
        },
        timeout
      }
    );

    const wabaId = response.data.id;
    console.log('🚀 ✅ Estratégia 1 bem-sucedida:', { wabaId, businessId });

    // Log do sucesso
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'client_whatsapp_applications',
        success: true,
        details: {
          waba_id: wabaId,
          business_id: businessId,
          response_time: Date.now() - startTime,
          response_data: response.data
        }
      });

    return {
      success: true,
      waba_id: wabaId,
      details: response.data
    };

  } catch (error: any) {
    console.error('🚀 ❌ Estratégia 1 falhou:', error.response?.data || error.message);
    
    // Log do erro
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'client_whatsapp_applications',
        success: false,
        error_message: error.response?.data?.error?.message || error.message,
        details: {
          business_id: businessId,
          error_code: error.response?.data?.error?.code,
          status: error.response?.status,
          response_time: Date.now() - startTime
        }
      });

    throw error;
  }
}

// --- ESTRATÉGIA 2: whatsapp_business_accounts direto ---

/**
 * Cria WABA via endpoint whatsapp_business_accounts direto
 * Estratégia alternativa para criação direta
 */
export async function createViaDirectWABA(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  try {
    console.log('🚀 ESTRATÉGIA 2: whatsapp_business_accounts iniciada...');
    
    const startTime = Date.now();
    const timeout = 30000; // 30 segundos
    
    const response = await axios.post(
      `${META_URLS.GRAPH_API}/${businessId}/whatsapp_business_accounts`,
      {
        name: `WhatsApp Business - ${Date.now()}`,
        category: "BUSINESS_TO_CUSTOMER"
      },
      {
        headers: { 
          'Authorization': `Bearer ${bspToken}`,
          'Content-Type': 'application/json'
        },
        timeout
      }
    );

    const wabaId = response.data.id;
    console.log('🚀 ✅ Estratégia 2 bem-sucedida:', { wabaId, businessId });

    // Log do sucesso
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'whatsapp_business_accounts',
        success: true,
        details: {
          waba_id: wabaId,
          business_id: businessId,
          response_time: Date.now() - startTime,
          response_data: response.data
        }
      });

    return {
      success: true,
      waba_id: wabaId,
      details: response.data
    };

  } catch (error: any) {
    console.error('🚀 ❌ Estratégia 2 falhou:', error.response?.data || error.message);
    
    // Log do erro
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'whatsapp_business_accounts',
        success: false,
        error_message: error.response?.data?.error?.message || error.message,
        details: {
          business_id: businessId,
          error_code: error.response?.data?.error?.code,
          status: error.response?.status,
          response_time: Date.now() - startTime
        }
      });

    throw error;
  }
}

// --- ESTRATÉGIA 3: applications ---

/**
 * Cria WABA via endpoint applications
 * Estratégia para criação de aplicações
 */
export async function createViaApplications(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  try {
    console.log('🚀 ESTRATÉGIA 3: applications iniciada...');
    
    const startTime = Date.now();
    const timeout = 30000; // 30 segundos
    
    const response = await axios.post(
      `${META_URLS.GRAPH_API}/${BSP_CONFIG.BSP_BUSINESS_ID}/applications`,
      {
        name: `WhatsApp Business App - ${Date.now()}`,
        namespace: `whatsapp_${Date.now()}`,
        category: "BUSINESS",
        business_id: businessId
      },
      {
        headers: { 
          'Authorization': `Bearer ${bspToken}`,
          'Content-Type': 'application/json'
        },
        timeout
      }
    );

    const appId = response.data.id;
    console.log('🚀 ✅ Estratégia 3 bem-sucedida:', { appId, businessId });

    // Log do sucesso
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'applications',
        success: true,
        details: {
          app_id: appId,
          business_id: businessId,
          response_time: Date.now() - startTime,
          response_data: response.data
        }
      });

    return {
      success: true,
      waba_id: appId, // Pode ser necessário converter app_id para waba_id
      details: response.data
    };

  } catch (error: any) {
    console.error('🚀 ❌ Estratégia 3 falhou:', error.response?.data || error.message);
    
    // Log do erro
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'applications',
        success: false,
        error_message: error.response?.data?.error?.message || error.message,
        details: {
          business_id: businessId,
          error_code: error.response?.data?.error?.code,
          status: error.response?.status,
          response_time: Date.now() - startTime
        }
      });

    throw error;
  }
}

// --- ESTRATÉGIA 4: Fluxo oficial Meta ---

/**
 * Cria WABA usando o fluxo oficial do Meta
 * Estratégia padrão recomendada
 */
export async function createViaOfficialFlow(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  try {
    console.log('🚀 ESTRATÉGIA 4: Fluxo oficial Meta iniciado...');
    
    const startTime = Date.now();
    const timeout = 30000; // 30 segundos
    
    const response = await axios.post(
      `${META_URLS.GRAPH_API}/whatsapp_business_accounts`,
      {
        business_manager_id: businessId,
        name: `WhatsApp Business - ${Date.now()}`,
        category: "BUSINESS_TO_CUSTOMER"
      },
      {
        headers: { 
          'Authorization': `Bearer ${bspToken}`,
          'Content-Type': 'application/json'
        },
        timeout
      }
    );

    const wabaId = response.data.id;
    console.log('🚀 ✅ Estratégia 4 bem-sucedida:', { wabaId, businessId });

    // Log do sucesso
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'official_flow',
        success: true,
        details: {
          waba_id: wabaId,
          business_id: businessId,
          response_time: Date.now() - startTime,
          response_data: response.data
        }
      });

    return {
      success: true,
      waba_id: wabaId,
      details: response.data
    };

  } catch (error: any) {
    console.error('🚀 ❌ Estratégia 4 falhou:', error.response?.data || error.message);
    
    // Log do erro
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'official_flow',
        success: false,
        error_message: error.response?.data?.error?.message || error.message,
        details: {
          business_id: businessId,
          error_code: error.response?.data?.error?.code,
          status: error.response?.status,
          response_time: Date.now() - startTime
        }
      });

    throw error;
  }
}

// --- ESTRATÉGIA 5: Endpoint global ---

/**
 * Cria WABA via endpoint global
 * Última estratégia de fallback
 */
export async function createViaGlobalEndpoint(
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  try {
    console.log('🚀 ESTRATÉGIA 5: Endpoint global iniciado...');
    
    const startTime = Date.now();
    const timeout = 30000; // 30 segundos
    
    // Primeiro verificar se o token BSP é válido
    const testResponse = await axios.get(
      `${META_URLS.GRAPH_API}/me`,
      {
        headers: { 'Authorization': `Bearer ${bspToken}` },
        timeout: 10000
      }
    );

    console.log('🚀 ✅ Token BSP válido, usuário:', testResponse.data.name);

    // Tentar criar WABA via endpoint global
    const response = await axios.post(
      `${META_URLS.GRAPH_API}/whatsapp_business_accounts`,
      {
        name: `WhatsApp Business Global - ${Date.now()}`,
        category: "BUSINESS_TO_CUSTOMER"
      },
      {
        headers: { 
          'Authorization': `Bearer ${bspToken}`,
          'Content-Type': 'application/json'
        },
        timeout
      }
    );

    const wabaId = response.data.id;
    console.log('🚀 ✅ Estratégia 5 bem-sucedida:', { wabaId });

    // Log do sucesso
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'global_endpoint',
        success: true,
        details: {
          waba_id: wabaId,
          response_time: Date.now() - startTime,
          response_data: response.data
        }
      });

    return {
      success: true,
      waba_id: wabaId,
      details: response.data
    };

  } catch (error: any) {
    console.error('🚀 ❌ Estratégia 5 falhou:', error.response?.data || error.message);
    
    // Log do erro
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'global_endpoint',
        success: false,
        error_message: error.response?.data?.error?.message || error.message,
        details: {
          error_code: error.response?.data?.error?.code,
          status: error.response?.status,
          response_time: Date.now() - startTime
        }
      });

    throw error;
  }
}

// --- SISTEMA DE POLLING ---

/**
 * Sistema robusto de polling para verificar criação de WABA
 * Executa até maxAttempts com intervalo de 3 segundos
 */
export async function pollForWABA(
  businessId: string, 
  userToken: string, 
  restaurantId: string,
  maxAttempts: number = 10
): Promise<PollingResult> {
  console.log(`⏳ Iniciando polling para WABA... Max tentativas: ${maxAttempts}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`⏳ Tentativa ${attempt}/${maxAttempts}...`);
    
    try {
      // Tentar encontrar WABA no business do usuário
      const searchResponse = await axios.get(
        `${META_URLS.GRAPH_API}/${businessId}?fields=whatsapp_business_accounts{id,name,status}`,
        {
          headers: { 'Authorization': `Bearer ${userToken}` },
          timeout: 10000
        }
      );
      
      if (searchResponse.data?.whatsapp_business_accounts?.data && 
          searchResponse.data.whatsapp_business_accounts.data.length > 0) {
        const foundWaba = searchResponse.data.whatsapp_business_accounts.data[0];
        console.log('⏳ ✅ WABA encontrada via polling:', foundWaba);
        
        // Log do sucesso
        await supabase
          .from('whatsapp_integration_logs')
          .insert({
            restaurant_id: restaurantId,
            step: 'polling_verification',
            strategy: 'polling_system',
            success: true,
            details: {
              waba_id: foundWaba.id,
              attempts: attempt,
              business_id: businessId,
              waba_data: foundWaba
            }
          });

        return {
          found: true,
          waba_id: foundWaba.id,
          attempts: attempt,
          status: 'found'
        };
      }
      
      console.log(`⏳ Tentativa ${attempt}: WABA não encontrada ainda`);
      
    } catch (searchError: any) {
      console.log(`⏳ Tentativa ${attempt} falhou:`, searchError.response?.data?.error?.message || 'erro na busca');
      
      // Log do erro da tentativa
      await supabase
        .from('whatsapp_integration_logs')
        .insert({
          restaurant_id: restaurantId,
          step: 'polling_verification',
          strategy: 'polling_system',
          success: false,
          error_message: `Tentativa ${attempt} falhou: ${searchError.response?.data?.error?.message || searchError.message}`,
          details: {
            attempt,
            business_id: businessId,
            error_code: searchError.response?.data?.error?.code
          }
        });
    }
    
    // Aguardar 3 segundos antes da próxima tentativa (exceto na última)
    if (attempt < maxAttempts) {
      console.log('⏳ Aguardando 3 segundos antes da próxima tentativa...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`⏳ ❌ WABA não encontrada após ${maxAttempts} tentativas`);
  
  // Log final de falha
  await supabase
    .from('whatsapp_integration_logs')
    .insert({
      restaurant_id: restaurantId,
      step: 'polling_verification',
      strategy: 'polling_system',
      success: false,
      error_message: `WABA não encontrada após ${maxAttempts} tentativas de polling`,
      details: {
        max_attempts: maxAttempts,
        business_id: businessId,
        end_time: new Date().toISOString()
      }
    });

  return {
    found: false,
    attempts: maxAttempts,
    status: 'not_found'
  };
}

// --- FUNÇÕES AUXILIARES ---

/**
 * Troca authorization code por access token
 */
export async function exchangeCodeForToken(
  code: string, 
  state: string, 
  restaurantId: string
): Promise<TokenExchangeResult> {
  try {
    console.log('🔄 Trocando code por access token...');
    
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.API_BASE_URL || 'https://api.angu.ai'}/api/whatsapp/oauth/callback-v2`;

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais do Facebook não configuradas');
    }

    // Decodificar state
    const stateData = JSON.parse(decodeURIComponent(state));
    const { user_id: userId } = stateData;

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code
    });

    const tokenResponse = await axios.get(
      `${META_URLS.OAUTH_ACCESS_TOKEN}?${tokenParams.toString()}`
    );

    const { access_token, token_type, expires_in } = tokenResponse.data;
    const expiresIn = expires_in || 3600;

    console.log('🔄 ✅ Access token obtido com sucesso');

    // Salvar token no banco
    const tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
    
    await supabase
      .from('meta_tokens')
      .upsert({
        user_id: userId,
        restaurant_id: restaurantId,
        access_token: access_token,
        token_type: 'user',
        expires_at: tokenExpiresAt,
        integration_type: 'whatsapp_business',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,restaurant_id' });

    return {
      success: true,
      message: 'Token trocado com sucesso',
      data: {
        access_token,
        user_id: userId,
        expires_in: expiresIn,
        token_type
      }
    };

  } catch (error: any) {
    console.error('🔄 ❌ Erro na troca de token:', error.response?.data || error.message);
    
    return {
      success: false,
      message: 'Erro ao trocar token de autorização',
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * Descobre business_id do usuário
 */
export async function discoverBusinessId(userToken: string): Promise<string | null> {
  try {
    console.log('🔍 Descobrindo business_id...');
    
    const businessResponse = await axios.get(
      `${META_URLS.GRAPH_API}/me/businesses?fields=id,name`,
      {
        headers: { 'Authorization': `Bearer ${userToken}` }
      }
    );

    const businesses = businessResponse.data?.data || [];
    if (businesses.length === 0) {
      throw new Error('Nenhum Business encontrado para o usuário');
    }

    const businessId = businesses[0].id;
    console.log('🔍 ✅ Business ID encontrado:', { id: businessId, name: businesses[0].name });
    
    return businessId;

  } catch (error: any) {
    console.error('🔍 ❌ Erro ao descobrir business_id:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Descobre WABA existente
 */
export async function discoverExistingWABA(
  businessId: string, 
  userToken: string, 
  restaurantId: string
): Promise<{ found: boolean; waba_id?: string }> {
  try {
    console.log('🔍 Buscando WABA existente...');
    
    const wabaResponse = await axios.get(
      `${META_URLS.GRAPH_API}/${businessId}?fields=whatsapp_business_accounts{id,name,status}`,
      {
        headers: { 'Authorization': `Bearer ${userToken}` }
      }
    );

    if (wabaResponse.data?.whatsapp_business_accounts?.data && 
        wabaResponse.data.whatsapp_business_accounts.data.length > 0) {
      const wabaId = wabaResponse.data.whatsapp_business_accounts.data[0].id;
      console.log('🔍 ✅ WABA existente encontrada:', wabaId);
      
      return { found: true, waba_id: wabaId };
    }

    console.log('🔍 ❌ Nenhuma WABA existente encontrada');
    return { found: false };

  } catch (error: any) {
    console.error('🔍 ❌ Erro ao buscar WABA existente:', error.response?.data || error.message);
    return { found: false };
  }
}

/**
 * Finaliza integração criando registro no banco
 */
export async function finalizeIntegration(
  wabaId: string, 
  tokenData: any, 
  restaurantId: string
): Promise<{ integration_id: string }> {
  try {
    console.log('🎯 Finalizando integração...');
    
    // Buscar informações da WABA
    const wabaResponse = await axios.get(
      `${META_URLS.GRAPH_API}/${wabaId}?fields=id,name,status`,
      {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      }
    );

    const wabaInfo = wabaResponse.data;
    
    // Criar integração no banco
    const { data: integration, error } = await supabase
      .from('whatsapp_business_integrations')
      .upsert({
        restaurant_id: restaurantId,
        business_account_id: wabaId,
        access_token: tokenData.access_token,
        business_name: wabaInfo.name || 'WhatsApp Business',
        connection_status: 'connected',
        is_active: true,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'restaurant_id' })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    console.log('🎯 ✅ Integração finalizada:', { integration_id: integration.id });
    
    return { integration_id: integration.id };

  } catch (error: any) {
    console.error('🎯 ❌ Erro ao finalizar integração:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Executa polling e finaliza integração
 */
export async function pollAndFinalize(
  wabaResult: WABACreationResult, 
  tokenData: any, 
  restaurantId: string,
  strategy: string
): Promise<{ integration_id: string }> {
  try {
    console.log('🎯 Executando polling e finalização...');
    
    // Buscar business_id para polling
    const businessId = await discoverBusinessId(tokenData.access_token);
    if (!businessId) {
      throw new Error('Business ID não encontrado para polling');
    }

    // Executar polling
    const pollingResult = await pollForWABA(businessId, tokenData.access_token, restaurantId);
    
    if (!pollingResult.found) {
      throw new Error('WABA não encontrada após polling');
    }

    // Finalizar integração
    const finalResult = await finalizeIntegration(pollingResult.waba_id!, tokenData, restaurantId);
    
    console.log('🎯 ✅ Polling e finalização concluídos:', { 
      strategy, 
      waba_id: pollingResult.waba_id,
      integration_id: finalResult.integration_id 
    });
    
    return finalResult;

  } catch (error: any) {
    console.error('🎯 ❌ Erro no polling e finalização:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Log de falha de estratégia
 */
export async function logStrategyFailure(
  strategy: string, 
  error: any, 
  restaurantId: string
): Promise<void> {
  try {
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy,
        success: false,
        error_message: error.response?.data?.error?.message || error.message,
        details: {
          error_code: error.response?.data?.error?.code,
          status: error.response?.status,
          strategy
        }
      });
  } catch (logError) {
    console.error('❌ Erro ao salvar log de falha:', logError);
  }
}

export default {
  createViaClientWhatsApp,
  createViaDirectWABA,
  createViaApplications,
  createViaOfficialFlow,
  createViaGlobalEndpoint,
  pollForWABA,
  exchangeCodeForToken,
  discoverBusinessId,
  discoverExistingWABA,
  finalizeIntegration,
  pollAndFinalize,
  logStrategyFailure
}; 