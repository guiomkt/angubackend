import { Router } from 'express';
import { authenticateToken, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatContact:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         restaurant_id: { type: string, format: uuid }
 *         phone_number: { type: string }
 *         name: { type: string }
 *         profile_image_url: { type: string }
 *         status: { type: string, enum: [new, active, inactive] }
 *         customer_type: { type: string, enum: [new, returning, vip] }
 *         last_message_at: { type: string, format: date-time }
 *         unread_count: { type: number }
 *         tags: { type: array, items: { type: string } }
 *         notes: { type: string }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     ChatMessage:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         sender_type: { type: string, enum: [customer, restaurant, ai] }
 *         sender_id: { type: string }
 *         content: { type: string }
 *         content_type: { type: string, enum: [text, image, file, location, contact] }
 *         media_url: { type: string }
 *         is_read: { type: boolean }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 */

/**
 * @swagger
 * /api/chat/contacts:
 *   get:
 *     summary: Get chat contacts
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or phone number
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
 */
router.get('/contacts', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { status, search, page = 1, limit = 20 } = req.query;

    let query = supabase
      .from('chat_contacts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('last_message_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    query = query.range(offset, offset + parseInt(limit as string) - 1);

    const { data, error, count } = await query;

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit as string))
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
 * /api/chat/contacts/{id}:
 *   get:
 *     summary: Get chat contact by ID
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
 */
router.get('/contacts/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('chat_contacts')
      .select('*')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
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
 * /api/chat/contacts/{id}:
 *   put:
 *     summary: Update chat contact
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
 *               name: { type: string }
 *               status: { type: string, enum: [new, active, inactive] }
 *               customer_type: { type: string, enum: [new, returning, vip] }
 *               tags: { type: array, items: { type: string } }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Contact updated successfully
 */
router.put('/contacts/:id', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { id } = req.params;
    const updateData = req.body;

    const { data, error } = await supabase
      .from('chat_contacts')
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
 * /api/chat/contacts/{id}/messages:
 *   get:
 *     summary: Get messages for a contact
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
 */
router.get('/contacts/:id/messages', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { data, error, count } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count || 0,
        totalPages: Math.ceil((count || 0) / parseInt(limit as string))
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
 *               content: { type: string }
 *               content_type: { type: string, enum: [text, image, file, location, contact], default: text }
 *               media_url: { type: string }
 *     responses:
 *       201:
 *         description: Message sent successfully
 */
router.post('/contacts/:id/messages', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { id } = req.params;
    const { content, content_type = 'text', media_url } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    const messageData = {
      restaurant_id: restaurantId,
      contact_id: id,
      sender_type: 'restaurant',
      sender_id: req.user?.id,
      content,
      content_type,
      media_url,
      is_read: false
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Update contact's last_message_at
    await supabase
      .from('chat_contacts')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', id);

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
 * /api/chat/messages/{id}/read:
 *   patch:
 *     summary: Mark message as read
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
 */
router.patch('/messages/:id/read', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
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
 * /api/chat/analytics:
 *   get:
 *     summary: Get chat analytics
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: week
 *         description: Time period for analytics
 *     responses:
 *       200:
 *         description: Chat analytics
 */
router.get('/analytics', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const period = req.query.period as string || 'week';

    let startDate: string;
    const endDate = new Date().toISOString();

    switch (period) {
      case 'day':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'week':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'month':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const [
      totalContacts,
      newContacts,
      totalMessages,
      messagesByType,
      responseTime
    ] = await Promise.all([
      // Total de contatos
      supabase
        .from('chat_contacts')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId),

      // Novos contatos no período
      supabase
        .from('chat_contacts')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate),

      // Total de mensagens no período
      supabase
        .from('chat_messages')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate),

      // Mensagens por tipo de remetente
      supabase
        .from('chat_messages')
        .select('sender_type')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate),

      // Tempo médio de resposta (últimas 100 mensagens)
      supabase
        .from('chat_messages')
        .select('created_at, sender_type')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(100)
    ]);

    // Calcular estatísticas
    const messagesByTypeCounts = messagesByType.data?.reduce((acc, msg) => {
      acc[msg.sender_type] = (acc[msg.sender_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Calcular tempo médio de resposta
    let avgResponseTime = 0;
    if (responseTime.data && responseTime.data.length > 1) {
      const responseTimes: number[] = [];
      for (let i = 1; i < responseTime.data.length; i++) {
        const current = responseTime.data[i];
        const previous = responseTime.data[i - 1];
        
        if (current.sender_type === 'restaurant' && previous.sender_type === 'customer') {
          const timeDiff = new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
          responseTimes.push(timeDiff);
        }
      }
      
      if (responseTimes.length > 0) {
        avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      }
    }

    const analytics = {
      period,
      contacts: {
        total: totalContacts.count || 0,
        new: newContacts.count || 0
      },
      messages: {
        total: totalMessages.count || 0,
        byType: messagesByTypeCounts
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime / 1000), // em segundos
        responseRate: totalMessages.count ? 
          ((messagesByTypeCounts.restaurant || 0) / totalMessages.count) * 100 : 0
      }
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 