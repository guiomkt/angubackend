import { Request, Response } from 'express';
import { TableService } from '../services/tableService';

export class TableController {
  /**
   * @swagger
   * /api/tables:
   *   get:
   *     summary: Get all tables for a restaurant
   *     tags: [Tables]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: restaurantId
   *         schema:
   *           type: string
   *         required: true
   *         description: Restaurant ID
   *       - in: query
   *         name: areaId
   *         schema:
   *           type: string
   *         description: Filter by area ID
   *     responses:
   *       200:
   *         description: List of tables with area information
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TableWithArea'
   */
  static async getTables(req: Request, res: Response) {
    try {
      const { restaurantId, areaId } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Restaurant ID is required' 
        });
      }

      let tables;
      if (areaId && typeof areaId === 'string') {
        tables = await TableService.getTablesByArea(areaId);
      } else {
        tables = await TableService.getTablesByRestaurant(restaurantId);
      }
      
      return res.json({
        success: true,
        data: tables
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
   * /api/tables/{id}:
   *   get:
   *     summary: Get a single table by ID
   *     tags: [Tables]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Table ID
   *     responses:
   *       200:
   *         description: Table details with area information
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TableWithArea'
   *       404:
   *         description: Table not found
   */
  static async getTableById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const table = await TableService.getTableById(id);
      
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }

      return res.json(table);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/tables:
   *   post:
   *     summary: Create a new table
   *     tags: [Tables]
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
   *               - area_id
   *               - capacity
   *             properties:
   *               restaurant_id:
   *                 type: string
   *               area_id:
   *                 type: string
   *               name:
   *                 type: string
   *               capacity:
   *                 type: number
   *               shape:
   *                 type: string
   *                 enum: [round, square, rectangle]
   *               width:
   *                 type: number
   *               height:
   *                 type: number
   *               position_x:
   *                 type: number
   *               position_y:
   *                 type: number
   *               status:
   *                 type: string
   *                 enum: [available, occupied, reserved, blocked]
   *               is_active:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Table created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TableWithArea'
   */
  static async createTable(req: Request, res: Response) {
    try {
      const tableData = req.body;
      const table = await TableService.createTable(tableData);
      
      res.status(201).json({
        success: true,
        data: table
      });
    } catch (error) {
      res.status(400).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }

  /**
   * @swagger
   * /api/tables/{id}:
   *   put:
   *     summary: Update a table
   *     tags: [Tables]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Table ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               capacity:
   *                 type: number
   *               shape:
   *                 type: string
   *                 enum: [round, square, rectangle]
   *               width:
   *                 type: number
   *               height:
   *                 type: number
   *               position_x:
   *                 type: number
   *               position_y:
   *                 type: number
   *               status:
   *                 type: string
   *                 enum: [available, occupied, reserved, blocked]
   *               is_active:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Table updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TableWithArea'
   *       404:
   *         description: Table not found
   */
  static async updateTable(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tableData = req.body;
      
      const table = await TableService.updateTable(id, tableData);
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/tables/{id}:
   *   delete:
   *     summary: Delete a table
   *     tags: [Tables]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Table ID
   *     responses:
   *       204:
   *         description: Table deleted successfully
   *       400:
   *         description: Cannot delete table with active reservations
   */
  static async deleteTable(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await TableService.deleteTable(id);
      return res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot delete')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/tables/{id}/status:
   *   patch:
   *     summary: Change table status
   *     tags: [Tables]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Table ID
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
   *                 enum: [available, occupied, reserved, blocked]
   *               notes:
   *                 type: string
   *               changedBy:
   *                 type: string
   *     responses:
   *       200:
   *         description: Table status changed successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TableWithArea'
   */
  static async changeTableStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['available', 'occupied', 'reserved', 'maintenance'].includes(status)) {
        return res.status(400).json({ error: 'Valid status is required' });
      }

      const table = await TableService.changeTableStatus(id, status);
      return res.json(table);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/tables/{id}/position:
   *   patch:
   *     summary: Update table position
   *     tags: [Tables]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Table ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - positionX
   *               - positionY
   *             properties:
   *               positionX:
   *                 type: number
   *               positionY:
   *                 type: number
   *     responses:
   *       200:
   *         description: Table position updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TableWithArea'
   */
  static async updateTablePosition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { x, y } = req.body;
      
      if (typeof x !== 'number' || typeof y !== 'number') {
        return res.status(400).json({ error: 'X and Y coordinates are required' });
      }

      const table = await TableService.updateTablePosition(id, x, y);
      return res.json(table);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/tables/stats:
   *   get:
   *     summary: Get table statistics
   *     tags: [Tables]
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
   *         description: Table statistics
   */
  static async getTableStats(req: Request, res: Response) {
    try {
      const { restaurantId } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ error: 'Restaurant ID is required' });
      }

      const stats = await TableService.getTableStats(restaurantId);
      return res.json(stats);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/tables/{id}/history:
   *   get:
   *     summary: Get table status history
   *     tags: [Tables]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Table ID
   *     responses:
   *       200:
   *         description: Table status history
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TableStatusHistory'
   */
  static async getTableStatusHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const history = await TableService.getTableStatusHistory(id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/tables/occupied:
   *   get:
   *     summary: Get occupied tables for a restaurant
   *     tags: [Tables]
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
   *         description: List of occupied tables
   */
  static async getOccupiedTables(req: Request, res: Response) {
    try {
      const { restaurantId } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Restaurant ID is required' 
        });
      }

      const tables = await TableService.getOccupiedTables(restaurantId);
      return res.json({
        success: true,
        data: tables
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
   * /api/tables/weekly-occupancy:
   *   get:
   *     summary: Get weekly occupancy data for a restaurant
   *     tags: [Tables]
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
   *         description: Weekly occupancy data
   */
  static async getWeeklyOccupancy(req: Request, res: Response) {
    try {
      const { restaurantId } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Restaurant ID is required' 
        });
      }

      const occupancy = await TableService.getWeeklyOccupancy(restaurantId);
      return res.json({
        success: true,
        data: occupancy
      });
    } catch (error) {
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  }
} 