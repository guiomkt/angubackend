import { Request, Response } from 'express'
import { WhatsAppService } from '../services/whatsappService'
import { RestaurantService } from '../services/restaurantService'
import axios from 'axios'
import multer from 'multer'

interface RequestWithFile extends Request {
  file?: Express.Multer.File
}

export class WhatsAppController {
  static async getBusinessAccounts(req: Request, res: Response) {
    try {
      const { accessToken } = req.body

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: 'Access token é obrigatório'
        })
      }

      const businessAccounts = await WhatsAppService.getBusinessAccounts(accessToken)

      res.json({
        success: true,
        data: businessAccounts
      })
    } catch (error) {
      console.error('Erro ao buscar contas de negócio:', error)
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async getPhoneNumbers(req: Request, res: Response) {
    try {
      const { businessAccountId, accessToken } = req.body

      if (!businessAccountId || !accessToken) {
        return res.status(400).json({
          success: false,
          error: 'Business Account ID e Access Token são obrigatórios'
        })
      }

      const phoneNumbers = await WhatsAppService.getPhoneNumbers(businessAccountId, accessToken)

      res.json({
        success: true,
        data: phoneNumbers
      })
    } catch (error) {
      console.error('Erro ao buscar números de telefone:', error)
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

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

      res.json({
        success: true,
        data: integration
      })
    } catch (error) {
      console.error('Erro ao salvar integração:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: integration
      })
    } catch (error) {
      console.error('Erro ao buscar integração:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: integration
      })
    } catch (error) {
      console.error('Erro ao atualizar integração:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        message: 'Integração removida com sucesso'
      })
    } catch (error) {
      console.error('Erro ao deletar integração:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Erro ao enviar template:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Erro ao fazer upload de mídia:', error)
      res.status(500).json({
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
      res.send(mediaBuffer)
    } catch (error) {
      console.error('Erro ao baixar mídia:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: status
      })
    } catch (error) {
      console.error('Erro ao buscar status da mensagem:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      console.error('Erro ao registrar webhook:', error)
      res.status(500).json({
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
        res.status(200).send(challengeResponse)
      } else {
        res.status(403).send('Forbidden')
      }
    } catch (error) {
      console.error('Erro ao verificar webhook:', error)
      res.status(500).send('Internal Server Error')
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

      res.status(200).send('OK')
    } catch (error) {
      console.error('Erro ao processar webhook:', error)
      res.status(500).send('Internal Server Error')
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

      res.json({
        success: true,
        data: contact
      })
    } catch (error) {
      console.error('Erro ao salvar contato:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: contact
      })
    } catch (error) {
      console.error('Erro ao buscar contato:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: contacts
      })
    } catch (error) {
      console.error('Erro ao buscar contatos:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: contact
      })
    } catch (error) {
      console.error('Erro ao atualizar contato:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        message: 'Contato removido com sucesso'
      })
    } catch (error) {
      console.error('Erro ao deletar contato:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: messages
      })
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error)
      res.status(500).json({
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
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt
      })

      res.json({
        success: true,
        data: token
      })
    } catch (error) {
      console.error('Erro ao salvar token:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: token
      })
    } catch (error) {
      console.error('Erro ao buscar token:', error)
      res.status(500).json({
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

      res.json({
        success: true,
        data: { access_token: newAccessToken }
      })
    } catch (error) {
      console.error('Erro ao renovar token:', error)
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      })
    }
  }

  static async exchangeCodeForToken(code: string, restaurantId: string) {
    try {
      const clientId = process.env.FACEBOOK_APP_ID
      const clientSecret = process.env.FACEBOOK_APP_SECRET
      const redirectUri = `${process.env.BASE_URL || 'http://localhost:5173'}/whatsapp/callback`

      // Exchange code for access token
      const tokenResponse = await axios.post('https://graph.facebook.com/v19.0/oauth/access_token', {
        client_id: clientId,
        redirect_uri: redirectUri,
        client_secret: clientSecret,
        code: code
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      const tokenData = tokenResponse.data as any
      const { access_token, token_type, expires_in } = tokenData

      // Get business accounts
      const accountsResponse = await axios.get(`https://graph.facebook.com/v19.0/me/businesses`, {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      })

      const accountsData = accountsResponse.data as any
      const businessAccount = accountsData.data[0]
      if (!businessAccount) {
        throw new Error('Nenhuma conta de negócio encontrada')
      }

      // Get phone numbers
      const phoneNumbersResponse = await axios.get(
        `https://graph.facebook.com/v19.0/${businessAccount.id}/phone_numbers`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        }
      )

      const phoneNumbersData = phoneNumbersResponse.data as any
      const phoneNumber = phoneNumbersData.data[0]
      if (!phoneNumber) {
        throw new Error('Nenhum número de telefone encontrado')
      }

      // Save integration
      const integration = await WhatsAppService.saveIntegration(restaurantId, {
        phone_number_id: phoneNumber.id,
        business_account_id: businessAccount.id,
        access_token: access_token
      })

      // Save token
      await WhatsAppService.saveToken({
        business_id: businessAccount.id,
        access_token: access_token,
        refresh_token: '', // Facebook doesn't provide refresh tokens
        expires_at: new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
      })

      return {
        success: true,
        data: {
          integration,
          businessAccount,
          phoneNumber
        }
      }

    } catch (error) {
      throw new Error(`Erro na troca do código: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
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
      const testResponse = await axios.get(`https://graph.facebook.com/v19.0/me`, {
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

  static async processOAuthCallback(code: string, state: string) {
    try {
      // Decode state to get restaurant ID and redirect URL
      const stateData = JSON.parse(decodeURIComponent(state))
      const { restaurantId, redirectUrl } = stateData

      if (!restaurantId) {
        throw new Error('Restaurant ID não encontrado no state')
      }

      // Exchange code for token (reuse existing logic)
      const result = await this.exchangeCodeForToken(code, restaurantId)

      return {
        success: true,
        restaurantId,
        redirectUrl,
        data: result
      }

    } catch (error) {
      throw new Error(`Erro ao processar callback: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
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

      res.json({ success: true, data: result })
    } catch (error) {
      console.error('Erro ao atualizar perfil do WhatsApp:', error)
      res.status(500).json({ success: false, error: 'Erro interno do servidor' })
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

      res.json({ success: true, data: result })
    } catch (error) {
      console.error('Erro ao enviar foto de perfil:', error)
      res.status(500).json({ success: false, error: 'Erro interno do servidor' })
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
      res.json({ success: true, data: result })
    } catch (error) {
      console.error('Erro ao registrar template:', error)
      res.status(500).json({ success: false, error: 'Erro interno do servidor' })
    }
  }
} 