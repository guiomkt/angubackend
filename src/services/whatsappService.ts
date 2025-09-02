import axios from 'axios';
import { supabase } from '../config/database';
import { META_URLS, META_CONFIG, BSP_CONFIG } from '../config/meta';

// Tipos para as respostas da Meta API
interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

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

interface SetupIntegrationParams {
  restaurantId: string;
  wabaId: string; // WhatsApp Business Account ID
  phoneNumberId: string;
  accessToken: string;
}

interface EnsureWABAResult {
  status: 'proceeded' | 'found' | 'created' | 'awaiting_waba_creation';
  waba_id?: string;
  phone_number_id?: string;
  source?: 'owned' | 'client';
  strategy?: 'bsp_client_waba';
  retry_after?: number;
}

interface TemplateMessageResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

class WhatsAppService {
  public static readonly META_API_VERSION = META_CONFIG.API_VERSION;

  /**
   * Método principal que orquestra todo o fluxo de integração WhatsApp
   * Implementa o fluxo ENSURE_WABA que verifica se já existe integração
   * ou cria uma nova usando o método BSP
   */
  public static async ensureWABA(params: {
    restaurant_id: string;
    code?: string;
    state?: string;
    user_id?: string;
  }): Promise<EnsureWABAResult> {
    try {
      // Implementação temporária simplificada
      console.log('Iniciando ENSURE_WABA com params:', params);
      
      // Verificar se já existe integração ativa (curto-circuito)
      const { data: existingIntegration } = await supabase
        .from('whatsapp_business_integrations')
        .select('*')
        .eq('restaurant_id', params.restaurant_id)
        .eq('is_active', true)
        .single();
      
      if (existingIntegration) {
        console.log('Integração existente encontrada:', existingIntegration.id);
        return {
          status: 'proceeded',
          waba_id: existingIntegration.business_account_id,
          phone_number_id: existingIntegration.phone_number_id
        };
      }
      
      // Simular resposta para diferentes cenários
      if (params.code && params.state) {
        // Se temos code e state, simular WABA encontrada
        return {
          status: 'found',
          waba_id: 'waba_123456789',
          phone_number_id: 'phone_987654321',
          source: 'owned'
        };
      }
      
      // Caso contrário, simular WABA criada
      return {
        status: 'created',
        waba_id: 'waba_created_123456',
        strategy: 'bsp_client_waba'
      };
      
    } catch (error: any) {
      console.error('Erro no fluxo ENSURE_WABA:', error);
      
      // Em caso de erro, retornar status de espera
      return {
        status: 'awaiting_waba_creation',
        retry_after: META_CONFIG.RETRY_AFTER_SECONDS
      };
    }
  }

  /**
   * Setup WhatsApp integration using modern service
   */
  public static async setupIntegration(params: SetupIntegrationParams): Promise<string | null> {
    try {
      const { restaurantId, wabaId, phoneNumberId, accessToken } = params;

      // Persist integration data
      const { data, error } = await supabase
        .from('whatsapp_business_integrations')
        .upsert({
          restaurant_id: restaurantId,
          business_account_id: wabaId,
          phone_number_id: phoneNumberId,
          phone_number: '', // Will be filled by webhook or later
          business_name: 'WhatsApp Business',
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(), // 24 hours
          is_active: true,
          connection_status: 'connected',
          webhook_url: `${process.env.API_BASE_URL || 'https://api.angu.ai'}/api/whatsapp/webhook`,
          webhook_verify_token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'angu_webhook_token',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'restaurant_id'
        })
        .select();

      if (error) {
        console.error('Error setting up WhatsApp integration:', error);
        return null;
      }

      return data?.[0]?.id || null;
    } catch (error) {
      console.error('Error in setupIntegration:', error);
      return null;
    }
  }

  /**
   * Get active WhatsApp integration for restaurant
   */
  public static async getActiveIntegration(restaurant_id: string): Promise<WhatsAppIntegration | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_business_integrations')
        .select('*')
        .eq('restaurant_id', restaurant_id)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return data as WhatsAppIntegration;
    } catch (error) {
      console.error('Error in getActiveIntegration:', error);
      return null;
    }
  }

  /**
   * Send template message
   */
  public static async sendTemplateMessage(params: {
    to: string;
    template_name: string;
    language: string;
    parameters?: any[];
    restaurant_id: string;
  }) {
    try {
      const { restaurant_id, to, template_name, language, parameters } = params;
      
      // Get active integration
      const integration = await this.getActiveIntegration(restaurant_id);
      
      if (!integration) {
        return { 
          success: false, 
          message: 'WhatsApp integration not found' 
        };
      }

      // Prepare template parameters
      const components = parameters ? [{ type: 'body', parameters }] : undefined;

      // Send request to WhatsApp API
      const response = await axios.post<TemplateMessageResponse>(
        `${META_URLS.GRAPH_API}/${integration.phone_number_id}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: template_name,
            language: {
              code: language
            },
            components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return { 
        success: true, 
        message: 'Template message sent successfully',
        message_id: response.data?.messages?.[0]?.id
      };
      
    } catch (error: any) {
      console.error('Error sending template message:', error);
      return { 
        success: false, 
        message: error.response?.data?.error?.message || 'Failed to send template message',
        error: error.response?.data?.error 
      };
    }
  }
}

export default WhatsAppService;
