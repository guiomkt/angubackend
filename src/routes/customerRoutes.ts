import { Router } from 'express';
import { authenticateToken, requireRestaurant } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         customer_name:
 *           type: string
 *         phone:
 *           type: string
 *         number_of_people:
 *           type: number
 *         reservation_date:
 *           type: string
 *           format: date
 *         start_time:
 *           type: string
 *         status:
 *           type: string
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         created_at:
 *           type: string
 *           format: date-time
 *     CustomerStats:
 *       type: object
 *       properties:
 *         total_customers:
 *           type: number
 *         new_customers:
 *           type: number
 *         returning_customers:
 *           type: number
 *         average_party_size:
 *           type: number
 */

/**
 * @swagger
 * /api/customers/today:
 *   get:
 *     summary: Get today's customers for current restaurant
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to filter customers (default: today)
 *     responses:
 *       200:
 *         description: Today's customers
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
 *                     $ref: '#/components/schemas/Customer'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/today', authenticateToken, requireRestaurant, async (req, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const date = req.query.date as string || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('reservation_date', date);

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch customers'
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
 * /api/customers/yesterday:
 *   get:
 *     summary: Get yesterday's customers for current restaurant
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (default: yesterday)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (default: today)
 *     responses:
 *       200:
 *         description: Yesterday's customers
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
 *                     $ref: '#/components/schemas/Customer'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
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