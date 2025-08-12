import { Router } from 'express'
import { authenticateToken, requireRestaurant, AuthenticatedRequest } from '../middleware/auth'
import { supabase } from '../config/database'

const router = Router()

router.get('/settings', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

router.post('/settings', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
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

export default router 