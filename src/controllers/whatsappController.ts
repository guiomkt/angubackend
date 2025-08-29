import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import WhatsAppService from '../services/whatsappService';

export class WhatsAppController {
  /**
   * @swagger
   * /api/whatsapp/setup:
   *   post:
   *     summary: Setup WhatsApp integration
   *     tags: [WhatsApp]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - wabaId
   *               - phoneNumberId
   *               - accessToken
   *             properties:
   *               wabaId:
   *                 type: string
   *                 description: WhatsApp Business Account ID
   *               phoneNumberId:
   *                 type: string
   *                 description: Phone Number ID from Meta API
   *               accessToken:
   *                 type: string
   *                 description: Access token from Meta OAuth
   *     responses:
   *       200:
   *         description: Integration setup successfully
   *       400:
   *         description: Missing required parameters
   *       500:
   *         description: Setup failed
   */
  static async setupIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { wabaId, phoneNumberId, accessToken } = req.body;
      const restaurantId = req.user?.restaurant_id;

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant not found'
        });
      }

      if (!wabaId || !phoneNumberId || !accessToken) {
        return res.status(400).json({
          success: false,
          message: 'WABA ID, Phone Number ID and Access Token are required'
        });
      }

      const integrationId = await WhatsAppService.setupIntegration({
        restaurantId,
        wabaId,
        phoneNumberId,
        accessToken
      });

      if (integrationId) {
        return res.json({
          success: true,
          message: 'WhatsApp integration setup successfully',
          integration_id: integrationId
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Failed to setup WhatsApp integration'
        });
      }

    } catch (error) {
      return next(error);
    }
  }

  /**
   * @swagger
   * /api/whatsapp/integration/status:
   *   get:
   *     summary: Get WhatsApp integration status
   *     tags: [WhatsApp]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Integration status retrieved
   */
  static async getIntegrationStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const restaurantId = req.user?.restaurant_id;

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant not found'
        });
      }

      const integration = await WhatsAppService.getActiveIntegration(restaurantId);

      return res.json({
        success: true,
        data: {
          connected: !!integration,
          integration: integration
        }
      });

    } catch (error) {
      return next(error);
    }
  }

  /**
   * @swagger
   * /api/whatsapp/template/send:
   *   post:
   *     summary: Send WhatsApp template message
   *     tags: [WhatsApp]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - to
   *               - template_name
   *               - language
   *             properties:
   *               to:
   *                 type: string
   *                 description: Phone number in international format
   *               template_name:
   *                 type: string
   *                 description: Template name
   *               language:
   *                 type: string
   *                 description: Language code (e.g. pt_BR)
   *               parameters:
   *                 type: array
   *                 description: Template parameters
   *     responses:
   *       200:
   *         description: Template message sent successfully
   */
  static async sendTemplateMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { to, template_name, language, parameters } = req.body;
      const restaurantId = req.user?.restaurant_id;

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant not found'
        });
      }

      if (!to || !template_name || !language) {
        return res.status(400).json({
          success: false,
          message: 'Phone number, template name and language are required'
        });
      }

      const result = await WhatsAppService.sendTemplateMessage({
        to,
        template_name,
        language,
        parameters,
        restaurant_id: restaurantId
      });

      return res.json(result);

    } catch (error) {
      return next(error);
    }
  }

  // --- NOVOS MÉTODOS PARA EMBEDDED SIGNUP META (BSP) ---

  /**
   * @swagger
   * /api/whatsapp/signup/start:
   *   get:
   *     summary: Inicia o fluxo de Embedded Signup da Meta para WhatsApp Business
   *     tags: [WhatsApp, Embedded Signup]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: URL de autorização gerada com sucesso
   */
  static async startEmbeddedSignup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const restaurantId = req.user?.restaurant_id;

      if (!userId || !restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Usuário ou restaurante não encontrado'
        });
      }

      const result = await WhatsAppService.startEmbeddedSignup(userId, restaurantId);
      
      return res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Erro ao iniciar Embedded Signup:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao iniciar configuração do WhatsApp Business',
        error: error.message
      });
    }
  }

  /**
   * Processa o callback OAuth do Facebook/Meta.
   * Novo método usando o serviço modernizado.
   */
  static async handleOAuthCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.query;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code is required'
        });
      }

      if (!state) {
        return res.status(400).json({
          success: false,
          message: 'State parameter is required'
        });
      }

      // Usar o novo método do serviço
      const result = await WhatsAppService.handleOAuthCallback(code as string, state as string);

              if (result.success) {
          const redirectUrl = result.waba_id 
            ? `${process.env.FRONTEND_URL || 'https://angu.ai'}/settings/integrations?whatsapp=waba_detected&state=${encodeURIComponent(state as string)}`
            : `${process.env.FRONTEND_URL || 'https://angu.ai'}/settings/integrations?whatsapp=awaiting_waba&state=${encodeURIComponent(state as string)}`;

        return res.json({
          success: true,
          message: result.message,
          data: {
            ...result,
            redirect_url: redirectUrl
          }
        });
      } else {
        return res.status(400).json({
          success: false,
          message: result.message,
          data: result
        });
      }

    } catch (error: any) {
      console.error('Erro no OAuth callback:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno no callback OAuth',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/whatsapp/signup/status:
   *   get:
   *     summary: Verifica o status do processo de Embedded Signup
   *     tags: [WhatsApp, Embedded Signup]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: state
   *         schema:
   *           type: string
   *         description: State do processo OAuth (opcional)
   *     responses:
   *       200:
   *         description: Status verificado com sucesso
   */
  static async getEmbeddedSignupStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { state } = req.query;
      
      // Se state fornecido, buscar por state (sem necessidade de autenticação)
      if (state) {
        const status = await WhatsAppService.getEmbeddedSignupStatus(undefined, undefined, state as string);
        
        return res.json({
          success: true,
          data: status
        });
      }

      // Senão, verificar autenticação e buscar por usuário
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Token de autenticação necessário quando state não fornecido'
        });
      }

      // Implementar verificação de token básica
      const token = authHeader.substring(7);
      const jwt = require('jsonwebtoken');
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido'
        });
      }

      const userId = decoded.id;
      const restaurantId = decoded.restaurant_id;

      if (!userId || !restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Usuário ou restaurante não encontrado'
        });
      }

      const status = await WhatsAppService.getEmbeddedSignupStatus(userId, restaurantId);
      
      return res.json({
        success: true,
        data: status
      });

    } catch (error: any) {
      console.error('Erro ao verificar status do Embedded Signup:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao verificar status',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/whatsapp/signup/register-phone:
   *   post:
   *     summary: Registra um número de telefone no WhatsApp Business
   *     tags: [WhatsApp, Embedded Signup]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - phone_number
   *             properties:
   *               phone_number:
   *                 type: string
   *                 description: Número de telefone (formato internacional)
   *               pin:
   *                 type: string
   *                 description: PIN de 6 dígitos (opcional)
   *     responses:
   *       200:
   *         description: Número registrado com sucesso
   */
  static async registerPhoneNumber(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const restaurantId = req.user?.restaurant_id;
      const { phone_number, pin } = req.body;

      if (!userId || !restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Usuário ou restaurante não encontrado'
        });
      }

      if (!phone_number) {
        return res.status(400).json({
          success: false,
          message: 'Número de telefone é obrigatório'
        });
      }

      const result = await WhatsAppService.registerPhoneNumber(userId, restaurantId, phone_number, pin);
      
      return res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Erro ao registrar número de telefone:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao registrar número',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/whatsapp/signup/verify-code:
   *   post:
   *     summary: Confirma o código de verificação do número de telefone
   *     tags: [WhatsApp, Embedded Signup]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - phone_number_id
   *               - verification_code
   *             properties:
   *               phone_number_id:
   *                 type: string
   *                 description: ID do número de telefone
   *               verification_code:
   *                 type: string
   *                 description: Código de verificação
   *     responses:
   *       200:
   *         description: Verificação confirmada com sucesso
   */
  static async verifyPhoneNumberCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const restaurantId = req.user?.restaurant_id;
      const { phone_number_id, verification_code } = req.body;

      if (!userId || !restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Usuário ou restaurante não encontrado'
        });
      }

      if (!phone_number_id || !verification_code) {
        return res.status(400).json({
          success: false,
          message: 'ID do número e código de verificação são obrigatórios'
        });
      }

      const result = await WhatsAppService.verifyPhoneNumberCode(userId, restaurantId, phone_number_id, verification_code);
      
      return res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Erro ao verificar código do telefone:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao verificar código',
        error: error.message
      });
    }
  }

  /**
   * @swagger
   * /api/whatsapp/signup/refresh-waba:
   *   post:
   *     summary: Força nova verificação de WABA após criação pelo usuário
   *     tags: [WhatsApp, Embedded Signup]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - state
   *             properties:
   *               state:
   *                 type: string
   *                 description: State do processo de signup
   *     responses:
   *       200:
   *         description: WABA verificada com sucesso
   */
  static async refreshWABAStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const restaurantId = req.user?.restaurant_id;
      const { state } = req.body;

      if (!userId || !restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Usuário ou restaurante não encontrado'
        });
      }

      if (!state) {
        return res.status(400).json({
          success: false,
          message: 'State é obrigatório'
        });
      }

      const result = await WhatsAppService.refreshWABAStatus(userId, restaurantId, state);
      
      return res.json({
        success: true,
        data: result
      });

    } catch (error: any) {
      console.error('Erro ao atualizar status da WABA:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao atualizar status',
        error: error.message
      });
    }
  }
} 