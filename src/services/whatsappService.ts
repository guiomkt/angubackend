import { supabase } from '../config/database';
import axios from 'axios';

interface WhatsAppIntegration {
  id: string;
  restaurant_id: string;
  business_account_id: string;
  phone_number_id: string;
  phone_number: string;
  access_token: string;
  token_expires_at: string;
  is_active: boolean;
}

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

class WhatsAppService {
  /**
   * Buscar integração ativa do WhatsApp para um restaurante
   */
  static async getActiveIntegration(restaurant_id: string): Promise<WhatsAppIntegration | null> {
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
      console.error('Error getting WhatsApp integration:', error);
      return null;
    }
  }

  /**
   * Verificar se o token está próximo do vencimento (dentro de 7 dias)
   */
  static isTokenExpiringSoon(expiresAt: string): boolean {
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    return expirationDate <= sevenDaysFromNow;
  }

  /**
   * Renovar token de acesso do WhatsApp
   */
  static async refreshAccessToken(integrationId: string): Promise<boolean> {
    try {
      // Buscar a integração atual
      const { data: integration, error: getError } = await supabase
        .from('whatsapp_business_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (getError || !integration) {
        console.error('Integration not found:', getError);
        return false;
      }

      // Renovar o token via Meta API
      const response = await axios.post('https://graph.facebook.com/v19.0/oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: integration.access_token
      });

      const tokenData = response.data as MetaTokenResponse;
      const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Atualizar no banco
      const { error: updateError } = await supabase
        .from('whatsapp_business_integrations')
        .update({
          access_token: tokenData.access_token,
          token_expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', integrationId);

      if (updateError) {
        console.error('Error updating token:', updateError);
        return false;
      }

      console.log(`Token refreshed for integration ${integrationId}`);
      return true;

    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  /**
   * Verificar e renovar tokens que estão expirando
   */
  static async refreshExpiringTokens(): Promise<void> {
    try {
      // Buscar todas as integrações ativas
      const { data: integrations, error } = await supabase
        .from('whatsapp_business_integrations')
        .select('*')
        .eq('is_active', true);

      if (error || !integrations) {
        console.error('Error fetching integrations:', error);
        return;
      }

      for (const integration of integrations) {
        if (this.isTokenExpiringSoon(integration.token_expires_at)) {
          console.log(`Token expiring soon for integration ${integration.id}, attempting refresh...`);
          await this.refreshAccessToken(integration.id);
        }
      }

    } catch (error) {
      console.error('Error in refreshExpiringTokens:', error);
    }
  }

  /**
   * Validar se um token ainda é válido
   */
  static async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get('https://graph.facebook.com/v19.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.status === 200;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Criar nova integração do WhatsApp
   */
  static async createIntegration(data: {
    restaurant_id: string;
    business_account_id: string;
    phone_number_id: string;
    phone_number: string;
    business_name: string;
    access_token: string;
    token_expires_at: string;
  }): Promise<string | null> {
    try {
      const { data: result, error } = await supabase
        .from('whatsapp_business_integrations')
        .insert({
          ...data,
          is_active: true,
          connection_status: 'connected',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating integration:', error);
        return null;
      }

      return result.id;
    } catch (error) {
      console.error('Error creating integration:', error);
      return null;
    }
  }

  /**
   * Desativar integração
   */
  static async deactivateIntegration(integrationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('whatsapp_business_integrations')
        .update({
          is_active: false,
          connection_status: 'disconnected',
          updated_at: new Date().toISOString()
        })
        .eq('id', integrationId);

      return !error;
    } catch (error) {
      console.error('Error deactivating integration:', error);
      return false;
    }
  }

  /**
   * Buscar todas as integrações de um restaurante
   */
  static async getRestaurantIntegrations(restaurant_id: string) {
    try {
      const { data, error } = await supabase
        .from('whatsapp_business_integrations')
        .select('*')
        .eq('restaurant_id', restaurant_id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error getting integrations:', error);
      return { success: false, error: 'Failed to get integrations' };
    }
  }

  /**
   * Enviar mensagem de template do WhatsApp
   */
  static async sendTemplateMessage(data: {
    to: string;
    template_name: string;
    language: string;
    parameters?: any[];
    restaurant_id: string;
  }) {
    try {
      const integration = await this.getActiveIntegration(data.restaurant_id);
      
      if (!integration) {
        throw new Error('WhatsApp integration not found');
      }

      const messagePayload = {
        messaging_product: 'whatsapp',
        to: data.to,
        type: 'template',
        template: {
          name: data.template_name,
          language: {
            code: data.language
          },
          components: data.parameters ? [{
            type: 'body',
            parameters: data.parameters
          }] : []
        }
      };

      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${integration.phone_number_id}/messages`,
        messagePayload,
        {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error sending template message:', error);
      return { success: false, error: 'Failed to send template message' };
    }
  }
}

export default WhatsAppService; 