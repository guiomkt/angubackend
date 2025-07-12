import { Router } from 'express';
import { authenticateToken, requireRestaurant } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

router.get('/events', authenticateToken, requireRestaurant, async (req, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;

    const [bonifications, events, events_exclusive] = await Promise.all([
      supabase
        .from("experience_bonifications")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .eq("status", true),
      supabase
        .from("experience_events_exclusives")
        .select("id, name")
        .eq("restaurant_id", restaurantId),
    ]);

    const experiences = {
      bonifications: bonifications.data || [],
      events: events.data || [],
      events_exclusive: events_exclusive.data || [],
    };

    res.json({
      success: true,
      data: experiences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 