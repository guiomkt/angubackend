import { Router } from 'express'
import { authenticate, requireRestaurant, AuthenticatedRequest } from '../middleware/auth'
import { supabase } from '../config/database'

const router = Router()

/**
 * @swagger
 * /api/crm/stages:
 *   get:
 *     summary: Lista todas as etapas do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de etapas retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CrmStage'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */

// List stages
router.get('/stages', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const { data, error } = await supabase
      .from('crm_stages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('order')
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.json({ success: true, data: data || [] })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/stages:
 *   post:
 *     summary: Cria uma nova etapa do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - order
 *               - is_active
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome da etapa
 *               description:
 *                 type: string
 *                 description: Descrição da etapa
 *               color:
 *                 type: string
 *                 description: Cor da etapa (hex)
 *               icon:
 *                 type: string
 *                 description: Ícone da etapa
 *               order:
 *                 type: number
 *                 description: Ordem da etapa
 *               is_active:
 *                 type: boolean
 *                 description: Se a etapa está ativa
 *     responses:
 *       201:
 *         description: Etapa criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CrmStage'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// Create stage
router.post('/stages', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const payload = { ...req.body, restaurant_id: restaurantId }
    const { data, error } = await supabase.from('crm_stages').insert(payload).select().single()
    if (error) return res.status(400).json({ success: false, error: error.message })
    return res.status(201).json({ success: true, data })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/stages/{id}:
 *   put:
 *     summary: Atualiza uma etapa do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da etapa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrmStage'
 *     responses:
 *       200:
 *         description: Etapa atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CrmStage'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// Update stage
router.put('/stages/:id', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('crm_stages')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(400).json({ success: false, error: error.message })
    return res.json({ success: true, data })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/stages/{id}:
 *   delete:
 *     summary: Remove uma etapa do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da etapa
 *     responses:
 *       200:
 *         description: Etapa removida com sucesso
 *       401:
 *         description: Não autorizado
 *       409:
 *         description: Etapa possui cards associados
 *       500:
 *         description: Erro interno do servidor
 */
// Delete stage
router.delete('/stages/:id', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    // Ensure no cards in this stage
    const { count, error: countError } = await supabase
      .from('crm_cards')
      .select('id', { count: 'exact', head: true })
      .eq('stage_id', id)
    if (countError) return res.status(400).json({ success: false, error: countError.message })
    if ((count || 0) > 0) return res.status(409).json({ success: false, error: 'Stage has cards' })
    const { error } = await supabase.from('crm_stages').delete().eq('id', id)
    if (error) return res.status(400).json({ success: false, error: error.message })
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/stages/defaults:
 *   post:
 *     summary: Cria etapas padrão do CRM se não existirem
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Etapas padrão já existem
 *       201:
 *         description: Etapas padrão criadas com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// Create default stages if none
router.post('/stages/defaults', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const { count, error: countError } = await supabase
      .from('crm_stages')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
    if (countError) return res.status(400).json({ success: false, error: countError.message })
    if ((count || 0) > 0) return res.json({ success: true })

    const defaults = [
      { name: 'Primeiro Contato', description: 'Clientes que acabaram de entrar em contato', color: '#3498db', icon: 'MessageSquare', order: 0, is_active: true },
      { name: 'Interesse em Reserva', description: 'Clientes interessados em fazer uma reserva', color: '#2ecc71', icon: 'Calendar', order: 1, is_active: true },
      { name: 'Reserva Efetuada', description: 'Clientes com reserva confirmada', color: '#27ae60', icon: 'CheckCircle', order: 2, is_active: true },
      { name: 'Interesse em Aniversário', description: 'Clientes interessados em comemorar aniversário', color: '#9b59b6', icon: 'Cake', order: 3, is_active: true },
      { name: 'Aniversário Confirmado', description: 'Clientes com aniversário confirmado', color: '#8e44ad', icon: 'Gift', order: 4, is_active: true },
      { name: 'Interesse em Eventos', description: 'Clientes interessados em realizar eventos', color: '#f39c12', icon: 'Users', order: 5, is_active: true },
      { name: 'Evento Confirmado', description: 'Clientes com evento confirmado', color: '#d35400', icon: 'PartyPopper', order: 6, is_active: true },
      { name: 'Dúvidas', description: 'Clientes com dúvidas pendentes', color: '#e74c3c', icon: 'HelpCircle', order: 7, is_active: true },
      { name: 'Reclamações', description: 'Clientes com reclamações a serem resolvidas', color: '#c0392b', icon: 'AlertTriangle', order: 8, is_active: true }
    ].map(s => ({ ...s, restaurant_id: restaurantId }))

    const { error } = await supabase.from('crm_stages').insert(defaults)
    if (error) return res.status(400).json({ success: false, error: error.message })
    return res.status(201).json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/tags:
 *   get:
 *     summary: Lista todas as tags do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tags retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CrmCardTag'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// List tags
router.get('/tags', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const { data, error } = await supabase
      .from('crm_card_tags')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name')
    if (error) return res.status(500).json({ success: false, error: error.message })
    return res.json({ success: true, data: data || [] })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/tags:
 *   post:
 *     summary: Cria uma nova tag do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome da tag
 *               color:
 *                 type: string
 *                 description: Cor da tag (hex)
 *     responses:
 *       201:
 *         description: Tag criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CrmCardTag'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// Create tag
router.post('/tags', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const payload = { ...req.body, restaurant_id: restaurantId }
    const { data, error } = await supabase.from('crm_card_tags').insert(payload).select().single()
    if (error) return res.status(400).json({ success: false, error: error.message })
    return res.status(201).json({ success: true, data })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/tags/{id}:
 *   delete:
 *     summary: Remove uma tag do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da tag
 *     responses:
 *       200:
 *         description: Tag removida com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// Delete tag
router.delete('/tags/:id', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    // Remove relations first
    const { error: relError } = await supabase.from('crm_card_tag_relations').delete().eq('tag_id', id)
    if (relError) return res.status(400).json({ success: false, error: relError.message })
    const { error } = await supabase.from('crm_card_tags').delete().eq('id', id)
    if (error) return res.status(400).json({ success: false, error: error.message })
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/cards:
 *   get:
 *     summary: Lista todos os cards do CRM com detalhes
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de cards retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CrmCardWithDetails'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// List cards with details
router.get('/cards', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const { data: cards, error: cardsError } = await supabase
      .from('crm_cards')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('updated_at', { ascending: false })
    if (cardsError) return res.status(500).json({ success: false, error: cardsError.message })

    const cardIds = (cards || []).map(c => c.id)
    const contactIds = (cards || []).filter(c => c.contact_id).map(c => c.contact_id as string)

    const [relations, tags, activities, contacts] = await Promise.all([
      cardIds.length ? supabase.from('crm_card_tag_relations').select('card_id, tag_id').in('card_id', cardIds) : Promise.resolve({ data: [], error: null }),
      cardIds.length ? supabase.from('crm_card_tags').select('*').eq('restaurant_id', restaurantId) : Promise.resolve({ data: [], error: null }),
      cardIds.length ? supabase.from('crm_card_activities').select('*').in('card_id', cardIds).order('performed_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      contactIds.length ? supabase.from('chat_contacts').select('*').in('id', contactIds) : Promise.resolve({ data: [], error: null })
    ])

    const tagsMap = new Map<string, any>((tags.data as any[] || []).map(t => [t.id, t]))
    const contactMap = new Map<string, any>((contacts.data as any[] || []).map(c => [c.id, c]))
    const relByCard = new Map<string, any[]>()
    ;(relations.data as any[] || []).forEach(r => {
      if (!relByCard.has(r.card_id)) relByCard.set(r.card_id, [])
      const arr = relByCard.get(r.card_id)!
      const tag = tagsMap.get(r.tag_id)
      if (tag) arr.push(tag)
    })
    const actByCard = new Map<string, any[]>()
    ;(activities.data as any[] || []).forEach(a => {
      if (!actByCard.has(a.card_id)) actByCard.set(a.card_id, [])
      actByCard.get(a.card_id)!.push(a)
    })

    const result = (cards || []).map(card => ({
      ...card,
      contact: card.contact_id ? contactMap.get(card.contact_id as string) : undefined,
      tags: relByCard.get(card.id) || [],
      activities: actByCard.get(card.id) || []
    }))

    return res.json({ success: true, data: result })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/cards:
 *   post:
 *     summary: Cria um novo card do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - stage_id
 *               - title
 *               - priority
 *               - status
 *             properties:
 *               stage_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID da etapa do card
 *               contact_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do contato associado
 *               title:
 *                 type: string
 *                 description: Título do card
 *               description:
 *                 type: string
 *                 description: Descrição do card
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Prioridade do card
 *               status:
 *                 type: string
 *                 enum: [active, completed, archived]
 *                 description: Status do card
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Data de vencimento
 *               assigned_to:
 *                 type: string
 *                 format: uuid
 *                 description: ID do usuário responsável
 *               value:
 *                 type: number
 *                 description: Valor do card
 *               tag_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: IDs das tags associadas
 *     responses:
 *       201:
 *         description: Card criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CrmCard'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// Create card
router.post('/cards', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    const { tag_ids, ...card } = req.body
    const payload = { ...card, restaurant_id: restaurantId }
    const { data, error } = await supabase.from('crm_cards').insert(payload).select().single()
    if (error) return res.status(400).json({ success: false, error: error.message })

    if (Array.isArray(tag_ids) && tag_ids.length) {
      const rels = tag_ids.map((tagId: string) => ({ card_id: data.id, tag_id: tagId }))
      const { error: tagError } = await supabase.from('crm_card_tag_relations').insert(rels)
      if (tagError) return res.status(400).json({ success: false, error: tagError.message })
    }

    // basic activity
    await supabase.from('crm_card_activities').insert({ card_id: data.id, activity_type: 'note', description: 'Card criado' })

    return res.status(201).json({ success: true, data })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/cards/{id}:
 *   put:
 *     summary: Atualiza um card do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do card
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrmCard'
 *     responses:
 *       200:
 *         description: Card atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CrmCard'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// Update card
router.put('/cards/:id', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const { tag_ids, ...cardData } = req.body
    const { data, error } = await supabase
      .from('crm_cards')
      .update({ ...cardData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(400).json({ success: false, error: error.message })

    if (tag_ids !== undefined) {
      await supabase.from('crm_card_tag_relations').delete().eq('card_id', id)
      if (Array.isArray(tag_ids) && tag_ids.length) {
        const rels = tag_ids.map((tagId: string) => ({ card_id: id, tag_id: tagId }))
        const { error: tagError } = await supabase.from('crm_card_tag_relations').insert(rels)
        if (tagError) return res.status(400).json({ success: false, error: tagError.message })
      }
    }

    return res.json({ success: true, data })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/cards/{id}:
 *   delete:
 *     summary: Remove um card do CRM
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do card
 *     responses:
 *       200:
 *         description: Card removido com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// Delete card
router.delete('/cards/:id', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    await supabase.from('crm_card_tag_relations').delete().eq('card_id', id)
    await supabase.from('crm_card_activities').delete().eq('card_id', id)
    const { error } = await supabase.from('crm_cards').delete().eq('id', id)
    if (error) return res.status(400).json({ success: false, error: error.message })
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/**
 * @swagger
 * /api/crm/cards/{id}/activities:
 *   post:
 *     summary: Adiciona uma atividade a um card
 *     tags: [CRM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do card
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activity_type
 *               - description
 *             properties:
 *               activity_type:
 *                 type: string
 *                 enum: [note, stage_change, contact, reservation, event]
 *                 description: Tipo da atividade
 *               description:
 *                 type: string
 *                 description: Descrição da atividade
 *               performed_by:
 *                 type: string
 *                 format: uuid
 *                 description: ID do usuário que realizou a atividade
 *     responses:
 *       201:
 *         description: Atividade adicionada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CrmCardActivity'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
// Add activity to card
router.post('/cards/:id/activities', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params
    const payload = { ...req.body, card_id: id }
    const { data, error } = await supabase.from('crm_card_activities').insert(payload).select().single()
    if (error) return res.status(400).json({ success: false, error: error.message })
    return res.status(201).json({ success: true, data })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router 