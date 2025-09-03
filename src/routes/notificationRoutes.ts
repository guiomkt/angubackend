import { Router } from 'express';
import { authenticate, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import notificationService from '../services/notificationService';

const router = Router();

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Obter configurações de notificação do restaurante
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações de notificação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/NotificationSettings'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/settings', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;

    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Restaurant ID not found' });
    }

    const result = await notificationService.getNotificationSettings(restaurantId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: Atualizar configurações de notificação
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_notifications:
 *                 type: boolean
 *               sms_notifications:
 *                 type: boolean
 *               whatsapp_notifications:
 *                 type: boolean
 *               push_notifications:
 *                 type: boolean
 *               reservation_confirmation:
 *                 type: boolean
 *               reservation_reminder:
 *                 type: boolean
 *               waiting_list_notification:
 *                 type: boolean
 *               table_ready_notification:
 *                 type: boolean
 *               marketing_notifications:
 *                 type: boolean
 *               notification_timing:
 *                 type: object
 *                 properties:
 *                   reservation_reminder_hours:
 *                     type: integer
 *                   table_ready_delay:
 *                     type: integer
 *     responses:
 *       200:
 *         description: Configurações atualizadas com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/settings', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;

    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Restaurant ID not found' });
    }

    const result = await notificationService.updateNotificationSettings(restaurantId, req.body);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/settings/default:
 *   post:
 *     summary: Criar configurações de notificação padrão
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações padrão criadas com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/settings/default', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;

    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Restaurant ID not found' });
    }

    const result = await notificationService.createDefaultNotificationSettings(restaurantId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/settings/toggle/{type}:
 *   put:
 *     summary: Alternar tipo de notificação
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *         description: Tipo de notificação (email_notifications, sms_notifications, etc.)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 description: Habilitar/desabilitar notificação
 *     responses:
 *       200:
 *         description: Configuração alternada com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/settings/toggle/:type', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { type } = req.params;
    const { enabled } = req.body;

    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Restaurant ID not found' });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Enabled must be a boolean' });
    }

    const result = await notificationService.toggleNotificationType(restaurantId, type as any, enabled);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/notifications/settings/timing:
 *   put:
 *     summary: Atualizar configurações de timing das notificações
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reservation_reminder_hours:
 *                 type: integer
 *                 description: Horas antes da reserva para enviar lembrete
 *               table_ready_delay:
 *                 type: integer
 *                 description: Delay em minutos para notificar mesa pronta
 *     responses:
 *       200:
 *         description: Timing atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/settings/timing', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;

    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Restaurant ID not found' });
    }

    const result = await notificationService.updateNotificationTiming(restaurantId, req.body);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router; 