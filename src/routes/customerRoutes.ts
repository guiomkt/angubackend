import { Router } from 'express';
import { authenticateToken, requireRestaurant } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

router.get('/today', authenticateToken, requireRestaurant, async (req, res) => {
  try {
    const { date } = req.query;
    const restaurantId = req.user?.restaurant_id;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Date parameter is required'
      });
    }

    const { data, error } = await supabase
      .from('chat_contacts')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', date);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

router.get('/yesterday', authenticateToken, requireRestaurant, async (req, res) => {
  try {
    const { from, to } = req.query;
    const restaurantId = req.user?.restaurant_id;

    if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'From and to parameters are required'
      });
    }

    const { data, error } = await supabase
      .from('chat_contacts')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', from)
      .lt('created_at', to);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 