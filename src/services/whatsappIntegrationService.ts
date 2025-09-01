import { supabase } from '../config/database';
import axios from 'axios';
import { META_URLS, BSP_CONFIG } from '../config/meta';

// --- Interfaces ---

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
  error?: string;
}

interface MetaWABAResponse {
  id: string;
  name?: string;
  status?: string;
}

interface MetaBusinessResponse {
  data: Array<{
    id: string;
    name: string;
  }>;
}

interface MetaWABAListResponse {
  data: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MetaUserResponse {
  name: string;
  id: string;
}

// --- ESTRATÉGIA 1: DESCOBERTA DE WABA EXISTENTE (CORRIGIDA) ---

/**
 * ESTRATÉGIA 1: Buscar WABA existente usando as edges corretas
 * ✅ CORRIGIDO: Usa /owned_whatsapp_business_accounts e /client_whatsapp_business_accounts
 * ✅ CORRIGIDO: Remove verificação em páginas (páginas não são fonte de WABA)
 */
export async function discoverExistingWABA(
  userToken: string, 
  restaurantId: string
): Promise<{ found: boolean; waba_id?: string; strategy?: string; business_id?: string }> {
  const startTime = Date.now();
  
  try {
    console.log('🔍 [DISCOVERY] Iniciando descoberta de WABA existente...');
    console.log('🔍 [DISCOVERY] Restaurant ID:', restaurantId);
    console.log('🔍 [DISCOVERY] Token length:', userToken.length);
    
    // 1. Descobrir business_id do usuário
    console.log('🔍 [DISCOVERY] Passo 1: Descobrindo business_id do usuário...');
    const businessId = await discoverBusinessId(userToken);
    if (!businessId) {
      console.log('🔍 [DISCOVERY] ❌ Business ID não encontrado para o usuário');
      throw new Error('Business ID não encontrado para o usuário');
    }
    console.log('🔍 [DISCOVERY] ✅ Business ID encontrado:', businessId);

    // 2. Buscar WABA owned (próprias do business)
    console.log('🔍 [DISCOVERY] Passo 2: Buscando WABA owned (próprias do business)...');
    try {
      const ownedUrl = `${META_URLS.GRAPH_API}/${businessId}/owned_whatsapp_business_accounts`;
      console.log('🔍 [DISCOVERY] URL owned:', ownedUrl);
      
      const ownedResponse = await axios.get<MetaWABAListResponse>(
        ownedUrl,
        {
          headers: { 'Authorization': `Bearer ${userToken}` },
          timeout: 10000
        }
      );

      console.log('🔍 [DISCOVERY] Response owned status:', ownedResponse.status);
      console.log('🔍 [DISCOVERY] Response owned data:', JSON.stringify(ownedResponse.data, null, 2));

      if (ownedResponse.data?.data && ownedResponse.data.data.length > 0) {
        const wabaId = ownedResponse.data.data[0].id;
        const wabaName = ownedResponse.data.data[0].name;
        const wabaStatus = ownedResponse.data.data[0].status;
        
        console.log('🔍 [DISCOVERY] ✅ WABA owned encontrada:', { wabaId, wabaName, wabaStatus });
        
        await logIntegrationStep('waba_discovery', 'owned_whatsapp_business_accounts', true, restaurantId, {
          waba_id: wabaId,
          waba_name: wabaName,
          waba_status: wabaStatus,
          business_id: businessId,
          response_time: Date.now() - startTime,
          total_wabas_found: ownedResponse.data.data.length
        });
        
        return { found: true, waba_id: wabaId, strategy: 'owned_whatsapp_business_accounts', business_id: businessId };
      } else {
        console.log('🔍 [DISCOVERY] ℹ️ Nenhuma WABA owned encontrada');
      }
    } catch (error: any) {
      console.log('🔍 [DISCOVERY] ⚠️ Erro ao buscar WABA owned:', error.response?.data?.error?.message || error.message);
      console.log('🔍 [DISCOVERY] Error details:', JSON.stringify(error.response?.data, null, 2));
    }

    // 3. Buscar WABA client (vinculadas ao business)
    console.log('🔍 [DISCOVERY] Passo 3: Buscando WABA client (vinculadas ao business)...');
    try {
      const clientUrl = `${META_URLS.GRAPH_API}/${businessId}/client_whatsapp_business_accounts`;
      console.log('🔍 [DISCOVERY] URL client:', clientUrl);
      
      const clientResponse = await axios.get<MetaWABAListResponse>(
        clientUrl,
        {
          headers: { 'Authorization': `Bearer ${userToken}` },
          timeout: 10000
        }
      );

      console.log('🔍 [DISCOVERY] Response client status:', clientResponse.status);
      console.log('🔍 [DISCOVERY] Response client data:', JSON.stringify(clientResponse.data, null, 2));

      if (clientResponse.data?.data && clientResponse.data.data.length > 0) {
        const wabaId = clientResponse.data.data[0].id;
        const wabaName = clientResponse.data.data[0].name;
        const wabaStatus = clientResponse.data.data[0].status;
        
        console.log('🔍 [DISCOVERY] ✅ WABA client encontrada:', { wabaId, wabaName, wabaStatus });
        
        await logIntegrationStep('waba_discovery', 'client_whatsapp_business_accounts', true, restaurantId, {
          waba_id: wabaId,
          waba_name: wabaName,
          waba_status: wabaStatus,
          business_id: businessId,
          response_time: Date.now() - startTime,
          total_wabas_found: clientResponse.data.data.length
        });
        
        return { found: true, waba_id: wabaId, strategy: 'client_whatsapp_business_accounts', business_id: businessId };
      } else {
        console.log('🔍 [DISCOVERY] ℹ️ Nenhuma WABA client encontrada');
      }
    } catch (error: any) {
      console.log('🔍 [DISCOVERY] ⚠️ Erro ao buscar WABA client:', error.response?.data?.error?.message || error.message);
      console.log('🔍 [DISCOVERY] Error details:', JSON.stringify(error.response?.data, null, 2));
    }

    console.log('🔍 [DISCOVERY] ❌ Nenhuma WABA existente encontrada');
    await logIntegrationStep('waba_discovery', 'not_found', false, restaurantId, {
      business_id: businessId,
      message: 'Nenhuma WABA existente encontrada',
      response_time: Date.now() - startTime,
      searched_edges: ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']
    });
    
    return { found: false, business_id: businessId };

  } catch (error: any) {
    console.error('🔍 [DISCOVERY] ❌ Erro geral na descoberta de WABA:', error.response?.data || error.message);
    console.error('🔍 [DISCOVERY] Error stack:', error.stack);
    
    await logIntegrationStep('waba_discovery', 'error', false, restaurantId, {
      error: error.response?.data || error.message,
      error_code: error.response?.data?.error?.code,
      error_type: error.response?.data?.error?.type,
      response_time: Date.now() - startTime
    });
    return { found: false };
  }
}

// --- ESTRATÉGIA 2: CRIAÇÃO DE WABA VIA BSP (CORRIGIDA) ---

/**
 * ESTRATÉGIA 2: Criar WABA via BSP usando endpoint correto
 * ✅ CORRIGIDO: POST /{BSP_BUSINESS_ID}/client_whatsapp_business_accounts
 * ✅ CORRIGIDO: Parâmetro client_business_id obrigatório
 * ✅ CORRIGIDO: Usa SYSTEM_USER_ACCESS_TOKEN do BSP
 */
export async function createWABAViaBSP(
  clientBusinessId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  const startTime = Date.now();
  
  try {
    console.log('🚀 [BSP_CREATION] Iniciando criação de WABA via BSP...');
    console.log('�� [BSP_CREATION] BSP Business ID:', BSP_CONFIG.BSP_BUSINESS_ID);
    console.log('🚀 [BSP_CREATION] Client Business ID:', clientBusinessId);
    console.log('🚀 [BSP_CREATION] Restaurant ID:', restaurantId);
    console.log('🚀 [BSP_CREATION] Token length:', BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN.length);
    
    const wabaName = `Integration for Angu.ai - ${new Date().toISOString()}`;
    console.log('🚀 [BSP_CREATION] WABA name:', wabaName);
    
    const requestBody = {
      name: wabaName,
      client_business_id: clientBusinessId
    };
    console.log('🚀 [BSP_CREATION] Request body:', JSON.stringify(requestBody, null, 2));
    
    // ✅ CORRIGIDO: Endpoint correto para BSP
    const endpoint = `${META_URLS.GRAPH_API}/${BSP_CONFIG.BSP_BUSINESS_ID}/client_whatsapp_business_accounts`;
    console.log('🚀 [BSP_CREATION] Endpoint:', endpoint);
    
    const response = await axios.post(
      endpoint,
      requestBody,
      {
        headers: { 
          'Authorization': `Bearer ${BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('🚀 [BSP_CREATION] Response status:', response.status);
    console.log('🚀 [BSP_CREATION] Response data:', JSON.stringify(response.data, null, 2));

    const wabaId = (response.data as any).id;
    console.log('🚀 [BSP_CREATION] ✅ WABA criada via BSP:', wabaId);

    await logIntegrationStep('waba_creation', 'bsp_client_whatsapp_business_accounts', true, restaurantId, {
      waba_id: wabaId,
      waba_name: wabaName,
      bsp_business_id: BSP_CONFIG.BSP_BUSINESS_ID,
      client_business_id: clientBusinessId,
      response_time: Date.now() - startTime,
      response_data: response.data,
      endpoint_used: endpoint
    });

    return {
      success: true,
      waba_id: wabaId,
      details: response.data
    };

  } catch (error: any) {
    console.error('🚀 [BSP_CREATION] ❌ Erro na criação via BSP:', error.response?.data || error.message);
    console.error('🚀 [BSP_CREATION] Error details:', JSON.stringify(error.response?.data, null, 2));
    console.error('🚀 [BSP_CREATION] Error stack:', error.stack);
    
    await logIntegrationStep('waba_creation', 'bsp_client_whatsapp_business_accounts', false, restaurantId, {
      error: error.response?.data?.error?.message || error.message,
      error_code: error.response?.data?.error?.code,
      error_type: error.response?.data?.error?.type,
      status: error.response?.status,
      bsp_business_id: BSP_CONFIG.BSP_BUSINESS_ID,
      client_business_id: clientBusinessId,
      response_time: Date.now() - startTime,
      endpoint_used: `${META_URLS.GRAPH_API}/${BSP_CONFIG.BSP_BUSINESS_ID}/client_whatsapp_business_accounts`
    });

    throw error;
  }
}

// --- SISTEMA DE POLLING (CORRIGIDO) ---

/**
 * Sistema de polling usando as edges corretas
 * ✅ CORRIGIDO: Usa /owned_whatsapp_business_accounts e /client_whatsapp_business_accounts
 */
export async function pollForWABA(
  businessId: string, 
  userToken: string, 
  restaurantId: string,
  maxAttempts: number = 10
): Promise<PollingResult> {
  console.log(`⏳ [POLLING] Iniciando sistema de polling para WABA...`);
  console.log(`⏳ [POLLING] Business ID: ${businessId}`);
  console.log(`⏳ [POLLING] Restaurant ID: ${restaurantId}`);
  console.log(`⏳ [POLLING] Max tentativas: ${maxAttempts}`);
  console.log(`⏳ [POLLING] Token length: ${userToken.length}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`⏳ [POLLING] Tentativa ${attempt}/${maxAttempts}...`);
    
    try {
      // ✅ CORRIGIDO: Buscar em owned_whatsapp_business_accounts
      console.log(`⏳ [POLLING] Buscando em owned_whatsapp_business_accounts...`);
      const ownedUrl = `${META_URLS.GRAPH_API}/${businessId}/owned_whatsapp_business_accounts`;
      console.log(`⏳ [POLLING] Owned URL: ${ownedUrl}`);
      
      const ownedResponse = await axios.get<MetaWABAListResponse>(
        ownedUrl,
        {
          headers: { 'Authorization': `Bearer ${userToken}` },
          timeout: 10000
        }
      );
      
      console.log(`⏳ [POLLING] Owned response status: ${ownedResponse.status}`);
      console.log(`⏳ [POLLING] Owned response data:`, JSON.stringify(ownedResponse.data, null, 2));
      
      if (ownedResponse.data?.data && ownedResponse.data.data.length > 0) {
        const foundWaba = ownedResponse.data.data[0];
        console.log('⏳ [POLLING] ✅ WABA owned encontrada via polling:', foundWaba);
        
        await logIntegrationStep('polling_verification', 'owned_whatsapp_business_accounts', true, restaurantId, {
          waba_id: foundWaba.id,
          waba_name: foundWaba.name,
          waba_status: foundWaba.status,
          attempts: attempt,
          business_id: businessId,
          total_wabas_found: ownedResponse.data.data.length
        });
        
        return {
          found: true,
          waba_id: foundWaba.id,
          attempts: attempt,
          status: 'found'
        };
      }

      // ✅ CORRIGIDO: Buscar em client_whatsapp_business_accounts
      console.log(`⏳ [POLLING] Buscando em client_whatsapp_business_accounts...`);
      const clientUrl = `${META_URLS.GRAPH_API}/${businessId}/client_whatsapp_business_accounts`;
      console.log(`⏳ [POLLING] Client URL: ${clientUrl}`);
      
      const clientResponse = await axios.get<MetaWABAListResponse>(
        clientUrl,
        {
          headers: { 'Authorization': `Bearer ${userToken}` },
          timeout: 10000
        }
      );
      
      console.log(`⏳ [POLLING] Client response status: ${clientResponse.status}`);
      console.log(`⏳ [POLLING] Client response data:`, JSON.stringify(clientResponse.data, null, 2));
      
      if (clientResponse.data?.data && clientResponse.data.data.length > 0) {
        const foundWaba = clientResponse.data.data[0];
        console.log('⏳ [POLLING] ✅ WABA client encontrada via polling:', foundWaba);
        
        await logIntegrationStep('polling_verification', 'client_whatsapp_business_accounts', true, restaurantId, {
          waba_id: foundWaba.id,
          waba_name: foundWaba.name,
          waba_status: foundWaba.status,
          attempts: attempt,
          business_id: businessId,
          total_wabas_found: clientResponse.data.data.length
        });
        
        return {
          found: true,
          waba_id: foundWaba.id,
          attempts: attempt,
          status: 'found'
        };
      }
      
      console.log(`⏳ [POLLING] Tentativa ${attempt}: WABA não encontrada ainda`);
      
    } catch (searchError: any) {
      console.log(`⏳ [POLLING] Tentativa ${attempt} falhou:`, searchError.response?.data?.error?.message || 'erro na busca');
      console.log(`⏳ [POLLING] Error details:`, JSON.stringify(searchError.response?.data, null, 2));
    }
    
    if (attempt < maxAttempts) {
      console.log('⏳ [POLLING] Aguardando 3 segundos antes da próxima tentativa...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`⏳ [POLLING] ❌ WABA não encontrada após ${maxAttempts} tentativas`);
  
  await logIntegrationStep('polling_verification', 'timeout', false, restaurantId, {
    attempts: maxAttempts,
    business_id: businessId,
    message: 'WABA não encontrada após todas as tentativas',
    searched_edges: ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']
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
  const startTime = Date.now();
  
  try {
    console.log('🔄 [TOKEN_EXCHANGE] Iniciando troca de code por access token...');
    console.log('🔄 [TOKEN_EXCHANGE] Code length:', code.length);
    console.log('🔄 [TOKEN_EXCHANGE] State:', state);
    console.log('🔄 [TOKEN_EXCHANGE] Restaurant ID:', restaurantId);
    
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.API_BASE_URL || 'https://api.angu.ai'}/api/whatsapp/oauth/callback-v2`;

    console.log('🔄 [TOKEN_EXCHANGE] Client ID:', clientId);
    console.log('�� [TOKEN_EXCHANGE] Redirect URI:', redirectUri);

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais do Facebook não configuradas');
    }

    const stateData = JSON.parse(decodeURIComponent(state));
    const { user_id: userId } = stateData;
    console.log('🔄 [TOKEN_EXCHANGE] User ID from state:', userId);

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code
    });

    const tokenUrl = `${META_URLS.OAUTH_ACCESS_TOKEN}?${tokenParams.toString()}`;
    console.log('🔄 [TOKEN_EXCHANGE] Token URL:', tokenUrl);

    const tokenResponse = await axios.get<MetaTokenResponse>(tokenUrl);
    console.log('🔄 [TOKEN_EXCHANGE] Token response status:', tokenResponse.status);
    console.log('🔄 [TOKEN_EXCHANGE] Token response data:', JSON.stringify(tokenResponse.data, null, 2));

    const { access_token, token_type, expires_in } = tokenResponse.data;
    const expiresIn = expires_in || 3600;

    console.log('🔄 [TOKEN_EXCHANGE] ✅ Access token obtido com sucesso');
    console.log('🔄 [TOKEN_EXCHANGE] Token type:', token_type);
    console.log('🔄 [TOKEN_EXCHANGE] Expires in:', expiresIn, 'seconds');

    const tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
    console.log('🔄 [TOKEN_EXCHANGE] Token expires at:', tokenExpiresAt);
    
    console.log('🔄 [TOKEN_EXCHANGE] Salvando token no banco...');
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

    console.log('🔄 [TOKEN_EXCHANGE] ✅ Token salvo no banco com sucesso');

    await logIntegrationStep('token_exchange', 'success', true, restaurantId, {
      user_id: userId,
      expires_in: expiresIn,
      token_type: token_type,
      response_time: Date.now() - startTime
    });

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
    console.error('🔄 [TOKEN_EXCHANGE] ❌ Erro na troca de token:', error.response?.data || error.message);
    console.error('🔄 [TOKEN_EXCHANGE] Error details:', JSON.stringify(error.response?.data, null, 2));
    console.error('🔄 [TOKEN_EXCHANGE] Error stack:', error.stack);
    
    await logIntegrationStep('token_exchange', 'error', false, restaurantId, {
      error: error.response?.data?.error?.message || error.message,
      error_code: error.response?.data?.error?.code,
      error_type: error.response?.data?.error?.type,
      response_time: Date.now() - startTime
    });
    
    return {
      success: false,
      message: 'Erro ao trocar token de autorização',
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * Descobre business_id do usuário
 * ✅ CORRIGIDO: Usa /me/businesses (requer business_management scope)
 */
export async function discoverBusinessId(userToken: string): Promise<string | null> {
  const startTime = Date.now();
  
  try {
    console.log('🔍 [BUSINESS_DISCOVERY] Descobrindo business_id...');
    console.log('🔍 [BUSINESS_DISCOVERY] Token length:', userToken.length);
    
    const businessUrl = `${META_URLS.GRAPH_API}/me/businesses?fields=id,name`;
    console.log('🔍 [BUSINESS_DISCOVERY] Business URL:', businessUrl);
    
    const businessResponse = await axios.get<MetaBusinessResponse>(
      businessUrl,
      {
        headers: { 'Authorization': `Bearer ${userToken}` }
      }
    );

    console.log('🔍 [BUSINESS_DISCOVERY] Business response status:', businessResponse.status);
    console.log('🔍 [BUSINESS_DISCOVERY] Business response data:', JSON.stringify(businessResponse.data, null, 2));

    const businesses = businessResponse.data?.data || [];
    console.log('🔍 [BUSINESS_DISCOVERY] Total businesses found:', businesses.length);
    
    if (businesses.length === 0) {
      throw new Error('Nenhum Business encontrado para o usuário');
    }

    const businessId = businesses[0].id;
    const businessName = businesses[0].name;
    console.log('🔍 [BUSINESS_DISCOVERY] ✅ Business ID encontrado:', { id: businessId, name: businessName });
    console.log('🔍 [BUSINESS_DISCOVERY] Response time:', Date.now() - startTime, 'ms');
    
    return businessId;

  } catch (error: any) {
    console.error('🔍 [BUSINESS_DISCOVERY] ❌ Erro ao descobrir business_id:', error.response?.data || error.message);
    console.error('🔍 [BUSINESS_DISCOVERY] Error details:', JSON.stringify(error.response?.data, null, 2));
    console.error('🔍 [BUSINESS_DISCOVERY] Response time:', Date.now() - startTime, 'ms');
    return null;
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
  const startTime = Date.now();
  
  try {
    console.log('🎯 [FINALIZATION] Finalizando integração...');
    console.log('🎯 [FINALIZATION] WABA ID:', wabaId);
    console.log('🎯 [FINALIZATION] Restaurant ID:', restaurantId);
    console.log('🎯 [FINALIZATION] Token data:', JSON.stringify(tokenData, null, 2));
    
    const wabaUrl = `${META_URLS.GRAPH_API}/${wabaId}?fields=id,name,status`;
    console.log('🎯 [FINALIZATION] WABA info URL:', wabaUrl);
    
    const wabaResponse = await axios.get<MetaWABAResponse>(
      wabaUrl,
      {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      }
    );

    console.log('🎯 [FINALIZATION] WABA response status:', wabaResponse.status);
    console.log('🎯 [FINALIZATION] WABA response data:', JSON.stringify(wabaResponse.data, null, 2));

    const wabaInfo = wabaResponse.data;
    const businessName = wabaInfo.name || 'WhatsApp Business';
    const tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
    
    console.log('🎯 [FINALIZATION] Business name:', businessName);
    console.log('🎯 [FINALIZATION] Token expires at:', tokenExpiresAt);
    
    console.log('🎯 [FINALIZATION] Salvando integração no banco...');
    const { data: integration, error } = await supabase
      .from('whatsapp_business_integrations')
      .upsert({
        restaurant_id: restaurantId,
        business_account_id: wabaId,
        access_token: tokenData.access_token,
        business_name: businessName,
        connection_status: 'connected',
        is_active: true,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'restaurant_id' })
      .select('id')
      .single();

    if (error) {
      console.error('🎯 [FINALIZATION] ❌ Erro ao salvar integração:', error);
      throw error;
    }

    console.log('🎯 [FINALIZATION] ✅ Integração finalizada:', { integration_id: integration.id });
    console.log('🎯 [FINALIZATION] Response time:', Date.now() - startTime, 'ms');
    
    await logIntegrationStep('complete_flow', 'finalized', true, restaurantId, {
      waba_id: wabaId,
      waba_name: businessName,
      integration_id: integration.id,
      response_time: Date.now() - startTime
    });
    
    return { integration_id: integration.id };

  } catch (error: any) {
    console.error('🎯 [FINALIZATION] ❌ Erro ao finalizar integração:', error.response?.data || error.message);
    console.error('🎯 [FINALIZATION] Error details:', JSON.stringify(error.response?.data, null, 2));
    console.error('🎯 [FINALIZATION] Response time:', Date.now() - startTime, 'ms');
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
  const startTime = Date.now();
  
  try {
    console.log('🎯 [POLL_AND_FINALIZE] Executando polling e finalização...');
    console.log('🎯 [POLL_AND_FINALIZE] Strategy:', strategy);
    console.log('🎯 [POLL_AND_FINALIZE] WABA result:', JSON.stringify(wabaResult, null, 2));
    console.log('🎯 [POLL_AND_FINALIZE] Restaurant ID:', restaurantId);
    
    const businessId = await discoverBusinessId(tokenData.access_token);
    if (!businessId) {
      throw new Error('Business ID não encontrado para polling');
    }
    console.log('🎯 [POLL_AND_FINALIZE] Business ID para polling:', businessId);

    const pollingResult = await pollForWABA(businessId, tokenData.access_token, restaurantId);
    console.log('🎯 [POLL_AND_FINALIZE] Polling result:', JSON.stringify(pollingResult, null, 2));
    
    if (!pollingResult.found) {
      throw new Error('WABA não encontrada após polling');
    }

    const finalResult = await finalizeIntegration(pollingResult.waba_id!, tokenData, restaurantId);
    
    console.log('🎯 [POLL_AND_FINALIZE] ✅ Polling e finalização concluídos:', { 
      strategy, 
      waba_id: pollingResult.waba_id,
      integration_id: finalResult.integration_id,
      response_time: Date.now() - startTime
    });
    
    return finalResult;

  } catch (error: any) {
    console.error('🎯 [POLL_AND_FINALIZE] ❌ Erro no polling e finalização:', error.response?.data || error.message);
    console.error('🎯 [POLL_AND_FINALIZE] Error details:', JSON.stringify(error.response?.data, null, 2));
    console.error('🎯 [POLL_AND_FINALIZE] Response time:', Date.now() - startTime, 'ms');
    throw error;
  }
}

/**
 * Log de integração
 */
export async function logIntegrationStep(
  step: string,
  strategy: string,
  success: boolean,
  restaurantId: string,
  details: any = {}
): Promise<void> {
  try {
    console.log(`📝 [LOGGING] Salvando log de integração...`);
    console.log(`📝 [LOGGING] Step: ${step}`);
    console.log(`📝 [LOGGING] Strategy: ${strategy}`);
    console.log(`📝 [LOGGING] Success: ${success}`);
    console.log(`📝 [LOGGING] Restaurant ID: ${restaurantId}`);
    console.log(`📝 [LOGGING] Details:`, JSON.stringify(details, null, 2));
    
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step,
        strategy,
        success,
        error_message: success ? null : details.error || 'Erro desconhecido',
        details
      });
      
    console.log(`📝 [LOGGING] ✅ Log salvo com sucesso`);
  } catch (logError) {
    console.error('📝 [LOGGING] ❌ Erro ao salvar log de integração:', logError);
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
  console.log(`📝 [STRATEGY_FAILURE] Logging strategy failure...`);
  console.log(`📝 [STRATEGY_FAILURE] Strategy: ${strategy}`);
  console.log(`📝 [STRATEGY_FAILURE] Error:`, error.response?.data || error.message);
  console.log(`📝 [STRATEGY_FAILURE] Restaurant ID: ${restaurantId}`);
  
  await logIntegrationStep('waba_creation', strategy, false, restaurantId, {
    error: error.response?.data?.error?.message || error.message,
    error_code: error.response?.data?.error?.code,
    error_type: error.response?.data?.error?.type,
    status: error.response?.status
  });
}

// --- FUNÇÕES COMPATÍVEIS COM O CÓDIGO EXISTENTE ---

export async function createViaClientWhatsApp(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  return createWABAViaBSP(businessId, restaurantId);
}

export async function createViaDirectWABA(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  return createWABAViaBSP(businessId, restaurantId);
}

export async function createViaApplications(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  return createWABAViaBSP(businessId, restaurantId);
}

export async function createViaOfficialFlow(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  return createWABAViaBSP(businessId, restaurantId);
}

export async function createViaGlobalEndpoint(
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  // Esta estratégia não é mais necessária com a correção
  return {
    success: false,
    error: 'Estratégia não mais necessária'
  };
}

export default {
  discoverExistingWABA,
  createWABAViaBSP,
  createViaClientWhatsApp,
  createViaDirectWABA,
  createViaApplications,
  createViaOfficialFlow,
  createViaGlobalEndpoint,
  pollForWABA,
  exchangeCodeForToken,
  discoverBusinessId,
  finalizeIntegration,
  pollAndFinalize,
  logStrategyFailure,
  logIntegrationStep
};
