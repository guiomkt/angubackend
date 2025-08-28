import { supabase } from '../config/database';
import axios from 'axios';

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


// --- Classe de Serviço ---

class WhatsAppService {
  private static readonly META_API_VERSION = 'v22.0';
  private static readonly META_GRAPH_URL = `https://graph.facebook.com/${this.META_API_VERSION}`;
  private static readonly PHONE_REGISTRATION_PIN = "152563"; // Mantenha o PIN consistente com o da sua configuração Meta

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
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar integração ativa do WhatsApp:', error);
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

  // --- NOVOS MÉTODOS PARA EMBEDDED SIGNUP META ---

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

      // Gerar state único e seguro
      const randomString = Math.random().toString(36).substring(2, 15) + 
                          Math.random().toString(36).substring(2, 15) + 
                          Date.now().toString(36);

      const stateData = {
        userId,
        restaurantId,
        timestamp: Date.now(),
        type: 'embedded_signup',
        random: randomString
      };

      const encodedState = encodeURIComponent(JSON.stringify(stateData));

      // URL de autorização com escopos completos para WhatsApp Business
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${process.env.API_BASE_URL || 'https://api.angu.ai'}/api/whatsapp/oauth/callback`,
        state: encodedState,
        scope: 'whatsapp_business_management,whatsapp_business_messaging,pages_show_list,pages_read_engagement',
        response_type: 'code'
      });

      const authUrl = `https://www.facebook.com/${this.META_API_VERSION}/dialog/oauth?${params.toString()}`;

      // Salvar estado inicial no banco com state para validação
      await this._saveSignupStateWithState(userId, restaurantId, 'pending', encodedState);

      console.log('🔍 Embedded Signup iniciado:', { userId, restaurantId, state: encodedState.substring(0, 50) + '...' });

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
   * Verifica o status atual do processo de Embedded Signup.
   * Pode buscar por userId/restaurantId ou por state.
   */
  public static async getEmbeddedSignupStatus(
    userId?: string, 
    restaurantId?: string,
    state?: string
  ): Promise<{
    status: 'pending' | 'oauth_completed' | 'waba_created' | 'phone_configured' | 'completed' | 'failed';
    waba_id?: string;
    phone_number_id?: string;
    phone_number?: string;
    business_name?: string;
    verification_status?: string;
    business_id?: string;
    needs_phone_registration?: boolean;
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

      return {
        status: signupState.status as any,
        waba_id: signupState.waba_id,
        phone_number_id: signupState.phone_number_id,
        phone_number: signupState.phone_number,
        business_name: signupState.business_name,
        business_id: signupState.business_id,
        verification_status: signupState.verification_status,
        needs_phone_registration: needsPhoneRegistration
      };

    } catch (error: any) {
      console.error('Erro ao verificar status do Embedded Signup:', error);
      return { status: 'failed' };
    }
  }

  /**
   * Verifica um número de telefone para WhatsApp Business.
   * Envia código de verificação via SMS/ligação.
   */
  public static async verifyPhoneNumber(userId: string, restaurantId: string, phoneNumber: string): Promise<{
    success: boolean;
    message: string;
    verification_id?: string;
  }> {
    try {
      // Buscar token OAuth do usuário
      const { data: metaToken } = await supabase
        .from('meta_tokens')
        .select('oauth_access_token')
        .eq('user_id', userId)
        .single();

      if (!metaToken?.oauth_access_token) {
        throw new Error('Token OAuth não encontrado. Complete o processo de autorização primeiro.');
      }

      // Buscar WABA ID
      const { data: signupState } = await supabase
        .from('whatsapp_signup_states')
        .select('waba_id')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (!signupState?.waba_id) {
        throw new Error('Conta WhatsApp Business não encontrada. Complete o processo de autorização primeiro.');
      }

      // Verificar se o número já está associado à WABA
      try {
        const phoneResponse = await axios.get<PhoneNumbersResponse>(
          `${this.META_GRAPH_URL}/${signupState.waba_id}/phone_numbers`,
          {
            headers: { 'Authorization': `Bearer ${metaToken.oauth_access_token}` }
          }
        );

        const existingPhone = phoneResponse.data.data?.find(
          (phone) => phone.display_phone_number.replace(/\D/g, '') === phoneNumber.replace(/\D/g, '')
        );

        if (existingPhone) {
          // Número já existe, atualizar estado
          await this._updateSignupState(userId, restaurantId, {
            phone_number_id: existingPhone.id,
            phone_number: existingPhone.display_phone_number,
            status: 'phone_configured'
          });

          return {
            success: true,
            message: 'Número de telefone já configurado'
          };
        }
      } catch (error) {
        // Erro ao buscar números existentes, continuar com verificação
      }

      // Criar novo número de telefone via API
      const createPhoneResponse = await axios.post<CreatePhoneResponse>(
        `${this.META_GRAPH_URL}/${signupState.waba_id}/phone_numbers`,
        {
          messaging_product: 'whatsapp',
          display_phone_number: phoneNumber,
          pin: this.PHONE_REGISTRATION_PIN
        },
        {
          headers: { 'Authorization': `Bearer ${metaToken.oauth_access_token}` }
        }
      );

      const phoneId = createPhoneResponse.data.id;

      // Atualizar estado
      await this._updateSignupState(userId, restaurantId, {
        phone_number_id: phoneId,
        phone_number: phoneNumber,
        status: 'phone_configured',
        verification_status: 'pending'
      });

      return {
        success: true,
        message: 'Código de verificação enviado com sucesso',
        verification_id: phoneId
      };

    } catch (error: any) {
      console.error('Erro ao verificar número de telefone:', error);
      throw new Error(`Falha ao verificar número: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Confirma o código de verificação do número de telefone.
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
    try {
      // Buscar estado atual
      const { data: signupState } = await supabase
        .from('whatsapp_signup_states')
        .select('*')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (!signupState?.phone_number_id) {
        throw new Error('Número de telefone não encontrado. Complete a verificação primeiro.');
      }

      // Buscar token OAuth
      const { data: metaToken } = await supabase
        .from('meta_tokens')
        .select('oauth_access_token')
        .eq('user_id', userId)
        .single();

      if (!metaToken?.oauth_access_token) {
        throw new Error('Token OAuth não encontrado.');
      }

      // Confirmar verificação via API da Meta
      await axios.post(
        `${this.META_GRAPH_URL}/${signupState.phone_number_id}/verify`,
        {
          messaging_product: 'whatsapp',
          code: verificationCode
        },
        {
          headers: { 'Authorization': `Bearer ${metaToken.oauth_access_token}` }
        }
      );

      // Buscar informações atualizadas do número
      const phoneInfo = await axios.get<PhoneInfoResponse>(
        `${this.META_GRAPH_URL}/${signupState.phone_number_id}`,
        {
          params: { fields: 'verified_name,quality_rating,code_verification_status,display_phone_number,status' },
          headers: { 'Authorization': `Bearer ${metaToken.oauth_access_token}` }
        }
      );

      // Criar integração completa
      const integrationData = {
        restaurant_id: restaurantId,
        business_account_id: signupState.waba_id!,
        phone_number_id: signupState.phone_number_id!,
        access_token: metaToken.oauth_access_token,
        phone_number: phoneInfo.data.display_phone_number.replace(/\D/g, ''),
        business_name: phoneInfo.data.verified_name || 'WhatsApp Business',
        status: phoneInfo.data.status || 'CONNECTED'
      };

      const integrationId = await this._persistIntegrationData(integrationData);

      // Atualizar estado para completado
      await this._updateSignupState(userId, restaurantId, {
        status: 'completed',
        verification_status: 'verified'
      });

      return {
        success: true,
        message: 'Verificação confirmada com sucesso. WhatsApp Business configurado!',
        integration_id: integrationId
      };

    } catch (error: any) {
      console.error('Erro ao confirmar verificação:', error);
      throw new Error(`Falha ao confirmar verificação: ${error.response?.data?.error?.message || error.message}`);
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

      // Registrar número via API da Meta
      const registerResponse = await axios.post<{ id: string; display_phone_number: string; status: string }>(
        `${this.META_GRAPH_URL}/${signupState.waba_id}/phone_numbers`,
        {
          messaging_product: 'whatsapp',
          display_phone_number: phoneNumber,
          pin: usedPin
        },
        {
          headers: { 'Authorization': `Bearer ${signupState.access_token}` }
        }
      );

      const phoneNumberId = registerResponse.data.id;

      // Atualizar estado do signup
      await this._updateSignupState(userId, restaurantId, {
        phone_number_id: phoneNumberId,
        phone_number: phoneNumber,
        status: 'phone_configured',
        verification_status: 'pending'
      });

      console.log('🔍 Número registrado com sucesso:', { phoneNumberId, phoneNumber });

      return {
        success: true,
        message: 'Número registrado com sucesso. Código de verificação enviado via SMS.',
        phone_number_id: phoneNumberId
      };

    } catch (error: any) {
      console.error('Erro ao registrar número de telefone:', error);
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

      // Buscar informações atualizadas do número
      const phoneInfo = await axios.get<PhoneInfoResponse>(
        `${this.META_GRAPH_URL}/${phoneNumberId}`,
        {
          params: { fields: 'verified_name,quality_rating,code_verification_status,display_phone_number,status' },
          headers: { 'Authorization': `Bearer ${signupState.access_token}` }
        }
      );

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

      const integrationId = await this._persistIntegrationData(integrationData);

      // Atualizar estado para completado
      await this._updateSignupState(userId, restaurantId, {
        status: 'completed',
        verification_status: 'verified',
        business_name: phoneInfo.data.verified_name || signupState.business_name
      });

      console.log('🔍 Verificação de código concluída com sucesso:', { phoneNumberId, integrationId });

      return {
        success: true,
        message: 'Verificação confirmada com sucesso. WhatsApp Business configurado!',
        integration_id: integrationId
      };

    } catch (error: any) {
      console.error('Erro ao verificar código do telefone:', error);
      throw new Error(`Falha ao verificar código: ${error.response?.data?.error?.message || error.message}`);
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
   * Descobre ou cria uma conta WhatsApp Business (WABA) para o usuário.
   */
  public static async discoverOrCreateWABA(
    accessToken: string, 
    userId: string, 
    restaurantId: string
  ): Promise<string> {
    try {
      // Primeiro, tentar descobrir WABA existente
      console.log('🔍 Descobrindo WABA existente...');
      
      try {
        const wabaResponse = await axios.get<WABAListResponse>(
          `${this.META_GRAPH_URL}/me/whatsapp_business_accounts`,
          {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          }
        );

        if (wabaResponse.data.data && wabaResponse.data.data.length > 0) {
          const existingWABA = wabaResponse.data.data[0];
          console.log('🔍 WABA existente encontrado:', existingWABA.id);
          return existingWABA.id;
        }
      } catch (error: any) {
        console.log('🔍 Nenhuma WABA existente encontrada, criando nova...');
      }

      // Se não existir, criar nova WABA via API
      console.log('🔍 Criando nova WABA...');
      
      // Buscar informações do usuário para criar a WABA
      const userResponse = await axios.get<UserInfoResponse>(
        `${this.META_GRAPH_URL}/me`,
        {
          params: { fields: 'id,name,email' },
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      const userData = userResponse.data;
      
      // Buscar informações do restaurante
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('name, business_name')
        .eq('id', restaurantId)
        .single();

      const businessName = restaurant?.business_name || restaurant?.name || userData.name;

      // Criar WABA via API
      const createWABAResponse = await axios.post<CreateWABAResponse>(
        `${this.META_GRAPH_URL}/me/whatsapp_business_accounts`,
        {
          name: businessName,
          timezone_id: '1', // UTC
          currency: 'BRL'
        },
        {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }
      );

      const newWABAId = createWABAResponse.data.id;
      console.log('🔍 Nova WABA criada com sucesso:', newWABAId);

      return newWABAId;

    } catch (error: any) {
      console.error('Erro ao descobrir/criar WABA:', error);
      throw new Error(`Falha ao configurar WhatsApp Business: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

export default WhatsAppService;
