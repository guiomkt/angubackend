import { Router } from 'express';
import { authenticateToken, requireRestaurant } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ExperienceEvent:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: boolean
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         created_at:
 *           type: string
 *           format: date-time
 *     BlockedDate:
 *       type: object
 *       required:
 *         - restaurant_id
 *         - area_id
 *         - init_date
 *         - end_date
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         area_id:
 *           type: string
 *           format: uuid
 *         init_date:
 *           type: string
 *           format: date
 *         end_date:
 *           type: string
 *           format: date
 *         reason:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     ExperienceEvents:
 *       type: object
 *       properties:
 *         bonifications:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ExperienceEvent'
 *         events:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ExperienceEvent'
 *         events_exclusive:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ExperienceEvent'
 */

/**
 * @swagger
 * /api/experience/events:
 *   get:
 *     summary: Get all experience events for current restaurant
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of experience events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ExperienceEvents'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/events', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;

    const [bonifications, events, events_exclusive] = await Promise.all([
      supabase
        .from("experience_bonifications")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .eq("status", true),
      supabase
        .from("experience_events")
        .select("id, name")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("experience_events_exclusives")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .eq("status", true),
    ]);

    const experiences = {
      bonifications: bonifications.data || [],
      events: events.data || [],
      events_exclusive: events_exclusive.data || [],
    };

    return res.json({
      success: true,
      data: experiences
    });
  } catch (error) {
    console.error('Error fetching experiences:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/experience/blocked-dates:
 *   get:
 *     summary: Get blocked dates for current restaurant
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of blocked dates
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
 *                     $ref: '#/components/schemas/BlockedDate'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/blocked-dates', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from("bloqued_dates")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch blocked dates'
      });
    }

    return res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/experience/blocked-dates:
 *   post:
 *     summary: Create a new blocked date
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - area_id
 *               - init_date
 *               - end_date
 *             properties:
 *               area_id:
 *                 type: string
 *                 format: uuid
 *               init_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               init_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Horário de início (opcional, se não informado bloqueia o dia inteiro)
 *               end_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Horário de fim (opcional, se não informado bloqueia o dia inteiro)
 *               is_full_day:
 *                 type: boolean
 *                 default: true
 *                 description: Se bloqueia o dia inteiro
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Blocked date created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BlockedDate'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.post('/blocked-dates', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { area_id, init_date, end_date, init_time, end_time, reason, is_full_day = true } = req.body;

    const { data, error } = await supabase
      .from("bloqued_dates")
      .insert([{
        restaurant_id: restaurantId,
        area_id,
        init_date,
        end_date,
        init_time: is_full_day ? null : init_time,
        end_time: is_full_day ? null : end_time,
        reason,
        is_full_day
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/experience/blocked-dates/{id}:
 *   put:
 *     summary: Update a blocked date
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blocked date ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               area_id:
 *                 type: string
 *                 format: uuid
 *               init_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               init_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Horário de início (opcional, se não informado bloqueia o dia inteiro)
 *               end_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Horário de fim (opcional, se não informado bloqueia o dia inteiro)
 *               is_full_day:
 *                 type: boolean
 *                 default: true
 *                 description: Se bloqueia o dia inteiro
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Blocked date updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BlockedDate'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Blocked date not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.put('/blocked-dates/:id', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { area_id, init_date, end_date, init_time, end_time, reason, is_full_day = true } = req.body;

    const { data, error } = await supabase
      .from("bloqued_dates")
      .update({
        area_id,
        init_date,
        end_date,
        init_time: is_full_day ? null : init_time,
        end_time: is_full_day ? null : end_time,
        reason,
        is_full_day,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/experience/blocked-dates/{id}:
 *   delete:
 *     summary: Delete a blocked date
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blocked date ID
 *     responses:
 *       200:
 *         description: Blocked date deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Blocked date not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.delete('/blocked-dates/:id', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("bloqued_dates")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Blocked date deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Experiences CRUD (bonifications, events, events_exclusive)
 */

// Bonifications
router.get('/bonifications', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_bonifications')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/bonifications', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const payload = { ...req.body, restaurant_id: restaurantId };
    const { data, error } = await supabase
      .from('experience_bonifications')
      .insert([payload])
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/bonifications/:id', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_bonifications')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/bonifications/:id', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { error } = await supabase
      .from('experience_bonifications')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Events
router.get('/events/list', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_events')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/events', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const payload = { ...req.body, restaurant_id: restaurantId };
    const { data, error } = await supabase
      .from('experience_events')
      .insert([payload])
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/events/:id', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_events')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/events/:id', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { error } = await supabase
      .from('experience_events')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Events Exclusive
router.get('/events-exclusive', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_events_exclusives')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/events-exclusive', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const payload = { ...req.body, restaurant_id: restaurantId };
    const { data, error } = await supabase
      .from('experience_events_exclusives')
      .insert([payload])
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/events-exclusive/:id', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_events_exclusives')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.delete('/events-exclusive/:id', authenticateToken, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { error } = await supabase
      .from('experience_events_exclusives')
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