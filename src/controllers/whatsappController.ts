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
} 