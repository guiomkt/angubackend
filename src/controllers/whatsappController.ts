import { Request, Response } from 'express'
import { WhatsAppService } from '../services/whatsappService'
import { RestaurantService } from '../services/restaurantService'
import axios from 'axios'
import multer from 'multer'
import { supabase } from '../config/database'

interface RequestWithFile extends Request {
  file?: Express.Multer.File
}

interface TokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

interface BusinessAccountsResponse {
  data: Array<{
    id: string
    name: string
    verification_status?: string
    created_time?: string
  }>
}

interface PhoneNumbersResponse {
  data: Array<{
    id: string
    phone_number: string
    display_name?: string
    verified_name?: string
    code_verification_status?: string
  }>
}

export class WhatsAppController {
  /**
   * @swagger
   * /api/whatsapp/oauth/initiate:
   *   get:
   *     summary: Inicia o fluxo OAuth do WhatsApp
   *     tags: [WhatsApp]
   *     parameters:
   *       - in: query
   *         name: restaurantId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID do restaurante
   *       - in: query
   *         name: redirectUrl
   *         required: true
   *         schema:
   *           type: string
   *         description: URL de redirecionamento após autorização
   *     responses:
   *       200:
   *         description: URL de autorização gerada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 authUrl:
   *                   type: string
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro interno do servidor
   */
  static async initiateOAuth(req: Request, res: Response) {
    try {
      const { restaurantId, redirectUrl } = req.query

      if (!restaurantId || !redirectUrl) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID e redirect URL são obrigatórios'
        })
      }

      const clientId = process.env.FACEBOOK_APP_ID
      if (!clientId) {
        return res.status(500).json({
          success: false,
          error: 'Facebook App ID não configurado'
        })
      }

      // Construir o state com dados do restaurante e URL de redirecionamento
      const state = encodeURIComponent(JSON.stringify({
        restaurantId,
        redirectUrl,
        timestamp: Date.now()
      }))

      // Construir URL de autorização OAuth
      // IMPORTANTE: O redirect_uri deve ser a URL do backend de produção
      const isProduction = process.env.NODE_ENV === 'production';
      const redirectUri = process.env.REDIRECT_URI || 
        (isProduction 
          ? 'https://api.angu.ai/api/whatsapp/oauth/callback'
          : `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/whatsapp/oauth/callback`
        );
      const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=whatsapp_business_management,whatsapp_business_messaging&state=${state}`

return res.json({
        success: true,
        authUrl
      })
    } catch (error) {
      console.error('Erro ao iniciar OAuth:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  /**
   * @swagger
   * /api/whatsapp/oauth/callback:
   *   get:
   *     summary: Callback OAuth do WhatsApp
   *     tags: [WhatsApp]
   *     parameters:
   *       - in: query
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: Código de autorização
   *       - in: query
   *         name: state
   *         required: true
   *         schema:
   *           type: string
   *         description: Estado da requisição
   *     responses:
   *       200:
   *         description: Autorização processada
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro interno do servidor
   */
  static async handleOAuthCallback(req: Request, res: Response) {
    try {
      const { code, state } = req.query

      if (!code || !state) {
        return res.status(400).json({
          success: false,
          error: 'Código e estado são obrigatórios'
        })
      }

      // Decodificar o state
      let stateData
      try {
        stateData = JSON.parse(decodeURIComponent(state as string))
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Estado inválido'
        })
      }

      const { restaurantId, redirectUrl } = stateData

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID não encontrado no estado'
        })
      }

      // Trocar código por token curto
      const shortToken = await this.exchangeCodeForShortToken(code as string)
      if (!shortToken) {
        return res.status(500).json({
          success: false,
          error: 'Falha ao trocar código por token'
        })
      }

      // Trocar token curto por long-lived
      const longLivedToken = await this.exchangeShortTokenForLongLived(shortToken)
      if (!longLivedToken) {
        return res.status(500).json({
          success: false,
          error: 'Falha ao trocar token curto por long-lived'
        })
      }

      // Obter informações da conta de negócio
      const businessAccounts = await this.getBusinessAccounts(longLivedToken)
      if (!businessAccounts || businessAccounts.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Nenhuma conta de negócio encontrada'
        })
      }

      const businessAccount = businessAccounts[0]

      // Obter números de telefone
      const phoneNumbers = await this.getPhoneNumbers(businessAccount.id, longLivedToken)
      if (!phoneNumbers || phoneNumbers.length === 0) {
        return res.status(500).json({
          success: false,
          error: 'Nenhum número de telefone encontrado'
        })
      }

      const phoneNumber = phoneNumbers[0]

      // Salvar integração
      const integration = await WhatsAppService.saveIntegration(restaurantId, {
        phone_number_id: phoneNumber.id,
        business_account_id: businessAccount.id,
        access_token: longLivedToken
      })

      // Salvar token na estrutura correta da tabela whatsapp_tokens
      await WhatsAppService.saveToken({
        business_id: businessAccount.id,
        token_data: {
          access_token: longLivedToken,
          refresh_token: '', // Facebook não fornece refresh tokens
          token_type: 'long_lived',
          business_account_id: businessAccount.id,
          phone_number_id: phoneNumber.id
        },
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 dias
      })

      // Redirecionar baseado na URL de redirecionamento
      if (redirectUrl && (redirectUrl.includes('localhost') || redirectUrl.includes(process.env.FRONTEND_URL || 'localhost'))) {
        // Frontend local ou de desenvolvimento
        const successUrl = `${redirectUrl}?success=true&restaurantId=${restaurantId}&businessAccountId=${businessAccount.id}&phoneNumberId=${phoneNumber.id}`
        return res.redirect(successUrl)
      } else {
        // n8n ou outro sistema
        return res.json({
          success: true,
          data: {
            integration,
            businessAccount,
            phoneNumber,
            accessToken: longLivedToken
          },
          message: 'OAuth processado com sucesso'
        })
      }

    } catch (error) {
      console.error('Erro no callback OAuth:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  /**
   * Troca o código de autorização por um token de acesso curto
   */
  private static async exchangeCodeForShortToken(code: string): Promise<string | null> {
    try {
      const clientId = process.env.FACEBOOK_APP_ID
      const clientSecret = process.env.FACEBOOK_APP_SECRET
      
      // IMPORTANTE: O redirect_uri deve ser a URL do backend de produção
      const isProduction = process.env.NODE_ENV === 'production';
      const redirectUri = process.env.REDIRECT_URI || 
        (isProduction 
          ? 'https://api.angu.ai/api/whatsapp/oauth/callback'
          : `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/whatsapp/oauth/callback`
        )

      const response = await axios.get<TokenResponse>('https://graph.facebook.com/v20.0/oauth/access_token', {
        params: {
          client_id: clientId,
          redirect_uri: redirectUri,
          client_secret: clientSecret,
          code: code
        }
      })

      const { access_token } = response.data
      return access_token
    } catch (error) {
      console.error('Erro ao trocar código por token curto:', error)
      return null
    }
  }

  /**
   * Troca o token curto por um token long-lived
   */
  private static async exchangeShortTokenForLongLived(shortToken: string): Promise<string | null> {
    try {
      const clientId = process.env.FACEBOOK_APP_ID
      const clientSecret = process.env.FACEBOOK_APP_SECRET

      const response = await axios.get<TokenResponse>('https://graph.facebook.com/v20.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: shortToken
        }
      })

      const { access_token } = response.data
      return access_token
    } catch (error) {
      console.error('Erro ao trocar token curto por long-lived:', error)
      return null
    }
  }

  /**
   * Obtém as contas de negócio do usuário
   */
  static async getBusinessAccounts(accessToken: string): Promise<any[]> {
    try {
      const response = await axios.get<BusinessAccountsResponse>('https://graph.facebook.com/v20.0/me/businesses', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      return response.data.data || []
    } catch (error) {
      console.error('Erro ao buscar contas de negócio:', error)
      return []
    }
  }

  /**
   * Obtém os números de telefone de uma conta de negócio
   */
  static async getPhoneNumbers(businessAccountId: string, accessToken: string): Promise<any[]> {
    try {
      const response = await axios.get<PhoneNumbersResponse>(
        `https://graph.facebook.com/v20.0/${businessAccountId}/phone_numbers`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      return response.data.data || []
    } catch (error) {
      console.error('Erro ao buscar números de telefone:', error)
      return []
    }
  }

  /**
   * Desvincula o WhatsApp do restaurante
   */
  static async disconnectWhatsApp(restaurantId: string) {
    try {
      // Buscar integração atual
      const integration = await WhatsAppService.getIntegration(restaurantId)
      if (!integration) {
        throw new Error('Integração WhatsApp não encontrada')
      }

      // Buscar token associado
      const token = await WhatsAppService.getToken(integration.business_account_id)
      
      // Deletar integração
      await WhatsAppService.deleteIntegration(restaurantId)
      
      // Deletar token se existir
      if (token) {
        await supabase
          .from('whatsapp_tokens')
          .delete()
          .eq('business_id', integration.business_account_id)
      }

      // Limpar dados relacionados
      await supabase
        .from('whatsapp_contacts')
        .delete()
        .eq('restaurant_id', restaurantId)

      await supabase
        .from('whatsapp_messages')
        .delete()
        .eq('restaurant_id', restaurantId)

      await supabase
        .from('whatsapp_media')
        .delete()
        .eq('restaurant_id', restaurantId)

      return {
        success: true,
        message: 'WhatsApp desvinculado com sucesso',
        disconnectedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Erro ao desvincular WhatsApp:', error)
      throw new Error('Falha ao desvincular WhatsApp')
    }
  }

  /**
   * Obtém o status da integração WhatsApp
   */
  static async getWhatsAppStatus(restaurantId: string) {
    try {
      const integration = await WhatsAppService.getIntegration(restaurantId)
      
      if (!integration) {
        return {
          isConnected: false,
          integration: null,
          lastConnected: null,
          message: 'WhatsApp não conectado'
        }
      }

      // Verificar se o token ainda é válido
      const isTokenValid = await this.validateToken(restaurantId)
      
      return {
        isConnected: isTokenValid,
        integration: {
          id: integration.id,
          phone_number_id: integration.phone_number_id,
          business_account_id: integration.business_account_id,
          is_active: integration.is_active,
          created_at: integration.created_at,
          updated_at: integration.updated_at
        },
        lastConnected: integration.updated_at,
        message: isTokenValid ? 'WhatsApp conectado e funcionando' : 'Token expirado ou inválido'
      }
    } catch (error) {
      console.error('Erro ao verificar status do WhatsApp:', error)
      return {
        isConnected: false,
        integration: null,
        lastConnected: null,
        message: 'Erro ao verificar status'
      }
    }
  }

  // Métodos duplicados removidos - usar OAuth em vez de tokens diretos

  static async saveIntegration(req: Request, res: Response) {
    try {
      const { restaurantId, phoneNumberId, businessAccountId, accessToken } = req.body

      if (!restaurantId || !phoneNumberId || !businessAccountId || !accessToken) {
        return res.status(400).json({
          success: false,
          error: 'Todos os campos são obrigatórios'
        })
      }

      const restaurantService = new RestaurantService()
      const restaurantResponse = await restaurantService.getRestaurantById(restaurantId)
      if (!restaurantResponse.success || !restaurantResponse.data) {
        return res.status(404).json({
          success: false,
          error: 'Restaurante não encontrado'
        })
      }

      const integration = await WhatsAppService.saveIntegration(restaurantId, {
        phone_number_id: phoneNumberId,
        business_account_id: businessAccountId,
        access_token: accessToken
      })

return res.json({
        success: true,
        data: integration
      })
    } catch (error) {
      console.error('Erro ao salvar integração:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async getIntegration(req: Request, res: Response) {
    try {
      const { restaurantId } = req.params

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID é obrigatório'
        })
      }

      const integration = await WhatsAppService.getIntegration(restaurantId)

return res.json({
        success: true,
        data: integration
      })
    } catch (error) {
      console.error('Erro ao buscar integração:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async updateIntegration(req: Request, res: Response) {
    try {
      const { restaurantId } = req.params
      const updates = req.body

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID é obrigatório'
        })
      }

      const integration = await WhatsAppService.updateIntegration(restaurantId, updates)

return res.json({
        success: true,
        data: integration
      })
    } catch (error) {
      console.error('Erro ao atualizar integração:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async deleteIntegration(req: Request, res: Response) {
    try {
      const { restaurantId } = req.params

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID é obrigatório'
        })
      }

      await WhatsAppService.deleteIntegration(restaurantId)

return res.json({
        success: true,
        message: 'Integração removida com sucesso'
      })
    } catch (error) {
      console.error('Erro ao deletar integração:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const { restaurantId, to, message } = req.body

      if (!restaurantId || !to || !message) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID, destinatário e mensagem são obrigatórios'
        })
      }

      const integration = await WhatsAppService.getIntegration(restaurantId)
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integração WhatsApp não encontrada'
        })
      }

      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          error: 'Token de acesso inválido ou expirado'
        })
      }

      const result = await WhatsAppService.sendMessage(
        integration.phone_number_id,
        to,
        message,
        accessToken
      )

      // Salvar mensagem no banco
      await WhatsAppService.saveMessage({
        restaurant_id: restaurantId,
        message_id: result.messages?.[0]?.id || '',
        to: to,
        from: integration.phone_number_id,
        type: 'text',
        content: { text: message },
        status: 'sent'
      })

return res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async sendTemplateMessage(req: Request, res: Response) {
    try {
      const { restaurantId, to, templateName, language, components } = req.body

      if (!restaurantId || !to || !templateName) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID, destinatário e nome do template são obrigatórios'
        })
      }

      const integration = await WhatsAppService.getIntegration(restaurantId)
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integração WhatsApp não encontrada'
        })
      }

      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          error: 'Token de acesso inválido ou expirado'
        })
      }

      const result = await WhatsAppService.sendTemplateMessage(
        integration.phone_number_id,
        to,
        templateName,
        language || 'pt_BR',
        components || [],
        accessToken
      )

      // Salvar mensagem no banco
      await WhatsAppService.saveMessage({
        restaurant_id: restaurantId,
        message_id: result.messages?.[0]?.id || '',
        to: to,
        from: integration.phone_number_id,
        type: 'template',
        content: { template_name: templateName, language, components },
        status: 'sent'
      })

return res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Erro ao enviar template:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async uploadMedia(req: RequestWithFile, res: Response) {
    try {
      const { restaurantId } = req.body
      const file = req.file

      if (!restaurantId || !file) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID e arquivo são obrigatórios'
        })
      }

      const integration = await WhatsAppService.getIntegration(restaurantId)
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integração WhatsApp não encontrada'
        })
      }

      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          error: 'Token de acesso inválido ou expirado'
        })
      }

      const result = await WhatsAppService.uploadMedia(
        integration.phone_number_id,
        file.buffer,
        file.originalname,
        file.mimetype,
        accessToken
      )

      // Salvar mídia no banco
      await WhatsAppService.saveMedia({
        restaurant_id: restaurantId,
        media_id: result.id,
        file_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size
      })

return res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Erro ao fazer upload de mídia:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async downloadMedia(req: Request, res: Response) {
    try {
      const { mediaId } = req.params
      const { restaurantId } = req.query

      if (!mediaId || !restaurantId) {
        return res.status(400).json({
          success: false,
          error: 'Media ID e Restaurant ID são obrigatórios'
        })
      }

      const integration = await WhatsAppService.getIntegration(restaurantId as string)
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integração WhatsApp não encontrada'
        })
      }

      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          error: 'Token de acesso inválido ou expirado'
        })
      }

      const mediaBuffer = await WhatsAppService.downloadMedia(mediaId, accessToken)

      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="media-${mediaId}"`)
      return res.send(mediaBuffer)
    } catch (error) {
      console.error('Erro ao baixar mídia:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async getMessageStatus(req: Request, res: Response) {
    try {
      const { messageId } = req.params
      const { restaurantId } = req.query

      if (!messageId || !restaurantId) {
        return res.status(400).json({
          success: false,
          error: 'Message ID e Restaurant ID são obrigatórios'
        })
      }

      const integration = await WhatsAppService.getIntegration(restaurantId as string)
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integração WhatsApp não encontrada'
        })
      }

      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          error: 'Token de acesso inválido ou expirado'
        })
      }

      const status = await WhatsAppService.getMessageStatus(messageId, accessToken)

      // Atualizar status no banco
      await WhatsAppService.updateMessageStatus(messageId, status.status)

return res.json({
        success: true,
        data: status
      })
    } catch (error) {
      console.error('Erro ao buscar status da mensagem:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async registerWebhook(req: Request, res: Response) {
    try {
      const { restaurantId, webhookUrl, verifyToken } = req.body

      if (!restaurantId || !webhookUrl || !verifyToken) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID, Webhook URL e Verify Token são obrigatórios'
        })
      }

      const integration = await WhatsAppService.getIntegration(restaurantId)
      if (!integration) {
        return res.status(404).json({
          success: false,
          error: 'Integração WhatsApp não encontrada'
        })
      }

      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          error: 'Token de acesso inválido ou expirado'
        })
      }

      const result = await WhatsAppService.registerWebhook(
        integration.phone_number_id,
        webhookUrl,
        verifyToken,
        accessToken
      )

return res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Erro ao registrar webhook:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async verifyWebhook(req: Request, res: Response) {
    try {
      const { mode, challenge, 'hub.verify_token': verifyToken } = req.query

      const challengeResponse = await WhatsAppService.verifyWebhook(
        mode as string,
        challenge as string,
        verifyToken as string
      )

      if (challengeResponse) {
return res.status(200).send(challengeResponse)
      } else {
return res.status(403).send('Forbidden')
      }
    } catch (error) {
      console.error('Erro ao verificar webhook:', error)
return res.status(500).send('Internal Server Error')
    }
  }

  static async handleWebhook(req: Request, res: Response) {
    try {
      const { object, entry } = req.body

      if (object === 'whatsapp_business_account') {
        for (const webhookEntry of entry) {
          for (const change of webhookEntry.changes) {
            if (change.value.messages) {
              for (const message of change.value.messages) {
                // Processar mensagem recebida
                // Aqui você pode implementar a lógica de resposta automática
                // Por exemplo, salvar a mensagem no banco e enviar uma resposta
              }
            }

            if (change.value.statuses) {
              for (const status of change.value.statuses) {
                // Atualizar status da mensagem
                await WhatsAppService.updateMessageStatus(status.id, status.status)
              }
            }
          }
        }
      }

return res.status(200).send('OK')
    } catch (error) {
      console.error('Erro ao processar webhook:', error)
return res.status(500).send('Internal Server Error')
    }
  }

  static async saveContact(req: Request, res: Response) {
    try {
      const { restaurantId, phoneNumber, name, email, notes, tags } = req.body

      if (!restaurantId || !phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID e número de telefone são obrigatórios'
        })
      }

      const contact = await WhatsAppService.saveContact({
        restaurant_id: restaurantId,
        phone_number: phoneNumber,
        name,
        email,
        notes,
        tags
      })

return res.json({
        success: true,
        data: contact
      })
    } catch (error) {
      console.error('Erro ao salvar contato:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async getContact(req: Request, res: Response) {
    try {
      const { restaurantId, phoneNumber } = req.params

      if (!restaurantId || !phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID e número de telefone são obrigatórios'
        })
      }

      const contact = await WhatsAppService.getContact(restaurantId, phoneNumber)

return res.json({
        success: true,
        data: contact
      })
    } catch (error) {
      console.error('Erro ao buscar contato:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async getContacts(req: Request, res: Response) {
    try {
      const { restaurantId } = req.params

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID é obrigatório'
        })
      }

      const contacts = await WhatsAppService.getContacts(restaurantId)

return res.json({
        success: true,
        data: contacts
      })
    } catch (error) {
      console.error('Erro ao buscar contatos:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async updateContact(req: Request, res: Response) {
    try {
      const { restaurantId, phoneNumber } = req.params
      const updates = req.body

      if (!restaurantId || !phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID e número de telefone são obrigatórios'
        })
      }

      const contact = await WhatsAppService.updateContact(restaurantId, phoneNumber, updates)

return res.json({
        success: true,
        data: contact
      })
    } catch (error) {
      console.error('Erro ao atualizar contato:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async deleteContact(req: Request, res: Response) {
    try {
      const { restaurantId, phoneNumber } = req.params

      if (!restaurantId || !phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID e número de telefone são obrigatórios'
        })
      }

      await WhatsAppService.deleteContact(restaurantId, phoneNumber)

return res.json({
        success: true,
        message: 'Contato removido com sucesso'
      })
    } catch (error) {
      console.error('Erro ao deletar contato:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async getMessages(req: Request, res: Response) {
    try {
      const { restaurantId } = req.params
      const { limit = 50 } = req.query

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID é obrigatório'
        })
      }

      const messages = await WhatsAppService.getMessages(restaurantId, Number(limit))

return res.json({
        success: true,
        data: messages
      })
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async saveToken(req: Request, res: Response) {
    try {
      const { businessId, accessToken, refreshToken, expiresIn } = req.body

      if (!businessId || !accessToken || !refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Business ID, Access Token e Refresh Token são obrigatórios'
        })
      }

      const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000).toISOString()

      const token = await WhatsAppService.saveToken({
        business_id: businessId,
        token_data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'long_lived'
        },
        expires_at: expiresAt
      })

return res.json({
        success: true,
        data: token
      })
    } catch (error) {
      console.error('Erro ao salvar token:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async getToken(req: Request, res: Response) {
    try {
      const { businessId } = req.params

      if (!businessId) {
        return res.status(400).json({
          success: false,
          error: 'Business ID é obrigatório'
        })
      }

      const token = await WhatsAppService.getToken(businessId)

return res.json({
        success: true,
        data: token
      })
    } catch (error) {
      console.error('Erro ao buscar token:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async refreshToken(req: Request, res: Response) {
    try {
      const { businessId } = req.params
      const { refreshToken } = req.body

      if (!businessId || !refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Business ID e Refresh Token são obrigatórios'
        })
      }

      const newAccessToken = await WhatsAppService.refreshToken(businessId, refreshToken)

return res.json({
        success: true,
        data: { access_token: newAccessToken }
      })
    } catch (error) {
      console.error('Erro ao renovar token:', error)
return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async updateBusinessProfile(req: Request, res: Response) {
    try {
      const { restaurantId, profile } = req.body
      if (!restaurantId) {
        return res.status(400).json({ success: false, error: 'Restaurant ID é obrigatório' })
      }

      const integration = await WhatsAppService.getIntegration(restaurantId)
      if (!integration) {
        return res.status(404).json({ success: false, error: 'Integração WhatsApp não encontrada' })
      }

      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) {
        return res.status(401).json({ success: false, error: 'Token de acesso inválido ou expirado' })
      }

      const result = await WhatsAppService.updateBusinessProfile(
        integration.phone_number_id,
        profile,
        accessToken
      )

return res.json({ success: true, data: result })
    } catch (error) {
      console.error('Erro ao atualizar perfil do WhatsApp:', error)
return res.status(500).json({ success: false, error: 'Erro interno do servidor' })
    }
  }

  static async uploadProfilePhoto(req: RequestWithFile, res: Response) {
    try {
      const { restaurantId } = req.body
      const file = req.file
      if (!restaurantId || !file) {
        return res.status(400).json({ success: false, error: 'Restaurant ID e arquivo são obrigatórios' })
      }

      const integration = await WhatsAppService.getIntegration(restaurantId)
      if (!integration) {
        return res.status(404).json({ success: false, error: 'Integração WhatsApp não encontrada' })
      }

      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) {
        return res.status(401).json({ success: false, error: 'Token de acesso inválido ou expirado' })
      }

      const result = await WhatsAppService.uploadProfilePhoto(
        integration.phone_number_id,
        file.buffer,
        file.originalname,
        file.mimetype,
        accessToken
      )

return res.json({ success: true, data: result })
    } catch (error) {
      console.error('Erro ao enviar foto de perfil:', error)
return res.status(500).json({ success: false, error: 'Erro interno do servidor' })
    }
  }

  static async registerTemplate(req: Request, res: Response) {
    try {
      const { restaurantId, template, language } = req.body
      const integration = await WhatsAppService.getIntegration(restaurantId)
      if (!integration) return res.status(404).json({ success: false, error: 'Integração WhatsApp não encontrada' })
      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) return res.status(401).json({ success: false, error: 'Token de acesso inválido ou expirado' })

      const payload = { ...template, language: language || template.language }
      const result = await WhatsAppService.registerTemplate(integration.business_account_id, payload, accessToken)
return res.json({ success: true, data: result })
    } catch (error) {
      console.error('Erro ao registrar template:', error)
return res.status(500).json({ success: false, error: 'Erro interno do servidor' })
    }
  }

  static async validateToken(restaurantId: string): Promise<boolean> {
    try {
      // Get integration
      const integration = await WhatsAppService.getIntegration(restaurantId)
      if (!integration) {
        return false
      }

      // Get valid access token
      const accessToken = await WhatsAppService.getValidAccessToken(integration.business_account_id)
      if (!accessToken) {
        return false
      }

      // Test token by making a simple API call
      const testResponse = await axios.get(`https://graph.facebook.com/v20.0/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      return testResponse.status === 200
    } catch (error) {
      console.error('Erro ao validar token:', error)
      return false
    }
  }
} 