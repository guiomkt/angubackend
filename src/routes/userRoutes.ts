import { Router } from 'express';
import { authenticateToken, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

router.get('/', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('users_profile')
      .select('*, restaurant:restaurants(*)')
      .eq('restaurant_id', restaurantId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const payload = { ...req.body, restaurant_id: restaurantId };
    const { data, error } = await supabase
      .from('users_profile')
      .insert([payload])
      .select('*');

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('users_profile')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select('*');

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { error } = await supabase
      .from('users_profile')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router; 