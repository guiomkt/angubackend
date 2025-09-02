import { supabase } from '../config/database';
import axios from 'axios';
import { META_CONFIG, META_URLS, BSP_CONFIG } from '../config/meta';

// --- Interfaces de Dados ---

/**
 * Representa a estrutura da tabela `whatsapp_business_integrations` no Supabase.
 */
interface WhatsAppIntegration {
  id: string;
  restaurant_id: string;
  business_account_id: string; // WABA ID
  phone_number_id: string;
  phone_number: string;
  business_name: string;
  access_token: string;
  token_expires_at: string | null;
  is_active: boolean;
  connection_status: 'connected' | 'disconnected' | 'pending';
  created_at: string;
  updated_at: string;
}

/**
 * Parâmetros necessários para configurar uma nova integração.
 */
interface SetupIntegrationParams {
  restaurantId: string;
  wabaId: string; // WhatsApp Business Account ID
  phoneNumberId: string;
  accessToken: string;
}

/**
 * Resposta da API da Meta para informações da WABA.
 */
interface WABAInfoResponse {
  id: string;
  name: string;
  status: string;
  phone_numbers?: {
    data: {
      id: string;
      display_phone_number: string;
      verified_name: string;
      status: string;
    }[];
  };
}

/**
 * Resposta da API da Meta para verificação do número de telefone.
 */
interface PhoneNumberStatusResponse {
    verified_name: string;
    quality_rating: string;
    code_verification_status: string;
    display_phone_number: string;
    status: string;
}

/**
 * Resposta da API da Meta para lista de números de telefone.
 */
interface PhoneNumbersResponse {
  data: {
    id: string;
    display_phone_number: string;
    verified_name: string;
    status: string;
  }[];
}

/**
 * Resposta da API da Meta para criação de número de telefone.
 */
interface CreatePhoneResponse {
  id: string;
  display_phone_number: string;
  status: string;
}

/**
 * Resposta da API da Meta para informações do número de telefone.
 */
interface PhoneInfoResponse {
  verified_name: string;
  quality_rating: string;
  code_verification_status: string;
  display_phone_number: string;
  status: string;
}

/**
 * Resposta da API da Meta para lista de WABAs.
 */
interface WABAListResponse {
  data: {
    id: string;
    name: string;
    status: string;
  }[];
}

/**
 * Resposta da API da Meta para informações do usuário.
 */
interface UserInfoResponse {
  id: string;
  name: string;
  email: string;
}

/**
 * Resposta da API da Meta para criação de WABA.
 */
interface CreateWABAResponse {
  id: string;
  name: string;
  status: string;
}

/**
 * Resposta da API da Meta para criação de WABA via client_whatsapp_applications.
 */
interface CreateClientWABAResponse {
  id: string;
  name: string;
  status: string;
}

interface CreateApplicationResponse {
  id: string;
  name: string;
  status: string;
}

/**
 * Resposta da API da Meta para lista de páginas.
 */
interface PagesResponse {
  data: {
    id: string;
    name: string;
    access_token: string;
  }[];
}

/**
 * Resposta da API da Meta para página com WABA conectado.
 */
interface PageWABAResponse {
  id: string;
  name: string;
  whatsapp_business_account?: {
    id: string;
    name: string;
    status: string;
  };
}

/**
 * Resposta da API da Meta para lista de businesses.
 */
interface BusinessListResponse {
  data: {
    id: string;
    name: string;
    status: string;
  }[];
}

/**
 * Resposta da API da Meta para business com WABAs.
 */
interface BusinessWABAResponse {
  id: string;
  name: string;
  whatsapp_business_accounts?: {
    data: Array<{
      id: string;
      name: string;
      status: string;
    }>;
  };
}

/**
 * Resposta da API da Meta para lista de WABAs clientes (shared).
 */
interface ClientWABAResponse {
  data: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

/**
 * Resposta da API da Meta para lista de WABAs próprias (owned).
 */
interface OwnedWABAResponse {
  data: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

/**
 * Resposta da API da Meta para OAuth access token.
 */
interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

// --- Classe de Serviço ---

/**
 * Serviço para gerenciar integração com WhatsApp Business API (Meta)
 * 
 * FLUXO DE EMBEDDED SIGNUP IMPLEMENTADO (BSP - Business Solution Provider):
 * 
 * 1. INÍCIO DO PROCESSO (/signup/start):
 *    - Gera URL de autorização OAuth com escopos necessários (v22.0)
 *    - Salva estado inicial no banco com state único
 *    - Redireciona usuário para Facebook
 * 
 * 2. CALLBACK OAUTH (/oauth/callback):
 *    - Troca code por User Access Token
 *    - Salva token no banco (meta_tokens e signup_states)
 *    - Chama discoverWABA() com fluxo híbrido
 * 
 * 3. DESCOBERTA/CRIAÇÃO DE WABA (FLUXO HÍBRIDO):
 *    - ESTRATÉGIA 1: Tentar descobrir WABA existente com User Access Token
 *      a) GET /me/businesses + whatsapp_business_accounts
 *      b) GET /me/accounts + whatsapp_business_account
 *    - ESTRATÉGIA 2: Se não encontrou, criar automaticamente via BSP
 *      a) POST /{business_id}/client_whatsapp_applications (System User Token)
 *      b) Aguarda propagação e verifica criação
 * 
 * 4. REGISTRO DE NÚMERO (/signup/register-phone):
 *    - Registra número via POST /{waba_id}/phone_numbers
 *    - Envia código de verificação via SMS/ligação
 * 
 * 5. VERIFICAÇÃO (/signup/verify-phone):
 *    - Confirma código via POST /{phone_number_id}/verify
 *    - Cria integração final na tabela whatsapp_business_integrations
 *    - Marca processo como 'completed'
 * 
 * 🔑 TOKENS UTILIZADOS:
 * - User Access Token (OAuth): Para descobrir WABAs existentes
 * - System User Access Token (BSP): Para criar WABAs automaticamente
 * 
 * 🔑 ESCOPOS OAUTH NECESSÁRIOS:
 * - whatsapp_business_management: Gerenciar WABA
 * - whatsapp_business_messaging: Enviar mensagens
 * - pages_show_list: Listar páginas
 * - pages_read_engagement: Ler dados das páginas
 * 
 * PRINCIPAIS MELHORIAS DESTA IMPLEMENTAÇÃO:
 * - Fluxo híbrido: descobre existente OU cria automaticamente
 * - Usa tokens apropriados para cada operação
 * - Criação automática via BSP quando necessário
 * - Estados bem definidos: oauth_completed, waba_detected, awaiting_number_verification, completed
 */
class WhatsAppService {
  public static readonly META_API_VERSION = META_CONFIG.API_VERSION;
  private static readonly META_GRAPH_URL = META_URLS.GRAPH_API;
  private static readonly PHONE_REGISTRATION_PIN = META_CONFIG.PHONE_REGISTRATION_PIN;

  // --- MÉTODOS PÚBLICOS DE ORQUESTRAÇÃO ---

  /**
   * Orquestra o processo completo de configuração de uma nova integração do WhatsApp.
   * Este é o principal ponto de entrada para conectar um novo restaurante.
   * @param params - Os dados necessários para a configuração.
   * @returns O ID da nova integração ou null em caso de falha.
   */
  public static async setupIntegration(params: SetupIntegrationParams): Promise<string | null> {
    const { restaurantId, wabaId, phoneNumberId, accessToken } = params;
    console.log(`Iniciando configuração para WABA: ${wabaId}, PhoneID: ${phoneNumberId}`);

    try {
      // 1. Inscreve o aplicativo para receber webhooks da WABA. Passo crucial.
      await this._subscribeAppToWABA(wabaId, accessToken);

      // 2. Busca informações detalhadas da WABA e do número de telefone.
      const wabaInfo = await this._getWABAInfo(wabaId, accessToken);
      
      // 3. Tenta registrar o número de telefone (ignora falhas se já estiver registrado).
      await this._registerPhoneNumber(phoneNumberId, accessToken);
      
      // 4. Verifica o status atualizado do número de telefone.
      const phoneStatus = await this._verifyPhoneNumber(phoneNumberId, accessToken);
      
      // 5. Persiste todos os dados coletados no banco de dados.
      const integrationData = {
        restaurant_id: restaurantId,
        business_account_id: wabaId,
        phone_number_id: phoneNumberId,
        access_token: accessToken,
        phone_number: phoneStatus.display_phone_number.replace(/\D/g, ''),
        status: phoneStatus.status || 'CONNECTED',
        business_name: phoneStatus.verified_name || wabaInfo.name,
      };

      const integrationId = await this._persistIntegrationData(integrationData);
      console.log(`Integração concluída com sucesso. ID: ${integrationId}`);
      
      return integrationId;

    } catch (error: any) {
      console.error('Erro detalhado no processo de setup da integração:', error.response?.data || error.message || error);
      return null;
    }
  }

  /**
   * ENSURE_WABA: Curto-circuita se já estiver tudo válido no DB; senão, provisiona (descobre/cria) e finaliza configuração.
   * Saídas padronizadas:
   *  - { status: 'proceeded', waba_id, phone_number_id }
   *  - { status: 'found', waba_id, source: 'owned' | 'client' }
   *  - { status: 'created', waba_id, strategy: 'bsp_client_waba' }
   *  - { status: 'awaiting_waba_creation', retry_after: 300 }
   */
  public static async ensureWABA(params: {
    restaurantId: string;
    code?: string;
    state?: string;
  }): Promise<
    | { status: 'proceeded'; waba_id: string; phone_number_id: string }
    | { status: 'found'; waba_id: string; source: 'owned' | 'client' }
    | { status: 'created'; waba_id: string; strategy: 'bsp_client_waba' }
    | { status: 'awaiting_waba_creation'; retry_after: number }
  > {
    const { restaurantId, code, state } = params;

    // 0) Curto-circuito via whatsapp_credentials
    const { data: cred } = await supabase
      .from('whatsapp_credentials')
      .select(
        'status, whatsapp_business_account_id, phone_number_id, user_access_token, business_id, phone_number'
      )
      .eq('restaurant_id', restaurantId)
      .single();

    if (
      cred &&
      cred.status && ['CONNECTED', 'ACTIVE'].includes(String(cred.status).toUpperCase()) &&
      cred.whatsapp_business_account_id &&
      cred.phone_number_id &&
      cred.user_access_token
    ) {
      const tokenValid = await this._validateUserAccessToken(cred.user_access_token).catch(() => false);
      if (tokenValid) {
        // Configuração final (idempotente)
        await this._logIntegrationStep(restaurantId, 'oauth', undefined, true, undefined, {
          short_circuit: true
        });

        await this._subscribeAppToWABA(cred.whatsapp_business_account_id, cred.user_access_token);

        // Registrar número (idempotente)
        await this._registerPhoneNumber(cred.phone_number_id, cred.user_access_token);

        // Verificar número
        const phoneInfo = await this._verifyPhoneNumber(cred.phone_number_id, cred.user_access_token);

        // Persistência mínima coerente
        await this._upsertCredentials(restaurantId, {
          status: 'CONNECTED',
          whatsapp_business_account_id: cred.whatsapp_business_account_id,
          phone_number_id: cred.phone_number_id,
          user_access_token: cred.user_access_token,
          business_id: cred.business_id,
          phone_number: phoneInfo.display_phone_number?.replace(/\D/g, '') || cred.phone_number || null,
          polling_status: 'verified',
          creation_strategy: cred.business_id ? 'bsp_client_waba' : null
        });

        // Atualizar integração consolidada
        await this._persistIntegrationData({
          restaurant_id: restaurantId,
          business_account_id: cred.whatsapp_business_account_id,
          phone_number_id: cred.phone_number_id,
          access_token: cred.user_access_token,
          phone_number: phoneInfo.display_phone_number?.replace(/\D/g, '') || cred.phone_number || '',
          status: phoneInfo.status || 'CONNECTED',
          business_name: phoneInfo.verified_name || 'WhatsApp Business'
        });

        return {
          status: 'proceeded',
          waba_id: cred.whatsapp_business_account_id,
          phone_number_id: cred.phone_number_id
        };
      }
    }

    // 1) Provisionamento
    // 1.1 Troca code -> user token (se necessário)
    let userAccessToken: string | undefined = cred?.user_access_token;
    let userIdFromToken: string | undefined = undefined;

    if (!userAccessToken) {
      if (!code || !state) {
        throw new Error('Authorization code e state são necessários para provisionamento');
      }
      const tokenData = await this._exchangeCodeForToken(code, state);
      userAccessToken = tokenData.access_token;
      userIdFromToken = tokenData.user_id;

      await this._upsertCredentials(restaurantId, {
        user_access_token: userAccessToken,
        oauth_access_token: userAccessToken,
        oauth_token_type: 'user',
        status: 'pending'
      });

      await this._logIntegrationStep(restaurantId, 'token_exchange', undefined, true, undefined, {
        user_id: userIdFromToken
      });
    }

    // Validar escopos mínimos
    const hasScopes = await this._validateUserAccessToken(userAccessToken!).catch(() => false);
    if (!hasScopes) {
      throw new Error('User access token inválido ou sem escopos necessários');
    }

    // 1.2 Descobrir businesses
    const businesses = await this._discoverBusinesses(userAccessToken!);

    // 1.3 Descobrir WABA existente nas edges corretas
    for (const bm of businesses) {
      const existingOwned = await this._discoverWABAOnEdge(userAccessToken!, bm.id, 'owned');
      if (existingOwned?.waba_id) {
        await this._upsertCredentials(restaurantId, {
          whatsapp_business_account_id: existingOwned.waba_id,
          business_id: bm.id,
          status: 'ACTIVE'
        });
        await this._logIntegrationStep(restaurantId, 'waba_discovery', 'existing_owned', true, undefined, {
          business_id: bm.id,
          waba_id: existingOwned.waba_id
        });
        return { status: 'found', waba_id: existingOwned.waba_id, source: 'owned' };
      }

      const existingClient = await this._discoverWABAOnEdge(userAccessToken!, bm.id, 'client');
      if (existingClient?.waba_id) {
        await this._upsertCredentials(restaurantId, {
          whatsapp_business_account_id: existingClient.waba_id,
          business_id: bm.id,
          status: 'ACTIVE'
        });
        await this._logIntegrationStep(restaurantId, 'waba_discovery', 'existing_client', true, undefined, {
          business_id: bm.id,
          waba_id: existingClient.waba_id
        });
        return { status: 'found', waba_id: existingClient.waba_id, source: 'client' };
      }
    }

    // 1.4 Criar WABA (BSP)
    const clientBusinessId = businesses[0]?.id;
    if (!clientBusinessId) {
      throw new Error('Nenhum Business Manager válido encontrado para o usuário');
    }

    await this._logIntegrationStep(restaurantId, 'waba_creation', 'bsp_client_waba', true, undefined, {
      client_business_id: clientBusinessId
    });

    await this._createClientWABAByBSP(clientBusinessId, restaurantId);

    // 1.5 Polling para localizar WABA criada
    const polled = await this._pollForWABA(userAccessToken!, clientBusinessId);
    if (polled?.waba_id) {
      await this._upsertCredentials(restaurantId, {
        whatsapp_business_account_id: polled.waba_id,
        business_id: clientBusinessId,
        status: 'ACTIVE',
        creation_strategy: 'bsp_client_waba'
      });
      return { status: 'created', waba_id: polled.waba_id, strategy: 'bsp_client_waba' };
    }

    // Não localizou ainda
    await this._upsertCredentials(restaurantId, {
      status: 'awaiting_waba_creation',
      business_id: clientBusinessId,
      polling_status: 'not_found'
    });

    await this._logIntegrationStep(
      restaurantId,
      'polling_system',
      'bsp_client_waba',
      false,
      'WABA não encontrada após polling',
      { client_business_id: clientBusinessId }
    );

    return { status: 'awaiting_waba_creation', retry_after: 300 };
  }

  // --- MÉTODOS PRIVADOS (Lógica Interna da API da Meta) ---

  /**
   * Inscreve nosso aplicativo na WABA para receber webhooks.
   * @private
   */
  private static async _subscribeAppToWABA(wabaId: string, token: string): Promise<void> {
    try {
      await axios.post(
        `${this.META_GRAPH_URL}/${wabaId}/subscribed_apps`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log('App inscrito na WABA com sucesso.');
    } catch (error: any) {
      // Código de erro específico da Meta para "já inscrito". Consideramos isso um sucesso.
      if (error.response?.data?.error?.code === 100 && error.response?.data?.error?.error_subcode === 2018001) {
        console.log('App já estava inscrito na WABA. Continuando.');
        return;
      }
      throw new Error(`Falha ao inscrever app na WABA: ${error.response?.data?.error?.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Busca informações detalhadas da WABA, incluindo os números de telefone associados.
   * @private
   */
  private static async _getWABAInfo(wabaId: string, token: string): Promise<WABAInfoResponse> {
    try {
      const response = await axios.get<WABAInfoResponse>(
        `${this.META_GRAPH_URL}/${wabaId}`,
        {
          params: { fields: 'id,name,status,phone_numbers{id,display_phone_number,verified_name,status}' },
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      console.log('Informações da WABA obtidas com sucesso.');
      return response.data;
    } catch (error: any) {
      throw new Error(`Falha ao buscar informações da WABA: ${error.response?.data?.error?.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Registra o número de telefone na WhatsApp Cloud API.
   * @private
   */
  private static async _registerPhoneNumber(phoneNumberId: string, token: string): Promise<void> {
    try {
      await axios.post(
        `${this.META_GRAPH_URL}/${phoneNumberId}/register`,
        { messaging_product: "whatsapp", pin: this.PHONE_REGISTRATION_PIN },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      console.log('Número de telefone registrado com sucesso.');
    } catch (error: any) {
       // É comum que o número já esteja registrado. Logamos como aviso, mas não paramos o fluxo.
       console.warn(`Aviso ao registrar número: ${error.response?.data?.error?.message || 'Pode já estar registrado'}`);
    }
  }

  /**
   * Verifica o status detalhado de um número de telefone.
   * @private
   */
  private static async _verifyPhoneNumber(phoneNumberId: string, token: string): Promise<PhoneNumberStatusResponse> {
    try {
      const response = await axios.get<PhoneNumberStatusResponse>(
        `${this.META_GRAPH_URL}/${phoneNumberId}`,
        {
          params: { fields: 'verified_name,quality_rating,code_verification_status,display_phone_number,status' },
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      console.log('Status do número de telefone verificado com sucesso.');
      return response.data;
    } catch (error: any) {
      throw new Error(`Falha ao verificar o número de telefone: ${error.response?.data?.error?.message || 'Erro desconhecido'}`);
    }
  }

  // --- MÉTODOS PRIVADOS (Lógica de Banco de Dados) ---

  /**
   * Salva ou atualiza os dados da integração no banco de dados (Supabase).
   * @private
   */
  private static async _persistIntegrationData(data: {
    restaurant_id: string;
    business_account_id: string;
    phone_number_id: string;
    access_token: string;
    phone_number: string;
    status: string;
    business_name: string;
  }): Promise<string> {
    const now = new Date().toISOString();
    
    const integrationRecord = {
      restaurant_id: data.restaurant_id,
      business_account_id: data.business_account_id,
      phone_number_id: data.phone_number_id,
      access_token: data.access_token,
      phone_number: data.phone_number,
      business_name: data.business_name,
      connection_status: 'connected',
      is_active: true,
      token_expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(), // Token válido por 24h
      updated_at: now,
    };

    // Usamos 'upsert' para criar ou atualizar a integração baseada no restaurant_id.
    const { data: result, error } = await supabase
      .from('whatsapp_business_integrations')
      .upsert(integrationRecord, { onConflict: 'restaurant_id' })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao salvar dados da integração no Supabase:', error);
      throw new Error(`Falha ao persistir dados da integração: ${error.message}`);
    }
    
    // ATUALIZAÇÕES EM OUTRAS TABELAS (se necessário)
    // Exemplo: Atualizar o telefone principal do restaurante
    const { error: restaurantUpdateError } = await supabase
        .from('restaurants')
        .update({ phone: data.phone_number, updated_at: now })
        .eq('id', data.restaurant_id);

    if (restaurantUpdateError) {
        // Logamos como aviso, pois a integração principal foi criada com sucesso.
        console.warn(`Aviso: Falha ao atualizar tabela 'restaurants': ${restaurantUpdateError.message}`);
    }

    return result.id;
  }
  
  // --- MÉTODOS PÚBLICOS DE GERENCIAMENTO (Já existentes no seu código) ---

  /**
   * Busca a integração ativa do WhatsApp para um restaurante.
   */
  public static async getActiveIntegration(restaurant_id: string): Promise<WhatsAppIntegration | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_business_integrations')
        .select('*')
        .eq('restaurant_id', restaurant_id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      // Normal to not have an integration
      return null;
    }
  }

  /**
   * Envia uma mensagem de template do WhatsApp.
   */
  public static async sendTemplateMessage(params: {
    to: string;
    template_name: string;
    language: string;
    parameters?: any[];
    restaurant_id: string;
  }) {
    try {
      const integration = await this.getActiveIntegration(params.restaurant_id);
      if (!integration) {
        throw new Error(`Nenhuma integração ativa encontrada para o restaurante ID: ${params.restaurant_id}`);
      }

      const messagePayload = {
        messaging_product: 'whatsapp',
        to: params.to,
        type: 'template',
        template: {
          name: params.template_name,
          language: { code: params.language },
          components: params.parameters ? [{ type: 'body', parameters: params.parameters }] : []
        }
      };

      const response = await axios.post(
        `${this.META_GRAPH_URL}/${integration.phone_number_id}/messages`,
        messagePayload,
        { headers: { 'Authorization': `Bearer ${integration.access_token}` } }
      );

      return { success: true, data: response.data };
    } catch (error: any) {
      console.error('Erro ao enviar mensagem de template:', error.response?.data || error.message);
      return { success: false, error: 'Falha ao enviar mensagem de template.' };
    }
  }

  // --- NOVOS MÉTODOS PARA EMBEDDED SIGNUP META (BSP) ---

  /**
   * Inicia o fluxo de Embedded Signup da Meta para WhatsApp Business.
   * Gera URL de autorização OAuth com escopos necessários.
   */
  public static async startEmbeddedSignup(userId: string, restaurantId: string): Promise<{
    authUrl: string;
    state: string;
  }> {
    try {
      const clientId = process.env.FACEBOOK_APP_ID;
      if (!clientId) {
        throw new Error('FACEBOOK_APP_ID não configurado');
      }

      // Gerar state único e estruturado para rastreabilidade
      const stateData = {
        flow: 'embedded_signup',
        user_id: userId,
        restaurant_id: restaurantId,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15)
      };

      const encodedState = encodeURIComponent(JSON.stringify(stateData));

      // URL de autorização com escopos completos para WhatsApp Business
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${process.env.API_BASE_URL || 'https://api.angu.ai'}/api/whatsapp/oauth/callback-v2`,
        state: encodedState,
        scope: META_CONFIG.OAUTH_SCOPES,
        response_type: 'code'
      });

      const authUrl = `${META_URLS.OAUTH_DIALOG}?${params.toString()}`;

      // Salvar estado inicial no banco com state para validação
      console.log('🔍 Salvando estado inicial no banco...', { userId, restaurantId, status: 'pending' });
      await this._saveSignupStateWithState(userId, restaurantId, 'pending', encodedState);
      console.log('🔍 ✅ Estado salvo com sucesso no banco');

      console.log('🔍 Embedded Signup iniciado:', { 
        userId, 
        restaurantId, 
        state: encodedState.substring(0, 50) + '...',
        stateData 
      });

      return {
        authUrl,
        state: encodedState
      };

    } catch (error: any) {
      console.error('Erro ao iniciar Embedded Signup:', error);
      throw new Error(`Falha ao iniciar configuração: ${error.message}`);
    }
  }

  /**
   * Processa o callback do OAuth e salva o access token.
   * NOVO: Implementa troca segura de code → access_token e persistência no banco.
   */
  public static async handleOAuthCallback(
    code: string, 
    state: string
  ): Promise<{
    success: boolean;
    message: string;
    status: string;
    waba_id?: string;
    needs_phone_registration?: boolean;
    error_details?: string;
  }> {
    try {
      console.log('🔍 Processando OAuth callback...', { state: state.substring(0, 50) + '...' });

      // 1. Validar e decodificar state
      let stateData: any;
      try {
        stateData = JSON.parse(decodeURIComponent(state));
      } catch (error) {
        throw new Error('State inválido ou malformado');
      }

      const { user_id: userId, restaurant_id: restaurantId } = stateData;
      if (!userId || !restaurantId) {
        throw new Error('State não contém user_id ou restaurant_id válidos');
      }

      // 2. Verificar se o state existe no banco
      console.log('🔍 Buscando estado no banco...', { 
        state: state.substring(0, 50) + '...', 
        userId, 
        restaurantId 
      });
      
      const { data: existingState, error: stateError } = await supabase
        .from('whatsapp_signup_states')
        .select('*')
        .eq('state', state)
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (stateError) {
        console.error('🔍 ❌ Erro ao buscar estado:', stateError);
        throw new Error(`Erro ao buscar estado: ${stateError.message}`);
      }

      if (!existingState) {
        console.error('🔍 ❌ Estado não encontrado no banco');
        
        // Tentar buscar por user_id e restaurant_id para debug
        const { data: debugStates } = await supabase
          .from('whatsapp_signup_states')
          .select('*')
          .eq('user_id', userId)
          .eq('restaurant_id', restaurantId);
        
        console.log('🔍 Estados encontrados para debug:', debugStates);
        throw new Error('Estado de signup não encontrado ou expirado');
      }

      console.log('🔍 ✅ Estado encontrado no banco:', { 
        id: existingState.id, 
        status: existingState.status, 
        created_at: existingState.created_at 
      });

      // 3. Trocar code por access_token
      const clientId = process.env.FACEBOOK_APP_ID;
      const clientSecret = process.env.FACEBOOK_APP_SECRET;
      const redirectUri = `${process.env.API_BASE_URL || 'https://api.angu.ai'}/api/whatsapp/oauth/callback-v2`;

      if (!clientId || !clientSecret) {
        throw new Error('Credenciais do Facebook não configuradas');
      }

      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code
      });

      console.log('🔍 Trocando code por access_token...');
      const tokenResponse = await axios.get<OAuthTokenResponse>(
        `${META_URLS.OAUTH_ACCESS_TOKEN}?${tokenParams.toString()}`
      );

      const accessToken = tokenResponse.data.access_token;
      const expiresIn = tokenResponse.data.expires_in || 3600; // 1 hora padrão

      console.log('🔍 ✅ Access token obtido com sucesso');

      // 4. Salvar token no banco (meta_tokens)
      const tokenExpiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
      
      await supabase
        .from('meta_tokens')
        .upsert({
          user_id: userId,
          restaurant_id: restaurantId,
          access_token: accessToken,
          token_type: 'user',
          expires_at: tokenExpiresAt,
          integration_type: 'whatsapp_business',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,restaurant_id' });

      // 5. Atualizar signup state com access token
      await this._updateSignupState(userId, restaurantId, {
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        status: 'oauth_completed'
      });

      console.log('🔍 ✅ Tokens salvos no banco');

      // 6. Descobrir ou criar WABA (fluxo híbrido)
      try {
        const wabaId = await this.discoverWABA(userId, restaurantId, accessToken);
        
        console.log('🔍 ✅ WABA descoberta ou criada:', wabaId);

        // WABA encontrada ou criada - atualizar estado
        await this._updateSignupState(userId, restaurantId, {
          waba_id: wabaId,
          status: 'waba_detected'
        });

        return {
          success: true,
          message: 'OAuth concluído com sucesso. WABA configurada.',
          status: 'waba_detected',
          waba_id: wabaId,
          needs_phone_registration: true
        };

      } catch (wabaError: any) {
        console.log('🔍 ❌ Erro ao descobrir/criar WABA:', wabaError.message);
        
        if (wabaError.message === 'WABA_NOT_FOUND' || wabaError.message === 'WABA_CREATION_FAILED') {
          // Marcar como aguardando criação manual de WABA
          await this._updateSignupState(userId, restaurantId, {
            status: 'awaiting_waba_creation'
          });

          const errorMessage = wabaError.message === 'WABA_CREATION_FAILED' 
            ? 'OAuth concluído, mas falhamos ao criar automaticamente uma conta WhatsApp Business. Complete o processo no Facebook Business Manager.'
            : 'OAuth concluído, mas nenhuma conta WhatsApp Business foi encontrada. Complete o processo no Facebook Business Manager.';

          return {
            success: false,
            message: errorMessage,
            status: 'awaiting_waba_creation',
            error_details: wabaError.message === 'WABA_CREATION_FAILED' 
              ? 'Falha na criação automática via BSP. Verifique logs para detalhes.'
              : 'Nenhuma WABA existente encontrada.'
          };
        } else {
          throw wabaError;
        }
      }

    } catch (error: any) {
      console.error('🔍 ❌ Erro no OAuth callback:', error);
      throw new Error(`Falha no callback OAuth: ${error.message}`);
    }
  }

  /**
   * Verifica o status atual do processo de Embedded Signup.
   * Pode buscar por userId/restaurantId ou por state.
   */
  public static async getEmbeddedSignupStatus(
    userId?: string, 
    restaurantId?: string,
    state?: string
  ): Promise<{
    status: 'pending' | 'oauth_completed' | 'awaiting_waba_creation' | 'waba_detected' | 'awaiting_number_verification' | 'completed' | 'failed';
    waba_id?: string;
    phone_number_id?: string;
    phone_number?: string;
    business_name?: string;
    verification_status?: string;
    business_id?: string;
    needs_phone_registration?: boolean;
    has_access_token?: boolean;
  }> {
    try {
      let signupState: any = null;

      // Buscar por state se fornecido
      if (state) {
        const { data } = await supabase
          .from('whatsapp_signup_states')
          .select('*')
          .eq('state', state)
          .single();
        signupState = data;
      }
      // Senão, buscar por userId e restaurantId
      else if (userId && restaurantId) {
        // Buscar integração existente primeiro
        const integration = await this.getActiveIntegration(restaurantId);
        
        if (integration) {
          return {
            status: 'completed',
            waba_id: integration.business_account_id,
            phone_number_id: integration.phone_number_id,
            phone_number: integration.phone_number,
            business_name: integration.business_name,
            verification_status: 'verified'
          };
        }

        // Buscar estado do processo de signup
        const { data } = await supabase
          .from('whatsapp_signup_states')
          .select('*')
          .eq('user_id', userId)
          .eq('restaurant_id', restaurantId)
          .single();
        signupState = data;
      }

      if (!signupState) {
        return { status: 'pending' };
      }

      // Determinar se precisa registrar número
      const needsPhoneRegistration = signupState.waba_id && !signupState.phone_number_id;
      const hasAccessToken = !!signupState.access_token;

      return {
        status: signupState.status as any,
        waba_id: signupState.waba_id,
        phone_number_id: signupState.phone_number_id,
        phone_number: signupState.phone_number,
        business_name: signupState.business_name,
        business_id: signupState.business_id,
        verification_status: signupState.verification_status,
        needs_phone_registration: needsPhoneRegistration,
        has_access_token: hasAccessToken
      };

    } catch (error: any) {
      console.error('Erro ao verificar status do Embedded Signup:', error);
      return { status: 'failed' };
    }
  }

  /**
   * Registra um novo número de telefone na WABA durante o Embedded Signup.
   */
  public static async registerPhoneNumber(
    userId: string, 
    restaurantId: string, 
    phoneNumber: string, 
    pin?: string
  ): Promise<{
    success: boolean;
    message: string;
    phone_number_id?: string;
  }> {
    try {
      console.log('🔍 Iniciando registro de número:', { userId, restaurantId, phoneNumber });

      // Buscar estado atual do signup
      const { data: signupState } = await supabase
        .from('whatsapp_signup_states')
        .select('*')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (!signupState?.waba_id) {
        throw new Error('WABA não encontrada. Complete o processo OAuth primeiro.');
      }

      if (!signupState?.access_token) {
        throw new Error('Token de acesso não encontrado. Complete o processo OAuth primeiro.');
      }

      const usedPin = pin || this.PHONE_REGISTRATION_PIN;
      console.log('🔍 Usando PIN:', usedPin);

      // Registrar número via Edge Function
      console.log('🔍 Chamando Edge Function para registrar número...');
      const edgeFunctionUrl = `${process.env.SUPABASE_URL}/functions/v1/register-waba`;
      
      const registerResponse = await axios.post<{
        success: boolean;
        data?: {
          phone_status?: { id: string };
        };
        error?: string;
      }>(edgeFunctionUrl, {
        restaurantId,
        credential: {
          phone_number_id: signupState.phone_number_id,
          waba_id: signupState.waba_id,
          access_token: signupState.access_token,
          phone_number: phoneNumber
        }
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 Resposta da Edge Function (registro):', JSON.stringify(registerResponse.data, null, 2));

      if (!registerResponse.data.success) {
        throw new Error(registerResponse.data.error || 'Falha no registro via Edge Function');
      }

      const phoneNumberId = registerResponse.data.data?.phone_status?.id || signupState.phone_number_id;

      // Atualizar estado do signup
      await this._updateSignupState(userId, restaurantId, {
        phone_number_id: phoneNumberId,
        phone_number: phoneNumber,
        status: 'awaiting_number_verification',
        verification_status: 'pending'
      });

      console.log('🔍 ✅ Número registrado com sucesso:', { phoneNumberId, phoneNumber });

      return {
        success: true,
        message: 'Número registrado com sucesso. Código de verificação enviado via SMS.',
        phone_number_id: phoneNumberId
      };

    } catch (error: any) {
      console.error('🔍 ❌ Erro ao registrar número de telefone:', error.response?.data || error.message);
      throw new Error(`Falha ao registrar número: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Verifica o código de verificação do número de telefone.
   */
  public static async verifyPhoneNumberCode(
    userId: string, 
    restaurantId: string, 
    phoneNumberId: string, 
    verificationCode: string
  ): Promise<{
    success: boolean;
    message: string;
    integration_id?: string;
  }> {
    try {
      console.log('🔍 Iniciando verificação de código:', { userId, restaurantId, phoneNumberId, code: '***' });

      // Buscar estado atual do signup
      const { data: signupState } = await supabase
        .from('whatsapp_signup_states')
        .select('*')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (!signupState?.access_token) {
        throw new Error('Token de acesso não encontrado.');
      }

      if (signupState.phone_number_id !== phoneNumberId) {
        throw new Error('ID do número de telefone não corresponde ao processo atual.');
      }

      // Verificar código via API da Meta
      console.log('🔍 Chamando API da Meta para verificar código...');
      await axios.post(
        `${this.META_GRAPH_URL}/${phoneNumberId}/verify`,
        {
          messaging_product: 'whatsapp',
          code: verificationCode
        },
        {
          headers: { 'Authorization': `Bearer ${signupState.access_token}` }
        }
      );

      console.log('🔍 ✅ Código verificado com sucesso');

      // Buscar informações atualizadas do número
      console.log('🔍 Buscando informações atualizadas do número...');
      const phoneInfo = await axios.get<PhoneInfoResponse>(
        `${this.META_GRAPH_URL}/${phoneNumberId}`,
        {
          params: { fields: 'verified_name,quality_rating,code_verification_status,display_phone_number,status' },
          headers: { 'Authorization': `Bearer ${signupState.access_token}` }
        }
      );

      console.log('🔍 Informações do número verificado:', JSON.stringify(phoneInfo.data, null, 2));

      // Criar integração completa
      const integrationData = {
        restaurant_id: restaurantId,
        business_account_id: signupState.waba_id!,
        phone_number_id: phoneNumberId,
        access_token: signupState.access_token,
        phone_number: phoneInfo.data.display_phone_number.replace(/\D/g, ''),
        business_name: phoneInfo.data.verified_name || signupState.business_name || 'WhatsApp Business',
        status: phoneInfo.data.status || 'CONNECTED'
      };

      console.log('🔍 Criando integração final...', integrationData);
      const integrationId = await this._persistIntegrationData(integrationData);

      // Atualizar estado para completado
      await this._updateSignupState(userId, restaurantId, {
        status: 'completed',
        verification_status: 'verified',
        business_name: phoneInfo.data.verified_name || signupState.business_name
      });

      console.log('🔍 ✅ Processo de Embedded Signup concluído com sucesso:', { phoneNumberId, integrationId });

      return {
        success: true,
        message: 'Verificação confirmada com sucesso. WhatsApp Business configurado!',
        integration_id: integrationId
      };

    } catch (error: any) {
      console.error('🔍 ❌ Erro ao verificar código do telefone:', error.response?.data || error.message);
      throw new Error(`Falha ao verificar código: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Força nova verificação de WABA após usuário ter criado/conectado uma manualmente.
   */
  public static async refreshWABAStatus(
    userId: string, 
    restaurantId: string, 
    state: string
  ): Promise<{
    success: boolean;
    message: string;
    status: string;
    waba_id?: string;
    next_step?: string;
  }> {
    try {
      // Buscar estado atual do signup
      const { data: signupState } = await supabase
        .from('whatsapp_signup_states')
        .select('*')
        .eq('state', state)
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (!signupState) {
        throw new Error('Processo de signup não encontrado.');
      }

      if (signupState.status !== 'awaiting_waba_creation') {
        return {
          success: true,
          message: 'Status já foi atualizado.',
          status: signupState.status,
          waba_id: signupState.waba_id
        };
      }

      if (!signupState.access_token) {
        throw new Error('Token de acesso não encontrado. Reinicie o processo OAuth.');
      }

      // Tentar descobrir WABA novamente (fluxo híbrido)
      try {
        const wabaId = await this.discoverWABA(userId, restaurantId);
        
        // WABA encontrada - atualizar estado
        await this._updateSignupState(userId, restaurantId, {
          waba_id: wabaId,
          status: 'waba_detected'
        });

        console.log('🔍 Refresh WABA - ✅ WABA encontrada:', { wabaId, state });

        return {
          success: true,
          message: 'WABA encontrada com sucesso!',
          status: 'waba_detected',
          waba_id: wabaId,
          next_step: 'register_phone'
        };

      } catch (wabaError: any) {
        if (wabaError.message === 'WABA_NOT_FOUND' || wabaError.message === 'WABA_CREATION_FAILED') {
          console.log('🔍 Refresh WABA - ❌ WABA ainda não encontrada');
          
          const errorMessage = wabaError.message === 'WABA_CREATION_FAILED' 
            ? 'Falhamos ao criar automaticamente uma conta WhatsApp Business. Complete o processo no Facebook Business Manager.'
            : 'WABA ainda não encontrada. Verifique se você criou/conectou a conta WhatsApp Business no Facebook Business Manager.';
          
          return {
            success: false,
            message: errorMessage,
            status: 'awaiting_waba_creation'
          };
        } else {
          throw wabaError;
        }
      }

    } catch (error: any) {
      console.error('Erro ao atualizar status da WABA:', error);
      throw new Error(`Falha ao atualizar status: ${error.message}`);
    }
  }

  // --- MÉTODOS PRIVADOS AUXILIARES ---

  /**
   * Salva o estado inicial do processo de signup.
   * @private
   */
  private static async _saveSignupState(
    userId: string, 
    restaurantId: string, 
    status: string
  ): Promise<void> {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('whatsapp_signup_states')
      .upsert({
        user_id: userId,
        restaurant_id: restaurantId,
        status,
        verification_status: 'pending',
        created_at: now,
        updated_at: now
      }, { onConflict: 'user_id,restaurant_id' });

    if (error) {
      console.error('Erro ao salvar estado do signup:', error);
      throw new Error(`Falha ao salvar estado: ${error.message}`);
    }
  }

  /**
   * Salva o estado inicial do processo de signup com state para validação.
   * @private
   */
  private static async _saveSignupStateWithState(
    userId: string, 
    restaurantId: string, 
    status: string,
    state: string
  ): Promise<void> {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('whatsapp_signup_states')
      .upsert({
        user_id: userId,
        restaurant_id: restaurantId,
        status,
        state,
        verification_status: 'pending',
        created_at: now,
        updated_at: now
      }, { onConflict: 'user_id,restaurant_id' });

    if (error) {
      console.error('Erro ao salvar estado do signup com state:', error);
      throw new Error(`Falha ao salvar estado: ${error.message}`);
    }
  }

  /**
   * Atualiza o estado do processo de signup.
   * @private
   */
  private static async _updateSignupState(
    userId: string, 
    restaurantId: string, 
    updates: Partial<{
      status: string;
      waba_id: string;
      phone_number_id: string;
      phone_number: string;
      business_name: string;
      verification_status: string;
      access_token: string;
      token_expires_at: string;
      business_id: string;
    }>
  ): Promise<void> {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('whatsapp_signup_states')
      .update({
        ...updates,
        updated_at: now
      })
      .eq('user_id', userId)
      .eq('restaurant_id', restaurantId);

    if (error) {
      console.error('Erro ao atualizar estado do signup:', error);
      throw new Error(`Falha ao atualizar estado: ${error.message}`);
    }
  }

  /**
   * CORRIGIDO: Descobre WABA existente ou retorna erro para criação manual
   * Baseado na documentação oficial do Meta - Embedded Signup deve criar WABAs automaticamente
   */
  public static async discoverWABA(
    userId: string, 
    restaurantId: string,
    userAccessToken?: string
  ): Promise<string> {
    try {
      console.log('🔍 Iniciando descoberta de WABA existente...', { userId, restaurantId, hasUserToken: !!userAccessToken });
      
      if (!userAccessToken) {
        throw new Error('User Access Token é necessário para descobrir WABA');
      }
      
      // ESTRATÉGIA ÚNICA: Buscar WABA existente (Embedded Signup deve ter criado)
      console.log('🔍 Buscando WABA existente via User Access Token...');
      
      try {
        // Buscar WABAs via business accounts do usuário
        const businessResponse = await axios.get<BusinessListResponse>(
          `${this.META_GRAPH_URL}/me/businesses?fields=id,name`,
          {
            headers: { 'Authorization': `Bearer ${userAccessToken}` }
          }
        );

        const businesses = businessResponse.data?.data || [];
        console.log(`🔍 Businesses encontrados: ${businesses.length}`, businesses.map(b => ({ id: b.id, name: b.name })));

        // Para cada business, verificar se tem WABA
        for (const business of businesses) {
          try {
            console.log(`🔍 Verificando business: ${business.name} (${business.id})`);
            
            const businessWabaResponse = await axios.get<BusinessWABAResponse>(
              `${this.META_GRAPH_URL}/${business.id}?fields=whatsapp_business_accounts{id,name,status}`,
              {
                headers: { 'Authorization': `Bearer ${userAccessToken}` }
              }
            );

            if (businessWabaResponse.data?.whatsapp_business_accounts?.data && businessWabaResponse.data.whatsapp_business_accounts.data.length > 0) {
              const wabaId = businessWabaResponse.data.whatsapp_business_accounts.data[0].id;
              console.log('🔍 ✅ WABA encontrada via business:', wabaId);
              
              // Salvar business_id no signup state
              await this._updateSignupState(userId, restaurantId, {
                business_id: business.id,
                waba_id: wabaId
              });
              
              return wabaId;
            }
          } catch (error: any) {
            console.log(`🔍 Business ${business.name} sem WABA:`, error.response?.data?.error?.message || 'sem WABA');
            continue;
          }
        }
      } catch (error: any) {
        console.log('🔍 ❌ Erro ao buscar businesses:', error.response?.data || error.message);
      }

      // Tentar buscar via páginas (fallback)
      try {
        const pagesResponse = await axios.get<PagesResponse>(
          `${this.META_GRAPH_URL}/me/accounts`,
          {
            headers: { 'Authorization': `Bearer ${userAccessToken}` }
          }
        );

        const pages = pagesResponse.data?.data || [];
        console.log(`🔍 Páginas encontradas: ${pages.length}`, pages.map(p => ({ id: p.id, name: p.name })));

        // Para cada página, verificar se tem WABA conectado
        for (const page of pages) {
          try {
            console.log(` Verificando página: ${page.name} (${page.id})`);
            
            const pageWabaResponse = await axios.get<PageWABAResponse>(
              `${this.META_GRAPH_URL}/${page.id}?fields=whatsapp_business_account{id,name,status}`,
              {
                headers: { 'Authorization': `Bearer ${userAccessToken}` }
              }
            );

            if (pageWabaResponse.data?.whatsapp_business_account) {
              const wabaId = pageWabaResponse.data.whatsapp_business_account.id;
              console.log('🔍 ✅ WABA encontrada via página:', wabaId);
              
              // Salvar business_id no signup state
              await this._updateSignupState(userId, restaurantId, {
                business_id: page.id,
                waba_id: wabaId
              });
              
              return wabaId;
            }
          } catch (error: any) {
            // Página sem WABA conectado - continuar para próxima
            console.log(` Página ${page.name} sem WABA conectado:`, error.response?.data?.error?.message || 'sem WABA');
            continue;
          }
        }
      } catch (error: any) {
        console.log('🔍 ❌ Erro ao buscar via páginas:', error.response?.data || error.message);
      }

      // Se não encontrou WABA existente, retornar erro específico
      console.log('🔍 ❌ Nenhuma WABA existente encontrada');
      
      // Marcar estado como awaiting_waba_creation
      await this._updateSignupState(userId, restaurantId, {
        status: 'awaiting_waba_creation'
      });

      throw new Error('WABA_NOT_FOUND');

    } catch (error: any) {
      if (error.message === 'WABA_NOT_FOUND') {
        throw error;
      }
      console.error('🔍 ❌ Erro geral ao descobrir WABA:', error);
      throw new Error(`Falha ao descobrir WhatsApp Business: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Cria uma nova WABA automaticamente via BSP usando System User Token.
   * @private
   */
  private static async _createWABAViaBSP(
    userId: string, 
    restaurantId: string,
    userAccessToken: string
  ): Promise<string> {
    try {
      console.log('🔍 Iniciando criação automática de WABA via BSP...');
      
      // Verificar se temos as configurações de BSP necessárias
      console.log('🔍 Verificando configurações BSP...');
      console.log('🔍 SYSTEM_USER_ACCESS_TOKEN:', BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN ? '✅ Configurado' : '❌ NÃO CONFIGURADO');
      
      if (!BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN) {
        console.error('🔍 ❌ System User Token não encontrado');
        throw new Error('SYSTEM_USER_TOKEN_MISSING');
      }
      
      console.log('🔍 ✅ Token BSP válido');

      // Testar token BSP primeiro
      console.log('🔍 Testando token BSP...');
      try {
        const testResponse = await axios.get<{ name: string; id: string }>(
          `${this.META_GRAPH_URL}/me`,
          {
            headers: { 'Authorization': `Bearer ${BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN}` }
          }
        );
        console.log('🔍 ✅ Token BSP válido, usuário:', testResponse.data.name);
      } catch (testError: any) {
        console.error('🔍 ❌ Token BSP inválido:', testError.response?.data || testError.message);
        throw new Error(`Token BSP inválido: ${testError.response?.data?.error?.message || testError.message}`);
      }
      
      // Usar Business ID fixo do BSP
      console.log('🔍 Usando Business ID fixo do BSP:', BSP_CONFIG.BSP_BUSINESS_ID);
      
      // Buscar Business ID do usuário (cliente) para criar WABA
      console.log('🔍 Buscando Business ID do usuário cliente...');
      
      const businessResponse = await axios.get<BusinessListResponse>(
        `${this.META_GRAPH_URL}/me/businesses?fields=id,name`,
        {
          headers: { 'Authorization': `Bearer ${userAccessToken}` }
        }
      );

      const businesses = businessResponse.data?.data || [];
      console.log(`🔍 Businesses encontrados: ${businesses.length}`, businesses.map(b => ({ id: b.id, name: b.name })));

      if (businesses.length === 0) {
        throw new Error('Nenhum Business encontrado para o usuário');
      }

      const businessId = businesses[0].id;
      const businessName = businesses[0].name;
      console.log('🔍 ✅ Business ID encontrado:', { id: businessId, name: businessName });

      // Salvar business_id no signup state
      await this._updateSignupState(userId, restaurantId, {
        business_id: businessId
      });

      // Criar WABA automaticamente via client_whatsapp_applications
      console.log('🔍 Criando WABA via POST /{business_id}/client_whatsapp_applications...');
      console.log('🔍 Business ID:', businessId);
      console.log('🔍 Nome da integração:', `Integration for ${process.env.APP_NAME || 'Angu.ai'}`);
      
      // Endpoint correto para BSP criar WABA para cliente
      let createWabaResponse: any;
      
      try {
        // Tentativa 1: Endpoint client_whatsapp_applications
        console.log('🔍 Tentativa 1: Endpoint client_whatsapp_applications...');
        createWabaResponse = await axios.post<CreateClientWABAResponse | CreateApplicationResponse>(
          `${this.META_GRAPH_URL}/${BSP_CONFIG.BSP_BUSINESS_ID}/client_whatsapp_applications`,
          {
            name: `Integration for ${process.env.APP_NAME || 'Angu.ai'}`,
            business_id: businessId
          },
          {
            headers: { 
              'Authorization': `Bearer ${BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('🔍 ✅ WABA criada via client_whatsapp_applications');
      } catch (error: any) {
        console.log('🔍 ❌ Endpoint client_whatsapp_applications falhou:', error.response?.data?.error?.message);
        
        // Tentativa 2: Endpoint alternativo - criar WABA diretamente
        console.log('🔍 Tentativa 2: Endpoint alternativo...');
        try {
          createWabaResponse = await axios.post(
            `${this.META_GRAPH_URL}/${businessId}/whatsapp_business_accounts`,
            {
              name: `Integration for ${process.env.APP_NAME || 'Angu.ai'}`,
              access_token: BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN
            },
            {
              headers: { 
                'Authorization': `Bearer ${BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('🔍 ✅ WABA criada via endpoint alternativo');
        } catch (altError: any) {
          console.log('🔍 ❌ Endpoint alternativo também falhou:', altError.response?.data?.error?.message);
          
                // Tentativa 3: Usar o endpoint de criação de aplicação
      console.log('🔍 Tentativa 3: Endpoint de criação de aplicação...');
      try {
        createWabaResponse = await axios.post(
          `${this.META_GRAPH_URL}/${BSP_CONFIG.BSP_BUSINESS_ID}/applications`,
          {
            name: `WhatsApp Business - ${businessName}`,
            business_id: businessId
          },
          {
            headers: { 
              'Authorization': `Bearer ${BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('🔍 ✅ Aplicação criada via endpoint de aplicações');
      } catch (appError: any) {
        console.log('🔍 ❌ Endpoint de aplicações também falhou:', appError.response?.data?.error?.message);
        
        // Tentativa 4: Usar o fluxo oficial do Meta - Embedded Signup
        console.log('🔍 Tentativa 4: Fluxo oficial do Meta - Embedded Signup...');
        try {
          // Criar WABA usando o fluxo oficial
          createWabaResponse = await axios.post(
            `${this.META_GRAPH_URL}/${businessId}/whatsapp_business_accounts`,
            {
              name: `WhatsApp Business - ${businessName}`,
              access_token: userAccessToken
            },
            {
              headers: { 
                'Authorization': `Bearer ${userAccessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('🔍 ✅ WABA criada via fluxo oficial do Meta');
        } catch (metaError: any) {
          console.log('🔍 ❌ Fluxo oficial do Meta também falhou:', metaError.response?.data?.error?.message);
          
          // Tentativa 5: Usar o endpoint de criação de conta WhatsApp
          console.log('🔍 Tentativa 5: Endpoint de criação de conta WhatsApp...');
          createWabaResponse = await axios.post(
            `${this.META_GRAPH_URL}/whatsapp_business_accounts`,
            {
              name: `WhatsApp Business - ${businessName}`,
              business_id: businessId,
              access_token: userAccessToken
            },
            {
              headers: { 
                'Authorization': `Bearer ${userAccessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          console.log('🔍 ✅ WABA criada via endpoint de conta WhatsApp');
        }
      }
    }
  }

      const newWabaId = createWabaResponse.data.id;
      console.log('🔍 ✅ WABA criada automaticamente via BSP:', { 
        wabaId: newWabaId, 
        businessId: businessId,
        businessName: businessName 
      });
      
      // Salvar WABA ID no signup state
      await this._updateSignupState(userId, restaurantId, {
        waba_id: newWabaId,
        status: 'waba_created'
      });

      // Aguardar propagação da criação com polling
      console.log('🔍 Aguardando propagação da WABA criada...');
      let wabaFound = false;
      let attempts = 0;
      const maxAttempts = 10;
      let finalWabaId = newWabaId;
      
      while (!wabaFound && attempts < maxAttempts) {
        attempts++;
        console.log(`🔍 Tentativa ${attempts}/${maxAttempts} de encontrar WABA criada...`);
        
        try {
          // Tentar encontrar WABA no business do usuário
          const searchResponse = await axios.get<BusinessWABAResponse>(
            `${this.META_GRAPH_URL}/${businessId}?fields=whatsapp_business_accounts{id,name,status}`,
            {
              headers: { 'Authorization': `Bearer ${userAccessToken}` }
            }
          );
          
          if (searchResponse.data?.whatsapp_business_accounts?.data && 
              searchResponse.data.whatsapp_business_accounts.data.length > 0) {
            const foundWaba = searchResponse.data.whatsapp_business_accounts.data[0];
            console.log('🔍 ✅ WABA encontrada via polling:', foundWaba);
            finalWabaId = foundWaba.id;
            wabaFound = true;
            break;
          }
        } catch (searchError: any) {
          console.log(`🔍 Tentativa ${attempts} falhou:`, searchError.response?.data?.error?.message || 'erro na busca');
        }
        
        // Aguardar 3 segundos antes da próxima tentativa
        if (!wabaFound) {
          console.log('🔍 Aguardando 3 segundos antes da próxima tentativa...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      if (!wabaFound) {
        console.log('🔍 ⚠️ WABA não encontrada após todas as tentativas, mas pode ter sido criada');
      }

      // Verificar se WABA foi criada com sucesso
      try {
        console.log('🔍 Verificando WABA criada:', finalWabaId);
        const verifyResponse = await axios.get<WABAInfoResponse>(
          `${this.META_GRAPH_URL}/${finalWabaId}`,
          {
            params: { fields: 'id,name,status' },
            headers: { 'Authorization': `Bearer ${BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN}` }
          }
        );

        console.log('🔍 ✅ WABA verificada após criação:', verifyResponse.data);
        return finalWabaId;

      } catch (verifyError: any) {
        console.log('🔍 ❌ Erro ao verificar WABA criada:', verifyError.response?.data || verifyError.message);
        // WABA foi criada mas ainda não está propagada, retornar ID mesmo assim
        console.log('🔍 ⚠️ WABA criada mas não verificada, retornando ID:', finalWabaId);
        return finalWabaId;
      }

    } catch (error: any) {
      console.error('🔍 ❌ Erro na criação automática via BSP:', error.response?.data || error.message);
      throw new Error(`Falha na criação automática: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * @deprecated Use discoverWABA instead - agora implementa fluxo híbrido
   */
  public static async discoverOrCreateWABA(
    accessToken: string, 
    userId: string, 
    restaurantId: string
  ): Promise<string> {
    console.warn('⚠️ discoverOrCreateWABA is deprecated. Use discoverWABA instead.');
    return this.discoverWABA(userId, restaurantId, accessToken);
  }

  // --- MÉTODOS DESCONTINUADOS (mantidos para compatibilidade) ---

  /**
   * @deprecated Use registerPhoneNumber instead
   */
  public static async verifyPhoneNumber(userId: string, restaurantId: string, phoneNumber: string): Promise<{
    success: boolean;
    message: string;
    verification_id?: string;
  }> {
    console.warn('⚠️ verifyPhoneNumber is deprecated. Use registerPhoneNumber instead.');
    return this.registerPhoneNumber(userId, restaurantId, phoneNumber);
  }

  /**
   * @deprecated Use verifyPhoneNumberCode instead
   */
  public static async confirmPhoneVerification(
    userId: string, 
    restaurantId: string, 
    phoneNumber: string, 
    verificationCode: string
  ): Promise<{
    success: boolean;
    message: string;
    integration_id?: string;
  }> {
    console.warn('⚠️ confirmPhoneVerification is deprecated. Use verifyPhoneNumberCode instead.');
    
    // Buscar phone_number_id atual
    const { data: signupState } = await supabase
      .from('whatsapp_signup_states')
      .select('phone_number_id')
      .eq('user_id', userId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (!signupState?.phone_number_id) {
      throw new Error('Phone number ID not found');
    }

    return this.verifyPhoneNumberCode(userId, restaurantId, signupState.phone_number_id, verificationCode);
  }

  /**
   * Valida o user_access_token usando /debug_token e verifica escopos mínimos.
   */
  private static async _validateUserAccessToken(userAccessToken: string): Promise<boolean> {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) return false;

    const appToken = `${appId}|${appSecret}`;
    const debugUrl = `${META_CONFIG.GRAPH_API_BASE}/debug_token`;

    const resp = await axios.get<{ data: { is_valid: boolean; scopes: string[] } }>(
      `${debugUrl}`,
      { params: { input_token: userAccessToken, access_token: appToken } }
    );

    const debug = resp.data;
    if (!debug?.data?.is_valid) return false;

    const scopes: string[] = debug.data.scopes || [];
    const required = ['business_management', 'whatsapp_business_management'];
    return required.every(s => scopes.includes(s));
  }

  /**
   * Troca authorization code -> user access token (retorna token + user_id).
   */
  private static async _exchangeCodeForToken(code: string, state: string): Promise<{ access_token: string; user_id?: string; expires_in?: number }> {
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.API_BASE_URL || 'https://api.angu.ai'}/api/whatsapp/ensure`;
    if (!clientId || !clientSecret) throw new Error('Configuração do Facebook ausente');

    const tokenParams = new URLSearchParams({
      client_id: String(clientId),
      client_secret: String(clientSecret),
      redirect_uri: redirectUri,
      code
    });

    const tokenResponse = await axios.get<OAuthTokenResponse>(
      `${META_URLS.OAUTH_ACCESS_TOKEN}?${tokenParams.toString()}`
    );

    // Tentar obter user_id do token
    let user_id: string | undefined;
    try {
      const me = await axios.get<{ id: string }>(`${this.META_GRAPH_URL}/me`, {
        headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
      });
      user_id = me.data?.id;
    } catch (_) {}

    return {
      access_token: tokenResponse.data.access_token,
      user_id,
      expires_in: tokenResponse.data.expires_in
    };
  }

  /**
   * Lista businesses do usuário com user token.
   */
  private static async _discoverBusinesses(userAccessToken: string): Promise<Array<{ id: string; name?: string }>> {
    const resp = await axios.get<BusinessListResponse>(`${this.META_GRAPH_URL}/me/businesses?fields=id,name`, {
      headers: { Authorization: `Bearer ${userAccessToken}` }
    });
    return resp.data?.data || [];
  }

  /**
   * Descobre WABA em uma edge específica do BM (owned|client).
   */
  private static async _discoverWABAOnEdge(
    userAccessToken: string,
    businessId: string,
    edge: 'owned' | 'client'
  ): Promise<{ waba_id?: string } | null> {
    const edgeName = edge === 'owned' ? 'owned_whatsapp_business_accounts' : 'client_whatsapp_business_accounts';
    const url = `${this.META_GRAPH_URL}/${businessId}/${edgeName}?fields=id,name,status`;
    const resp = await axios.get<{ data: Array<{ id: string }> }>(url, {
      headers: { Authorization: `Bearer ${userAccessToken}` }
    });
    const arr = resp.data?.data || [];
    if (arr.length > 0) return { waba_id: arr[0].id };
    return null;
  }

  /**
   * Cria WABA no BM do BSP apontando para o BM do cliente (client_business_id).
   */
  private static async _createClientWABAByBSP(clientBusinessId: string, restaurantId: string): Promise<void> {
    const bspToken = BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN;
    const bspBusinessId = BSP_CONFIG.BSP_BUSINESS_ID;
    if (!bspToken || !bspBusinessId) throw new Error('Configuração BSP incompleta');

    const url = `${this.META_GRAPH_URL}/${bspBusinessId}/client_whatsapp_business_accounts`;
    await axios.post(
      url,
      { client_business_id: clientBusinessId, name: `Integration for ${restaurantId}` },
      { headers: { Authorization: `Bearer ${bspToken}`, 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Polling por até 10 tentativas (3s) para localizar WABA criada nas edges owned/client.
   */
  private static async _pollForWABA(userAccessToken: string, clientBusinessId: string): Promise<{ waba_id?: string } | null> {
    const maxAttempts = 10;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const owned = await this._discoverWABAOnEdge(userAccessToken, clientBusinessId, 'owned');
      if (owned?.waba_id) return owned;
      const client = await this._discoverWABAOnEdge(userAccessToken, clientBusinessId, 'client');
      if (client?.waba_id) return client;
      await new Promise(r => setTimeout(r, 3000));
    }
    return null;
  }

  /**
   * Persiste/atualiza whatsapp_credentials de forma idempotente.
   */
  private static async _upsertCredentials(
    restaurantId: string,
    updates: Partial<{
      phone_number: string | null;
      phone_number_id: string | null;
      business_name: string | null;
      status: string | null;
      webhook_status: string | null;
      oauth_access_token: string | null;
      oauth_token_expires_at: string | null;
      oauth_refresh_token: string | null;
      oauth_token_type: string | null;
      is_oauth_connected: boolean | null;
      user_access_token: string | null;
      business_id: string | null;
      whatsapp_business_account_id: string | null;
      creation_strategy: string | null;
      polling_status: string | null;
    }>
  ): Promise<void> {
    const now = new Date().toISOString();
    const payload = { restaurant_id: restaurantId, updated_at: now, ...updates } as any;
    await supabase.from('whatsapp_credentials').upsert(payload, { onConflict: 'restaurant_id' });
  }

  /**
   * Insere log na tabela whatsapp_integration_logs.
   */
  private static async _logIntegrationStep(
    restaurantId: string,
    step:
      | 'oauth'
      | 'token_exchange'
      | 'waba_discovery'
      | 'waba_creation'
      | 'polling_system'
      | 'polling_verification'
      | 'complete_flow'
      | 'phone_registration'
      | 'phone_verification',
    strategy: string | undefined,
    success: boolean,
    error_message?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await supabase.from('whatsapp_integration_logs').insert({
      restaurant_id: restaurantId,
      step,
      strategy,
      success,
      error_message,
      details: details || {},
      created_at: new Date().toISOString()
    });
  }
}

export default WhatsAppService;
