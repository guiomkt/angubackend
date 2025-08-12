import { supabase } from '../config/database'
import axios from 'axios'
import { createReadStream } from 'fs'
import { Readable } from 'stream'

interface WhatsAppToken {
  id: string
  business_id: string
  access_token: string
  refresh_token: string
  expires_at: string
  created_at: string
  updated_at: string
}

interface WhatsAppIntegration {
  id: string
  restaurant_id: string
  phone_number_id: string
  business_account_id: string
  access_token: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface WhatsAppContact {
  id: string
  restaurant_id: string
  phone_number: string
  name?: string
  email?: string
  notes?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

interface WhatsAppMedia {
  id: string
  restaurant_id: string
  media_id: string
  file_name: string
  mime_type: string
  file_size: number
  url?: string
  created_at: string
}

interface WhatsAppMessage {
  id: string
  restaurant_id: string
  message_id: string
  to: string
  from: string
  type: 'text' | 'template' | 'media' | 'location' | 'contact'
  content: any
  status: 'sent' | 'delivered' | 'read' | 'failed'
  created_at: string
  updated_at: string
}

interface MetaAPIResponse {
  data?: any
  error?: {
    message: string
    code: number
  }
}

export class WhatsAppService {
  private static async getMetaAPIHeaders(accessToken: string) {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }

  static async getBusinessAccounts(accessToken: string): Promise<any[]> {
    try {
      const response = await axios.get(
        'https://graph.facebook.com/v19.0/me/businesses',
        {
          headers: await this.getMetaAPIHeaders(accessToken),
          params: {
            fields: 'id,name,verification_status,created_time'
          }
        }
      )
      return (response.data as any).data || []
    } catch (error) {
      console.error('Erro ao buscar contas de negócio:', error)
      throw new Error('Falha ao buscar contas de negócio')
    }
  }

  static async getPhoneNumbers(businessAccountId: string, accessToken: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v19.0/${businessAccountId}/phone_numbers`,
        {
          headers: await this.getMetaAPIHeaders(accessToken),
          params: {
            fields: 'id,phone_number,display_name,verified_name,code_verification_status'
          }
        }
      )
      return (response.data as any).data || []
    } catch (error) {
      console.error('Erro ao buscar números de telefone:', error)
      throw new Error('Falha ao buscar números de telefone')
    }
  }

  static async sendMessage(phoneNumberId: string, to: string, message: string, accessToken: string): Promise<any> {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: {
            body: message
          }
        },
        {
          headers: await this.getMetaAPIHeaders(accessToken)
        }
      )
      return response.data
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      throw new Error('Falha ao enviar mensagem')
    }
  }

  static async sendTemplateMessage(
    phoneNumberId: string, 
    to: string, 
    templateName: string, 
    language: string,
    components: any[],
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: language
            },
            components: components
          }
        },
        {
          headers: await this.getMetaAPIHeaders(accessToken)
        }
      )
      return response.data
    } catch (error) {
      console.error('Erro ao enviar template:', error)
      throw new Error('Falha ao enviar template')
    }
  }

  static async uploadMedia(
    phoneNumberId: string,
    file: Buffer,
    fileName: string,
    mimeType: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/media`,
        {
          messaging_product: 'whatsapp',
          file: file.toString('base64'),
          type: mimeType
        },
        {
          headers: await this.getMetaAPIHeaders(accessToken)
        }
      )
      return response.data
    } catch (error) {
      console.error('Erro ao fazer upload de mídia:', error)
      throw new Error('Falha ao fazer upload de mídia')
    }
  }

  static async downloadMedia(mediaId: string, accessToken: string): Promise<Buffer> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v19.0/${mediaId}`,
        {
          headers: await this.getMetaAPIHeaders(accessToken)
        }
      )

      const downloadUrl = (response.data as any).url
      const mediaResponse = await axios.get(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        responseType: 'arraybuffer'
      })

      return Buffer.from(mediaResponse.data as ArrayBuffer)
    } catch (error) {
      console.error('Erro ao baixar mídia:', error)
      throw new Error('Falha ao baixar mídia')
    }
  }

  static async getMessageStatus(messageId: string, accessToken: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v19.0/${messageId}`,
        {
          headers: await this.getMetaAPIHeaders(accessToken),
          params: {
            fields: 'id,status,recipient_id,timestamp'
          }
        }
      )
      return response.data
    } catch (error) {
      console.error('Erro ao buscar status da mensagem:', error)
      throw new Error('Falha ao buscar status da mensagem')
    }
  }

  static async registerWebhook(
    phoneNumberId: string,
    webhookUrl: string,
    verifyToken: string,
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/subscribed_apps`,
        {
          access_token: accessToken,
          callback_url: webhookUrl,
          verify_token: verifyToken
        }
      )
      return response.data
    } catch (error) {
      console.error('Erro ao registrar webhook:', error)
      throw new Error('Falha ao registrar webhook')
    }
  }

  static async verifyWebhook(
    mode: string,
    challenge: string,
    verifyToken: string
  ): Promise<string | null> {
    if (mode === 'subscribe' && verifyToken === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return challenge
    }
    return null
  }

  static async saveIntegration(restaurantId: string, integrationData: Partial<WhatsAppIntegration>): Promise<WhatsAppIntegration> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_integrations')
        .upsert({
          restaurant_id: restaurantId,
          ...integrationData,
          is_active: true
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erro ao salvar integração:', error)
      throw new Error('Falha ao salvar integração')
    }
  }

  static async getIntegration(restaurantId: string): Promise<WhatsAppIntegration | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_integrations')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Erro ao buscar integração:', error)
      return null
    }
  }

  static async updateIntegration(restaurantId: string, updates: Partial<WhatsAppIntegration>): Promise<WhatsAppIntegration> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_integrations')
        .update(updates)
        .eq('restaurant_id', restaurantId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erro ao atualizar integração:', error)
      throw new Error('Falha ao atualizar integração')
    }
  }

  static async deleteIntegration(restaurantId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_integrations')
        .delete()
        .eq('restaurant_id', restaurantId)

      if (error) throw error
    } catch (error) {
      console.error('Erro ao deletar integração:', error)
      throw new Error('Falha ao deletar integração')
    }
  }

  static async saveToken(tokenData: Partial<WhatsAppToken>): Promise<WhatsAppToken> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_tokens')
        .upsert(tokenData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erro ao salvar token:', error)
      throw new Error('Falha ao salvar token')
    }
  }

  static async getToken(businessId: string): Promise<WhatsAppToken | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_tokens')
        .select('*')
        .eq('business_id', businessId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Erro ao buscar token:', error)
      return null
    }
  }

  static async refreshToken(businessId: string, refreshToken: string): Promise<string> {
    try {
      const response = await axios.post('https://graph.facebook.com/v19.0/oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: refreshToken
      })

      const { access_token, expires_in } = response.data as any
      
      await this.saveToken({
        business_id: businessId,
        access_token: access_token,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString()
      })

      return access_token
    } catch (error) {
      console.error('Erro ao renovar token:', error)
      throw new Error('Falha ao renovar token')
    }
  }

  static async getValidAccessToken(businessId: string): Promise<string | null> {
    try {
      const token = await this.getToken(businessId)
      if (!token) return null

      const expiresAt = new Date(token.expires_at)
      const now = new Date()

      if (expiresAt <= now) {
        return await this.refreshToken(businessId, token.refresh_token)
      }

      return token.access_token
    } catch (error) {
      console.error('Erro ao obter token válido:', error)
      return null
    }
  }

  static async saveContact(contactData: Partial<WhatsAppContact>): Promise<WhatsAppContact> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .upsert(contactData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erro ao salvar contato:', error)
      throw new Error('Falha ao salvar contato')
    }
  }

  static async getContact(restaurantId: string, phoneNumber: string): Promise<WhatsAppContact | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('phone_number', phoneNumber)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Erro ao buscar contato:', error)
      return null
    }
  }

  static async getContacts(restaurantId: string): Promise<WhatsAppContact[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erro ao buscar contatos:', error)
      return []
    }
  }

  static async updateContact(restaurantId: string, phoneNumber: string, updates: Partial<WhatsAppContact>): Promise<WhatsAppContact> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .update(updates)
        .eq('restaurant_id', restaurantId)
        .eq('phone_number', phoneNumber)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erro ao atualizar contato:', error)
      throw new Error('Falha ao atualizar contato')
    }
  }

  static async deleteContact(restaurantId: string, phoneNumber: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('phone_number', phoneNumber)

      if (error) throw error
    } catch (error) {
      console.error('Erro ao deletar contato:', error)
      throw new Error('Falha ao deletar contato')
    }
  }

  static async saveMedia(mediaData: Partial<WhatsAppMedia>): Promise<WhatsAppMedia> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_media')
        .insert(mediaData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erro ao salvar mídia:', error)
      throw new Error('Falha ao salvar mídia')
    }
  }

  static async getMedia(mediaId: string): Promise<WhatsAppMedia | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_media')
        .select('*')
        .eq('media_id', mediaId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('Erro ao buscar mídia:', error)
      return null
    }
  }

  static async saveMessage(messageData: Partial<WhatsAppMessage>): Promise<WhatsAppMessage> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .insert(messageData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error)
      throw new Error('Falha ao salvar mensagem')
    }
  }

  static async updateMessageStatus(messageId: string, status: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('message_id', messageId)

      if (error) throw error
    } catch (error) {
      console.error('Erro ao atualizar status da mensagem:', error)
      throw new Error('Falha ao atualizar status da mensagem')
    }
  }

  static async getMessages(restaurantId: string, limit: number = 50): Promise<WhatsAppMessage[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error)
      return []
    }
  }

  static async updateBusinessProfile(
    phoneNumberId: string,
    profile: {
      about?: string
      description?: string
      email?: string
      address?: string
      websites?: string[]
    },
    accessToken: string
  ): Promise<any> {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/whatsapp_business_profile`,
        profile,
        { headers: await this.getMetaAPIHeaders(accessToken) }
      )
      return response.data
    } catch (error) {
      console.error('Erro ao atualizar perfil WhatsApp:', error)
      throw new Error('Falha ao atualizar perfil do WhatsApp Business')
    }
  }

  static async uploadProfilePhoto(
    phoneNumberId: string,
    file: Buffer,
    fileName: string,
    mimeType: string,
    accessToken: string
  ): Promise<any> {
    return this.uploadMedia(phoneNumberId, file, fileName, mimeType, accessToken)
  }

  static async registerTemplate(
    wabaId: string,
    template: {
      name: string
      category: string
      language?: string
      components: any[]
    },
    accessToken: string
  ): Promise<any> {
    try {
      const payload = {
        name: template.name,
        category: template.category,
        language: template.language,
        components: template.components
      }
      const response = await axios.post(
        `https://graph.facebook.com/v19.0/${wabaId}/message_templates`,
        payload,
        { headers: await this.getMetaAPIHeaders(accessToken) }
      )
      return response.data
    } catch (error) {
      console.error('Erro ao registrar template:', error)
      throw new Error('Falha ao registrar template na WABA')
    }
  }
} 