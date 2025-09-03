import { Router } from 'express';
import { authenticate, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatContact:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         phone_number:
 *           type: string
 *         name:
 *           type: string
 *         profile_image_url:
 *           type: string
 *         status:
 *           type: string
 *           enum: [new, active, inactive]
 *         customer_type:
 *           type: string
 *           enum: [new, returning, vip]
 *         last_message_at:
 *           type: string
 *           format: date-time
 *         unread_count:
 *           type: number
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         notes:
 *           type: string
 *         thread_id:
 *           type: string
 *         ai_enable:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     ChatMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         sender_type:
 *           type: string
 *           enum: [customer, agent, ai]
 *         sender_id:
 *           type: string
 *           format: uuid
 *         content:
 *           type: string
 *         content_type:
 *           type: string
 *           enum: [text, image, audio, video, document]
 *         media_url:
 *           type: string
 *         is_read:
 *           type: boolean
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [sent, delivered, read, failed]
 *         intent:
 *           type: string
 *         sentiment:
 *           type: string
 *           enum: [positive, neutral, negative]
 *         ai_enabled:
 *           type: boolean
 *         assigned_to:
 *           type: string
 *           format: uuid
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     ChatAnalytics:
 *       type: object
 *       properties:
 *         total_conversations:
 *           type: number
 *         new_conversations:
 *           type: number
 *         ai_handled_conversations:
 *           type: number
 *         human_handled_conversations:
 *           type: number
 *         avg_response_time:
 *           type: number
 *         avg_resolution_time:
 *           type: number
 *         popular_topics:
 *           type: object
 */

/**
 * @swagger
 * /api/chat/contacts:
 *   get:
 *     summary: Get all chat contacts for current restaurant
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, active, inactive]
 *         description: Filter by contact status
 *       - in: query
 *         name: customer_type
 *         schema:
 *           type: string
 *           enum: [new, returning, vip]
 *         description: Filter by customer type
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
 *         description: List of chat contacts
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
 *                     $ref: '#/components/schemas/ChatContact'
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
router.get('/contacts', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { status, customer_type, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('chat_contacts')
      .select('*', { count: 'exact' })
      .eq('restaurant_id', restaurantId);

    if (status) {
      query = query.eq('status', status);
    }

    if (customer_type) {
      query = query.eq('customer_type', customer_type);
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { data, error, count } = await query
      .range(offset, offset + Number(limit) - 1)
      .order('last_message_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch contacts'
      });
    }

return res.json({
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
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/chat/contacts/{id}:
 *   get:
 *     summary: Get a specific chat contact
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Contact ID
 *     responses:
 *       200:
 *         description: Chat contact details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ChatContact'
 *       404:
 *         description: Contact not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/contacts/:id', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;

    const { data, error } = await supabase
      .from('chat_contacts')
      .select('*')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
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
 * /api/chat/contacts/{id}:
 *   put:
 *     summary: Update a chat contact
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Contact ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [new, active, inactive]
 *               customer_type:
 *                 type: string
 *                 enum: [new, returning, vip]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *               ai_enable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Contact updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ChatContact'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Contact not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.put('/contacts/:id', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const updateData = req.body;

    const { data, error } = await supabase
      .from('chat_contacts')
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
        error: 'Contact not found'
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
 * /api/chat/contacts/{id}/messages:
 *   get:
 *     summary: Get messages for a specific contact
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Contact ID
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
 *           default: 50
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: List of messages
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
 *                     $ref: '#/components/schemas/ChatMessage'
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
 *       404:
 *         description: Contact not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/contacts/:id/messages', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { page = 1, limit = 50 } = req.query;

    // First verify the contact exists
    const { data: contact, error: contactError } = await supabase
      .from('chat_contacts')
      .select('id')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (contactError || !contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { data, error, count } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .eq('sender_id', id)
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch messages'
      });
    }

return res.json({
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
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/chat/contacts/{id}/messages:
 *   post:
 *     summary: Send a message to a contact
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Contact ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content
 *               content_type:
 *                 type: string
 *                 enum: [text, image, audio, video, document]
 *                 default: text
 *               media_url:
 *                 type: string
 *                 description: URL to media file (if content_type is not text)
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Contact not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.post('/contacts/:id/messages', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { content, content_type = 'text', media_url } = req.body;

    // First verify the contact exists
    const { data: contact, error: contactError } = await supabase
      .from('chat_contacts')
      .select('id')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (contactError || !contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{
        restaurant_id: restaurantId,
        sender_id: req.user?.id,
        sender_type: 'agent',
        content,
        content_type,
        media_url,
        status: 'sent'
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
 * /api/chat/messages/{id}/read:
 *   patch:
 *     summary: Mark a message as read
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Message marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ChatMessage'
 *       404:
 *         description: Message not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.patch('/messages/:id/read', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;

    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        is_read: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
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
 * /api/chat/analytics:
 *   get:
 *     summary: Get chat analytics for current restaurant
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: "Date to get analytics for (default: today)"
 *     responses:
 *       200:
 *         description: Chat analytics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ChatAnalytics'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/analytics', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const date = req.query.date as string || new Date().toISOString().split('T')[0];

    // Get analytics data
    const { data: contacts, error: contactsError } = await supabase
      .from('chat_contacts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', date);

    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', date);

    if (contactsError || messagesError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics'
      });
    }

    const analytics = {
      total_conversations: contacts?.length || 0,
      new_conversations: contacts?.filter(c => c.customer_type === 'new').length || 0,
      ai_handled_conversations: messages?.filter(m => m.sender_type === 'ai').length || 0,
      human_handled_conversations: messages?.filter(m => m.sender_type === 'agent').length || 0,
      avg_response_time: 0, // Would need more complex calculation
      avg_resolution_time: 0, // Would need more complex calculation
      popular_topics: {} // Would need NLP analysis
    };

    return res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 