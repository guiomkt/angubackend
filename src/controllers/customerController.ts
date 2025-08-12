import { Request, Response } from 'express';
import { CustomerService } from '../services/customerService';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomerFilters } from '../types';
import { supabase } from '../config/database';

export class CustomerController {
  /**
   * @swagger
   * /api/customers:
   *   get:
   *     summary: Get all customers for a restaurant with pagination and filters
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
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
   *         description: Items per page
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term for name or phone
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [new, active, inactive]
   *         description: Filter by status
   *       - in: query
   *         name: customer_type
   *         schema:
   *           type: string
   *           enum: [new, returning, vip]
   *         description: Filter by customer type
   *     responses:
   *       200:
   *         description: List of customers with pagination
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
   *       500:
   *         description: Internal server error
   */
  static async getCustomers(req: AuthenticatedRequest, res: Response) {
    try {
      const restaurantId = req.user?.restaurant_id;
      if (!restaurantId) {
        return res.status(401).json({
          success: false,
          error: 'Restaurant ID not found'
        });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Parse filters from query params
      const filters: CustomerFilters = {};
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.customer_type) filters.customer_type = req.query.customer_type as string;

      const result = await CustomerService.getCustomers(restaurantId, page, limit, filters);
      
      return res.json({
        success: true,
        data: result.customers,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Error getting customers:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/customers/{id}:
   *   get:
   *     summary: Get a customer by ID
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Customer ID
   *     responses:
   *       200:
   *         description: Customer details
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
   *         description: Customer not found
   */
  static async getCustomerById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const customer = await CustomerService.getCustomerById(id);
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      return res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/customers:
   *   post:
   *     summary: Create a new customer
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - phone_number
   *             properties:
   *               name:
   *                 type: string
   *                 description: Customer name
   *               phone_number:
   *                 type: string
   *                 description: Customer phone number
   *               profile_image_url:
   *                 type: string
   *                 description: URL of customer profile image
   *               status:
   *                 type: string
   *                 enum: [new, active, inactive]
   *                 default: new
   *                 description: Customer status
   *               customer_type:
   *                 type: string
   *                 enum: [new, returning, vip]
   *                 default: new
   *                 description: Customer type
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Customer tags
   *               notes:
   *                 type: string
   *                 description: Additional notes about the customer
   *               ai_enable:
   *                 type: boolean
   *                 default: true
   *                 description: Whether AI is enabled for this customer
   *     responses:
   *       201:
   *         description: Customer created successfully
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
   *       409:
   *         description: Customer already exists
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  static async createCustomer(req: AuthenticatedRequest, res: Response) {
    try {
      const restaurantId = req.user?.restaurant_id;
      if (!restaurantId) {
        return res.status(401).json({
          success: false,
          error: 'Restaurant ID not found'
        });
      }

      // Validação apenas dos campos obrigatórios
      const { name, phone_number } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Nome é obrigatório'
        });
      }

      if (!phone_number || !phone_number.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Telefone é obrigatório'
        });
      }

      // Sanitização dos dados - apenas nome e telefone são obrigatórios
      const customerData = {
        name: name.trim(),
        phone_number: phone_number.trim(),
        restaurant_id: restaurantId,
        
        // Campos opcionais - podem ser undefined/null
        profile_image_url: req.body.profile_image_url || null,
        status: req.body.status || 'new',
        customer_type: req.body.customer_type || 'new',
        tags: Array.isArray(req.body.tags) ? req.body.tags : [],
        notes: req.body.notes || null,
        ai_enable: req.body.ai_enable !== undefined ? req.body.ai_enable : true
      };

      const customer = await CustomerService.createCustomer(customerData);
      
      return res.status(201).json({
        success: true,
        data: customer
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: error.message
        });
      }
      
      console.error('Error creating customer:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/customers/{id}:
   *   put:
   *     summary: Update a customer
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Customer ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 description: Customer name
   *               phone_number:
   *                 type: string
   *                 description: Customer phone number
   *               profile_image_url:
   *                 type: string
   *                 nullable: true
   *                 description: Customer profile image URL
   *               status:
   *                 type: string
   *                 enum: [new, active, inactive]
   *                 description: Customer status
   *               customer_type:
   *                 type: string
   *                 enum: [new, returning, vip]
   *                 description: Customer type
   *               tags:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Customer tags
   *               notes:
   *                 type: string
   *                 nullable: true
   *                 description: Customer notes
   *               ai_enable:
   *                 type: boolean
   *                 description: Whether AI is enabled for this customer
   *     responses:
   *       200:
   *         description: Customer updated successfully
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
   *         description: Customer not found
   *       500:
   *         description: Internal server error
   */
  static async updateCustomer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const customer = await CustomerService.updateCustomer(id, updateData);
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      return res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      console.error('🔄 Update customer - Error:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/customers/{id}:
   *   delete:
   *     summary: Delete a customer
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Customer ID
   *     responses:
   *       204:
   *         description: Customer deleted successfully
   *       404:
   *         description: Customer not found
   */
  static async deleteCustomer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const deleted = await CustomerService.deleteCustomer(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting customer:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/customers/{id}/status:
   *   patch:
   *     summary: Update customer status
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Customer ID
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
   *                 enum: [new, active, inactive]
   *     responses:
   *       200:
   *         description: Customer status updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/ChatContact'
   */
  static async updateCustomerStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      const customer = await CustomerService.updateCustomerStatus(id, status);
      
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      return res.json({
        success: true,
        data: customer
      });
    } catch (error) {
      console.error('Error updating customer status:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/customers/stats:
   *   get:
   *     summary: Get customer statistics
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Customer statistics
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     total_customers:
   *                       type: number
   *                     new_customers:
   *                       type: number
   *                     active_customers:
   *                       type: number
   *                     inactive_customers:
   *                       type: number
   *                     vip_customers:
   *                       type: number
   *                     returning_customers:
   *                       type: number
   */
  static async getCustomerStats(req: AuthenticatedRequest, res: Response) {
    try {
      const restaurantId = req.user?.restaurant_id;
      if (!restaurantId) {
        return res.status(401).json({
          success: false,
          error: 'Restaurant ID not found'
        });
      }

      const stats = await CustomerService.getCustomerStats(restaurantId);
      
      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting customer stats:', error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * @swagger
   * /api/customers/today:
   *   get:
   *     summary: Get customers created today
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: date
   *         schema:
   *           type: string
   *           format: date
   *         description: Date to filter (defaults to today)
   *     responses:
   *       200:
   *         description: List of customer IDs created today
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
   *                     type: string
   *                     format: uuid
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  static async getTodayCustomers(req: AuthenticatedRequest, res: Response) {
    try {
      const restaurantId = req.user?.restaurant_id;
      const { date } = req.query;
      const from = typeof date === 'string' ? date : new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('chat_contacts')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', from);

      if (error) return res.status(400).json({ success: false, error: error.message });
      res.json({ success: true, data: data || [] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/customers/yesterday:
   *   get:
   *     summary: Get customers created yesterday
   *     tags: [Customers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: from
   *         schema:
   *           type: string
   *           format: date
   *         required: true
   *         description: Start date (yesterday)
   *       - in: query
   *         name: to
   *         schema:
   *           type: string
   *           format: date
   *         required: true
   *         description: End date (today)
   *     responses:
   *       200:
   *         description: List of customer IDs created yesterday
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
   *                     type: string
   *                     format: uuid
   *       401:
   *         description: Unauthorized
   *       500:
   *         description: Internal server error
   */
  static async getYesterdayCustomers(req: AuthenticatedRequest, res: Response) {
    try {
      const restaurantId = req.user?.restaurant_id;
      const { from, to } = req.query;

      const { data, error } = await supabase
        .from('chat_contacts')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', String(from))
        .lt('created_at', String(to));

      if (error) return res.status(400).json({ success: false, error: error.message });
      res.json({ success: true, data: data || [] });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
} 