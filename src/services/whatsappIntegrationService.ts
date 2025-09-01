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
  whatsapp_business_accounts?: {
    data: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  };
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

// --- FUNÇÃO PRINCIPAL: Criação de WABA com token do usuário ---

/**
 * Cria WABA usando o token do usuário (não o token BSP)
 * Esta é a abordagem correta segundo o prompt original
 */
export async function createWABAWithUserToken(
  businessId: string, 
  userToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Criando WABA com token do usuário...');
    
    // Verificar permissões do usuário
    const permissionsResponse = await axios.get<{ data: Array<{ permission: string; status: string }> }>(
      `${META_URLS.GRAPH_API}/me/permissions`,
      {
        headers: { 'Authorization': `Bearer ${userToken}` },
        timeout: 10000
      }
    );

    const hasRequiredPermissions = permissionsResponse.data.data.some(
      p => p.permission === 'whatsapp_business_management' && p.status === 'granted'
    );

    if (!hasRequiredPermissions) {
      throw new Error('Usuário não tem permissões necessárias para criar WABA');
    }

    // Criar WABA usando o token do usuário
    const response = await axios.post<MetaWABAResponse>(
      `${META_URLS.GRAPH_API}/whatsapp_business_accounts`,
      {
        name: `WhatsApp Business - ${new Date().toISOString()}`,
        business_manager_id: businessId,
        category: "BUSINESS_TO_CUSTOMER"
      },
      {
        headers: { 
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const wabaId = response.data.id;
    console.log('🚀 ✅ WABA criada com sucesso:', { wabaId, businessId });

    // Log do sucesso
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'user_token_creation',
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
    console.error('🚀 ❌ Erro na criação de WABA:', error.response?.data || error.message);
    
    // Log do erro
    await supabase
      .from('whatsapp_integration_logs')
      .insert({
        restaurant_id: restaurantId,
        step: 'waba_creation',
        strategy: 'user_token_creation',
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

// --- FUNÇÃO DE DESCOBERTA DE WABA EXISTENTE ---

/**
 * Descobre WABA existente
 */
export async function discoverExistingWABA(
  businessId: string, 
  userToken: string, 
  restaurantId: string
): Promise<{ found: boolean; waba_id?: string; strategy?: string }> {
  try {
    console.log('🔍 Buscando WABA existente...');
    
    // Buscar via business
    try {
      const businessResponse = await axios.get<MetaWABAListResponse>(
        `${META_URLS.GRAPH_API}/${businessId}?fields=whatsapp_business_accounts{id,name,status}`,
        {
          headers: { 'Authorization': `Bearer ${userToken}` },
          timeout: 10000
        }
      );

      if (businessResponse.data?.whatsapp_business_accounts?.data && 
          businessResponse.data.whatsapp_business_accounts.data.length > 0) {
        const wabaId = businessResponse.data.whatsapp_business_accounts.data[0].id;
        console.log('🔍 ✅ WABA encontrada via business:', wabaId);
        
        return { found: true, waba_id: wabaId, strategy: 'business_search' };
      }
    } catch (error: any) {
      console.log('🔍 Business sem WABA:', error.response?.data?.error?.message || error.message);
    }

    // Buscar via páginas do usuário
    try {
      const pagesResponse = await axios.get<{ data: Array<{ id: string; name: string }> }>(
        `${META_URLS.GRAPH_API}/me/accounts?fields=id,name,whatsapp_business_account{id,name,status}`,
        {
          headers: { 'Authorization': `Bearer ${userToken}` },
          timeout: 10000
        }
      );

      for (const page of pagesResponse.data.data || []) {
        try {
          const pageWabaResponse = await axios.get<{ whatsapp_business_account?: { id: string; name: string; status: string } }>(
            `${META_URLS.GRAPH_API}/${page.id}?fields=whatsapp_business_account{id,name,status}`,
            {
              headers: { 'Authorization': `Bearer ${userToken}` },
              timeout: 10000
            }
          );

          if (pageWabaResponse.data?.whatsapp_business_account?.id) {
            const wabaId = pageWabaResponse.data.whatsapp_business_account.id;
            console.log('🔍 ✅ WABA encontrada via página:', { page: page.name, waba_id: wabaId });
            
            return { found: true, waba_id: wabaId, strategy: 'page_search' };
          }
        } catch (pageError: any) {
          console.log(`🔍 Página ${page.name} sem WABA:`, pageError.response?.data?.error?.message || pageError.message);
        }
      }
    } catch (error: any) {
      console.log('🔍 Erro ao buscar páginas:', error.response?.data?.error?.message || error.message);
    }

    console.log('🔍 ❌ Nenhuma WABA existente encontrada');
    return { found: false };

  } catch (error: any) {
    console.error('🔍 ❌ Erro ao buscar WABA existente:', error.response?.data || error.message);
    return { found: false };
  }
}

// --- SISTEMA DE POLLING ---

/**
 * Sistema de polling para verificar criação de WABA
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
      const searchResponse = await axios.get<MetaWABAListResponse>(
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
    }
    
    if (attempt < maxAttempts) {
      console.log('⏳ Aguardando 3 segundos antes da próxima tentativa...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  console.log(`⏳ ❌ WABA não encontrada após ${maxAttempts} tentativas`);
  
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

    const stateData = JSON.parse(decodeURIComponent(state));
    const { user_id: userId } = stateData;

    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code
    });

    const tokenResponse = await axios.get<MetaTokenResponse>(
      `${META_URLS.OAUTH_ACCESS_TOKEN}?${tokenParams.toString()}`
    );

    const { access_token, token_type, expires_in } = tokenResponse.data;
    const expiresIn = expires_in || 3600;

    console.log('🔄 ✅ Access token obtido com sucesso');

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
    
    const businessResponse = await axios.get<MetaBusinessResponse>(
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
 * Finaliza integração criando registro no banco
 */
export async function finalizeIntegration(
  wabaId: string, 
  tokenData: any, 
  restaurantId: string
): Promise<{ integration_id: string }> {
  try {
    console.log('🎯 Finalizando integração...');
    
    const wabaResponse = await axios.get<MetaWABAResponse>(
      `${META_URLS.GRAPH_API}/${wabaId}?fields=id,name,status`,
      {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      }
    );

    const wabaInfo = wabaResponse.data;
    
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
    
    const businessId = await discoverBusinessId(tokenData.access_token);
    if (!businessId) {
      throw new Error('Business ID não encontrado para polling');
    }

    const pollingResult = await pollForWABA(businessId, tokenData.access_token, restaurantId);
    
    if (!pollingResult.found) {
      throw new Error('WABA não encontrada após polling');
    }

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

// --- FUNÇÕES COMPATÍVEIS COM O CÓDIGO EXISTENTE ---

export async function createViaClientWhatsApp(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  return createWABAWithUserToken(businessId, bspToken, userId, restaurantId);
}

export async function createViaDirectWABA(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  return createWABAWithUserToken(businessId, bspToken, userId, restaurantId);
}

export async function createViaApplications(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  return createWABAWithUserToken(businessId, bspToken, userId, restaurantId);
}

export async function createViaOfficialFlow(
  businessId: string, 
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  return createWABAWithUserToken(businessId, bspToken, userId, restaurantId);
}

export async function createViaGlobalEndpoint(
  bspToken: string,
  userId: string,
  restaurantId: string
): Promise<WABACreationResult> {
  return createWABAWithUserToken('', bspToken, userId, restaurantId);
}

export default {
  discoverExistingWABA,
  createWABAWithUserToken,
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
  logStrategyFailure
};
