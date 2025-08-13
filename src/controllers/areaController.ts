import { Request, Response } from 'express';
import { AreaService } from '../services/areaService';

export class AreaController {
  /**
   * @swagger
   * /api/areas:
   *   get:
   *     summary: Get all areas for a restaurant
   *     tags: [Areas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: restaurantId
   *         schema:
   *           type: string
   *         required: true
   *         description: Restaurant ID
   *     responses:
   *       200:
   *         description: List of areas
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/RestaurantArea'
   */
  static async getAreas(req: Request, res: Response) {
    try {
      const { restaurantId } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Restaurant ID is required' 
        });
      }

      const areas = await AreaService.getAreasByRestaurant(restaurantId);
      
      // Adicionar headers para evitar cache
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      return res.json({
        success: true,
        data: areas
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
   * /api/areas/{id}:
   *   get:
   *     summary: Get a single area by ID
   *     tags: [Areas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Area ID
   *     responses:
   *       200:
   *         description: Area details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RestaurantArea'
   *       404:
   *         description: Area not found
   */
  static async getAreaById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ 
          success: false,
          error: 'Area ID is required' 
        });
      }

      const area = await AreaService.getAreaById(id);
      
      if (!area) {
        return res.status(404).json({ 
          success: false,
          error: 'Area not found' 
        });
      }

      // Adicionar headers para evitar cache
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      return res.json({
        success: true,
        data: area
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
   * /api/areas:
   *   post:
   *     summary: Create a new area
   *     tags: [Areas]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - restaurant_id
   *               - name
   *             properties:
   *               restaurant_id:
   *                 type: string
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               max_capacity:
   *                 type: number
   *               max_tables:
   *                 type: number
   *               is_active:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Area created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RestaurantArea'
   */
  static async createArea(req: Request, res: Response) {
    try {
      const areaData = req.body;
      
      if (!areaData.restaurant_id || !areaData.name) {
        return res.status(400).json({
          success: false,
          error: 'Restaurant ID and name are required'
        });
      }

      const area = await AreaService.createArea(areaData);
      
      // Adicionar headers para evitar cache
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      return res.status(201).json({
        success: true,
        data: area,
        message: 'Area created successfully'
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
   * /api/areas/{id}:
   *   put:
   *     summary: Update an area
   *     tags: [Areas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Area ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               max_capacity:
   *                 type: number
   *               max_tables:
   *                 type: number
   *               is_active:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Area updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RestaurantArea'
   *       404:
   *         description: Area not found
   */
  static async updateArea(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const areaData = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Area ID is required'
        });
      }

      const area = await AreaService.updateArea(id, areaData);
      
      // Adicionar headers para evitar cache
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      return res.json({
        success: true,
        data: area,
        message: 'Area updated successfully'
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
   * /api/areas/{id}:
   *   delete:
   *     summary: Delete an area
   *     tags: [Areas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Area ID
   *     responses:
   *       204:
   *         description: Area deleted successfully
   *       400:
   *         description: Cannot delete area with existing tables
   */
  static async deleteArea(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Area ID is required'
        });
      }

      await AreaService.deleteArea(id);
      
      return res.status(200).json({
        success: true,
        message: 'Area deleted successfully'
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot delete')) {
        return res.status(400).json({ 
          success: false,
          error: error.message 
        });
      }
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }

  /**
   * @swagger
   * /api/areas/reorder:
   *   post:
   *     summary: Reorder areas
   *     tags: [Areas]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - restaurantId
   *               - areaIds
   *             properties:
   *               restaurantId:
   *                 type: string
   *               areaIds:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Areas reordered successfully
   */
  static async reorderAreas(req: Request, res: Response) {
    try {
      const { restaurantId, areaIds } = req.body;
      
      if (!restaurantId || !areaIds || !Array.isArray(areaIds)) {
        return res.status(400).json({ 
          success: false,
          error: 'Restaurant ID and area IDs array are required' 
        });
      }

      await AreaService.reorderAreas(restaurantId, areaIds);
      
      return res.json({ 
        success: true,
        message: 'Areas reordered successfully' 
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
   * /api/areas/stats:
   *   get:
   *     summary: Get area statistics
   *     tags: [Areas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: restaurantId
   *         schema:
   *           type: string
   *         required: true
   *         description: Restaurant ID
   *     responses:
   *       200:
   *         description: Area statistics
   */
  static async getAreaStats(req: Request, res: Response) {
    try {
      const { restaurantId } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ 
          success: false,
          error: 'Restaurant ID is required' 
        });
      }

      const stats = await AreaService.getAreaStats(restaurantId);
      
      // Adicionar headers para evitar cache
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
} 