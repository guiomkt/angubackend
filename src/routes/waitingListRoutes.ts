import { Router } from 'express';
import { authenticateToken, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     WaitingListEntry:
 *       type: object
 *       required:
 *         - restaurant_id
 *         - customer_name
 *         - phone_number
 *         - party_size
 *         - queue_number
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         customer_name:
 *           type: string
 *         phone_number:
 *           type: string
 *         party_size:
 *           type: number
 *           minimum: 1
 *         queue_number:
 *           type: number
 *         status:
 *           type: string
 *           enum: [waiting, notified, seated, no_show, completed]
 *         priority:
 *           type: string
 *           enum: [low, medium, high]
 *           default: low
 *         area_preference:
 *           type: string
 *           format: uuid
 *         estimated_wait_time:
 *           type: number
 *         notification_time:
 *           type: string
 *           format: date-time
 *         notes:
 *           type: string
 *         table_id:
 *           type: string
 *           format: uuid
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     WaitingListConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         auto_notification:
 *           type: boolean
 *           default: true
 *         notification_message:
 *           type: string
 *         default_wait_time:
 *           type: number
 *           default: 15
 *         max_party_size:
 *           type: number
 *           default: 20
 *         enable_customer_form:
 *           type: boolean
 *           default: true
 *         customer_form_url:
 *           type: string
 *         priority_enabled:
 *           type: boolean
 *           default: true
 *         collect_phone:
 *           type: boolean
 *           default: true
 *         collect_email:
 *           type: boolean
 *           default: false
 *         confirmation_message:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/waiting-lists:
 *   get:
 *     summary: Get all waiting list entries for current restaurant
 *     tags: [Waiting List]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [waiting, notified, seated, no_show, completed]
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by priority
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of waiting list entries
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
 *                     $ref: '#/components/schemas/WaitingListEntry'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { status, priority, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('waiting_list')
      .select('*', { count: 'exact' })
      .eq('restaurant_id', restaurantId);

    if (status) {
      query = query.eq('status', status);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { data, error, count } = await query
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch waiting list'
      });
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / Number(limit))
      }
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
 *     summary: Get a specific waiting list entry
 *     tags: [Waiting List]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WaitingListEntry'
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;

    const { data, error } = await supabase
      .from('waiting_list')
      .select('*')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Entry not found'
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
 *     summary: Add a new customer to the waiting list
 *     tags: [Waiting List]
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
 *               customer_name:
 *                 type: string
 *                 description: Customer name
 *               phone_number:
 *                 type: string
 *                 description: Customer phone number
 *               party_size:
 *                 type: number
 *                 minimum: 1
 *                 description: Number of people in the party
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: low
 *                 description: Priority level
 *               area_preference:
 *                 type: string
 *                 format: uuid
 *                 description: Preferred area ID
 *               estimated_wait_time:
 *                 type: number
 *                 description: Estimated wait time in minutes
 *               notes:
 *                 type: string
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Customer added to waiting list successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WaitingListEntry'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.post('/', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const {
      customer_name,
      phone_number,
      party_size,
      priority = 'low',
      area_preference,
      estimated_wait_time,
      notes
    } = req.body;

    // Get the next queue number
    const { data: lastEntry, error: countError } = await supabase
      .from('waiting_list')
      .select('queue_number')
      .eq('restaurant_id', restaurantId)
      .order('queue_number', { ascending: false })
      .limit(1)
      .single();

    const queueNumber = lastEntry ? lastEntry.queue_number + 1 : 1;

    const { data, error } = await supabase
      .from('waiting_list')
      .insert([{
        restaurant_id: restaurantId,
        customer_name,
        phone_number,
        party_size,
        queue_number: queueNumber,
        status: 'waiting',
        priority,
        area_preference,
        estimated_wait_time,
        notes
      }])
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
 *     summary: Update a waiting list entry
 *     tags: [Waiting List]
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
 *               customer_name:
 *                 type: string
 *               phone_number:
 *                 type: string
 *               party_size:
 *                 type: number
 *                 minimum: 1
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               area_preference:
 *                 type: string
 *                 format: uuid
 *               estimated_wait_time:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Entry updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WaitingListEntry'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.put('/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const updateData = req.body;

    const { data, error } = await supabase
      .from('waiting_list')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Entry not found'
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
 *     summary: Update the status of a waiting list entry
 *     tags: [Waiting List]
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
 *               status:
 *                 type: string
 *                 enum: [waiting, notified, seated, no_show, completed]
 *                 description: New status for the entry
 *               table_id:
 *                 type: string
 *                 format: uuid
 *                 description: Table ID when seating the customer
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WaitingListEntry'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Entry not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.patch('/:id/status', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { status, table_id } = req.body;

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'seated' && table_id) {
      updateData.table_id = table_id;
    }

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

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Entry not found'
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
 *     summary: Remove a customer from the waiting list
 *     tags: [Waiting List]
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
 *         description: Customer removed from waiting list successfully
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
 *         description: Entry not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.delete('/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;

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
      message: 'Customer removed from waiting list successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Waiting List Config endpoints
 */
router.get('/config', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('waiting_list_config')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({ success: true, data: data || null });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/config', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const payload = { ...req.body, restaurant_id: restaurantId };

    // Upsert by restaurant_id
    const { data: existing, error: selError } = await supabase
      .from('waiting_list_config')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (selError) {
      return res.status(400).json({ success: false, error: selError.message });
    }

    let result;
    if (existing?.id) {
      const { data, error } = await supabase
        .from('waiting_list_config')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) return res.status(400).json({ success: false, error: error.message });
      result = data;
    } else {
      const { data, error } = await supabase
        .from('waiting_list_config')
        .insert([payload])
        .select('*')
        .single();
      if (error) return res.status(400).json({ success: false, error: error.message });
      result = data;
    }

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router; 