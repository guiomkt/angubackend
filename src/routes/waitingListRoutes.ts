import { Router } from 'express';
import { authenticateToken, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     WaitingList:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         restaurant_id: { type: string, format: uuid }
 *         customer_name: { type: string }
 *         phone_number: { type: string }
 *         party_size: { type: number }
 *         queue_number: { type: number }
 *         status: { type: string, enum: [waiting, notified, seated, no_show] }
 *         priority: { type: string, enum: [low, medium, high] }
 *         area_preference: { type: string, format: uuid }
 *         estimated_wait_time: { type: number }
 *         notification_time: { type: string, format: date-time }
 *         notes: { type: string }
 *         table_id: { type: string, format: uuid }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 */

/**
 * @swagger
 * /api/waiting-lists:
 *   get:
 *     summary: Get waiting list entries
 *     tags: [Waiting Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [waiting, notified, seated, no_show]
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by priority
 *     responses:
 *       200:
 *         description: List of waiting list entries
 */
router.get('/', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, priority } = req.query;
    const restaurantId = req.user?.restaurant_id;

    let query = supabase
      .from('waiting_list')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data, error } = await query;

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

/**
 * @swagger
 * /api/waiting-lists/{id}:
 *   get:
 *     summary: Get waiting list entry by ID
 *     tags: [Waiting Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Waiting list entry ID
 *     responses:
 *       200:
 *         description: Waiting list entry details
 */
router.get('/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('waiting_list')
      .select('*')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Waiting list entry not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/waiting-lists:
 *   post:
 *     summary: Add customer to waiting list
 *     tags: [Waiting Lists]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_name
 *               - phone_number
 *               - party_size
 *             properties:
 *               customer_name: { type: string }
 *               phone_number: { type: string }
 *               party_size: { type: number, minimum: 1 }
 *               priority: { type: string, enum: [low, medium, high], default: low }
 *               area_preference: { type: string, format: uuid }
 *               estimated_wait_time: { type: number }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Customer added to waiting list
 */
router.post('/', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { customer_name, phone_number, party_size, priority = 'low', area_preference, estimated_wait_time, notes } = req.body;

    if (!customer_name || !phone_number || !party_size) {
      return res.status(400).json({
        success: false,
        error: 'Customer name, phone number, and party size are required'
      });
    }

    // Get next queue number
    const { data: lastEntry } = await supabase
      .from('waiting_list')
      .select('queue_number')
      .eq('restaurant_id', restaurantId)
      .order('queue_number', { ascending: false })
      .limit(1);

    const nextQueueNumber = (lastEntry?.[0]?.queue_number || 0) + 1;

    const entryData = {
      restaurant_id: restaurantId,
      customer_name,
      phone_number,
      party_size,
      queue_number: nextQueueNumber,
      status: 'waiting',
      priority,
      area_preference,
      estimated_wait_time,
      notes
    };

    const { data, error } = await supabase
      .from('waiting_list')
      .insert(entryData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/waiting-lists/{id}:
 *   put:
 *     summary: Update waiting list entry
 *     tags: [Waiting Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Waiting list entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_name: { type: string }
 *               phone_number: { type: string }
 *               party_size: { type: number }
 *               priority: { type: string, enum: [low, medium, high] }
 *               area_preference: { type: string, format: uuid }
 *               estimated_wait_time: { type: number }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Waiting list entry updated
 */
router.put('/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { id } = req.params;
    const updateData = req.body;

    const { data, error } = await supabase
      .from('waiting_list')
      .update(updateData)
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/waiting-lists/{id}/status:
 *   patch:
 *     summary: Update waiting list entry status
 *     tags: [Waiting Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Waiting list entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status: { type: string, enum: [waiting, notified, seated, no_show] }
 *               table_id: { type: string, format: uuid }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.patch('/:id/status', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { id } = req.params;
    const { status, table_id, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const updateData: any = { status };
    if (table_id) updateData.table_id = table_id;
    if (notes) updateData.notes = notes;

    if (status === 'notified') {
      updateData.notification_time = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('waiting_list')
      .update(updateData)
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/waiting-lists/{id}:
 *   delete:
 *     summary: Remove customer from waiting list
 *     tags: [Waiting Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Waiting list entry ID
 *     responses:
 *       200:
 *         description: Customer removed from waiting list
 */
router.delete('/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('waiting_list')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      message: 'Customer removed from waiting list'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 