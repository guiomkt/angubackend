import { Router } from 'express'
import { authenticate, requireRestaurant, AuthenticatedRequest } from '../middleware/auth'
import { supabase } from '../config/database'

const router = Router()

/**
 * @swagger
 * /api/ai/settings:
 *   get:
 *     summary: Obter configurações de IA do restaurante
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações de IA
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AISettings'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/settings', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const { data, error } = await supabase.from('ai_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle()
    if (error) {
      return res.status(500).json({ success: false, error: error.message })
    }
    return res.json({ success: true, data: data || null })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/ai/settings:
 *   post:
 *     summary: Criar/atualizar configurações de IA
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               personality:
 *                 type: string
 *                 enum: [formal, friendly, enthusiastic]
 *                 description: Personalidade da IA
 *               settings:
 *                 type: object
 *                 properties:
 *                   welcome_message:
 *                     type: string
 *                     description: Mensagem de boas-vindas personalizada
 *                   reservation_flow:
 *                     type: string
 *                     description: Fluxo de reserva personalizado
 *                   menu_suggestions:
 *                     type: boolean
 *                     description: Habilitar sugestões de menu
 *                   customer_service_tone:
 *                     type: string
 *                     description: Tom do atendimento ao cliente
 *                   language:
 *                     type: string
 *                     description: Idioma da IA
 *                   max_response_length:
 *                     type: integer
 *                     description: Comprimento máximo da resposta
 *                   auto_suggestions:
 *                     type: boolean
 *                     description: Habilitar sugestões automáticas
 *     responses:
 *       201:
 *         description: Configurações salvas com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/settings', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const payload = { ...req.body, restaurant_id: restaurantId }
    const { error } = await supabase.from('ai_settings').upsert(payload)
    if (error) {
      return res.status(400).json({ success: false, error: error.message })
    }
    return res.status(201).json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/ai/settings/personality:
 *   put:
 *     summary: Atualizar personalidade da IA
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - personality
 *             properties:
 *               personality:
 *                 type: string
 *                 enum: [formal, friendly, enthusiastic]
 *                 description: Nova personalidade da IA
 *     responses:
 *       200:
 *         description: Personalidade atualizada com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/settings/personality', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const { personality } = req.body

    if (!personality || !['formal', 'friendly', 'enthusiastic'].includes(personality)) {
      return res.status(400).json({ success: false, error: 'Invalid personality type' })
    }

    const { error } = await supabase
      .from('ai_settings')
      .upsert({
        restaurant_id: restaurantId,
        personality,
        updated_at: new Date().toISOString()
      })

    if (error) {
      return res.status(400).json({ success: false, error: error.message })
    }

    return res.json({ success: true, message: 'Personality updated successfully' })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/ai/settings/custom:
 *   put:
 *     summary: Atualizar configurações customizadas da IA
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               welcome_message:
 *                 type: string
 *               reservation_flow:
 *                 type: string
 *               menu_suggestions:
 *                 type: boolean
 *               customer_service_tone:
 *                 type: string
 *               language:
 *                 type: string
 *               max_response_length:
 *                 type: integer
 *               auto_suggestions:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Configurações customizadas atualizadas com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/settings/custom', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const customSettings = req.body

    // Buscar configurações atuais
    const { data: currentSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()

    const updatedSettings = {
      ...currentSettings?.settings || {},
      ...customSettings
    }

    const { error } = await supabase
      .from('ai_settings')
      .upsert({
        restaurant_id: restaurantId,
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      })

    if (error) {
      return res.status(400).json({ success: false, error: error.message })
    }

    return res.json({ success: true, message: 'Custom settings updated successfully' })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/ai/settings/reset:
 *   post:
 *     summary: Resetar configurações de IA para padrão
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações resetadas com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/settings/reset', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id

    const defaultSettings = {
      personality: 'friendly',
      settings: {
        welcome_message: 'Olá! Como posso ajudá-lo hoje?',
        reservation_flow: 'standard',
        menu_suggestions: true,
        customer_service_tone: 'professional',
        language: 'pt_BR',
        max_response_length: 200,
        auto_suggestions: true
      }
    }

    const { error } = await supabase
      .from('ai_settings')
      .upsert({
        restaurant_id: restaurantId,
        ...defaultSettings,
        updated_at: new Date().toISOString()
      })

    if (error) {
      return res.status(400).json({ success: false, error: error.message })
    }

    return res.json({ success: true, message: 'Settings reset to default successfully' })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router 