import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import WhatsAppService from '../services/whatsappService';
import { createError } from '../middleware/errorHandler';

export class WhatsAppController {
  /**
   * @swagger
   * /api/whatsapp/integration/setup:
   *   post:
   *     summary: Setup WhatsApp Business integration
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
   *                 description: Phone Number ID from Meta
   *               accessToken:
   *                 type: string
   *                 description: Access token from Meta OAuth
   *     responses:
   *       200:
   *         description: Integration setup successfully
   *       400:
   *         description: Missing required parameters or setup failed
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  static async setupIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { wabaId, phoneNumberId, accessToken } = req.body;
      const restaurantId = req.user?.restaurant_id;

      if (!restaurantId) {
        throw createError('Restaurant not found', 400);
      }

      if (!wabaId || !phoneNumberId || !accessToken) {
        throw createError('WABA ID, Phone Number ID, and Access Token are required', 400);
      }

      const integrationId = await WhatsAppService.setupIntegration({
        restaurantId,
        wabaId,
        phoneNumberId,
        accessToken
      });

      if (!integrationId) {
        throw createError('Failed to setup WhatsApp integration', 500);
      }

      return res.json({
        success: true,
        message: 'WhatsApp integration setup successfully',
        integrationId
      });

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
   *         description: Integration status retrieved successfully
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  static async getIntegrationStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const restaurantId = req.user?.restaurant_id;

      if (!restaurantId) {
        throw createError('Restaurant not found', 400);
      }

      const integration = await WhatsAppService.getActiveIntegration(restaurantId);

      return res.json({
        success: true,
        data: {
          connected: !!integration,
          integration: integration || null
        }
      });

    } catch (error) {
      return next(error);
    }
  }

  /**
   * @swagger
   * /api/whatsapp/messages/template:
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
   *                 description: Name of the approved template
   *               language:
   *                 type: string
   *                 description: Language code (e.g., pt_BR, en_US)
   *               parameters:
   *                 type: array
   *                 description: Template parameters
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Template message sent successfully
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  static async sendTemplateMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { to, template_name, language, parameters } = req.body;
      const restaurant_id = req.user?.restaurant_id;

      if (!restaurant_id) {
        throw createError('Restaurant not found', 400);
      }

      if (!to || !template_name || !language) {
        throw createError('Phone number, template name, and language are required', 400);
      }

      const result = await WhatsAppService.sendTemplateMessage({
        to,
        template_name,
        language,
        parameters,
        restaurant_id
      });

      if (!result.success) {
        throw createError(result.error || 'Failed to send template message', 500);
      }

      return res.json({
        success: true,
        message: 'Template message sent successfully',
        data: result.data
      });

    } catch (error) {
      return next(error);
    }
  }
} 