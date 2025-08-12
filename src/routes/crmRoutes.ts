import { Router } from 'express'
import { authenticateToken, requireRestaurant, AuthenticatedRequest } from '../middleware/auth'
import { supabase } from '../config/database'

const router = Router()

// List stages
router.get('/stages', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Create stage
router.post('/stages', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Update stage
router.put('/stages/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Delete stage
router.delete('/stages/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Create default stages if none
router.post('/stages/defaults', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// List tags
router.get('/tags', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Create tag
router.post('/tags', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Delete tag
router.delete('/tags/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// List cards with details
router.get('/cards', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Create card
router.post('/cards', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Update card
router.put('/cards/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Delete card
router.delete('/cards/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

// Add activity to card
router.post('/cards/:id/activities', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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