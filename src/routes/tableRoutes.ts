import { Router } from 'express';
import { TableController } from '../controllers/tableController';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { 
  tableSchema, 
  tableUpdateSchema, 
  tableStatusSchema, 
  tablePositionSchema 
} from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Table:
 *       type: object
 *       required:
 *         - id
 *         - restaurant_id
 *         - area_id
 *         - number
 *         - capacity
 *         - status
 *         - is_active
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
 *         number:
 *           type: number
 *         name:
 *           type: string
 *         capacity:
 *           type: number
 *         shape:
 *           type: string
 *           enum: [round, square, rectangle]
 *         width:
 *           type: number
 *         height:
 *           type: number
 *         position_x:
 *           type: number
 *         position_y:
 *           type: number
 *         status:
 *           type: string
 *           enum: [available, occupied, reserved, blocked]
 *         is_active:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     TableWithArea:
 *       allOf:
 *         - $ref: '#/components/schemas/Table'
 *         - type: object
 *           properties:
 *             area:
 *               $ref: '#/components/schemas/RestaurantArea'
 *     TableStatusHistory:
 *       type: object
 *       required:
 *         - id
 *         - table_id
 *         - previous_status
 *         - new_status
 *         - changed_at
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         table_id:
 *           type: string
 *           format: uuid
 *         previous_status:
 *           type: string
 *         new_status:
 *           type: string
 *         changed_by:
 *           type: string
 *         notes:
 *           type: string
 *         changed_at:
 *           type: string
 *           format: date-time
 */

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all tables for a restaurant
router.get('/', TableController.getTables);

// Get table statistics
router.get('/stats', TableController.getTableStats);

// Get occupied tables for a restaurant
router.get('/occupied', TableController.getOccupiedTables);

// Get weekly occupancy data for a restaurant
router.get('/weekly-occupancy', TableController.getWeeklyOccupancy);

// Get a single table by ID
router.get('/:id', TableController.getTableById);

// Get table status history
router.get('/:id/history', TableController.getTableStatusHistory);

// Create a new table
router.post('/', validate(tableSchema), TableController.createTable);

// Update a table
router.put('/:id', validate(tableUpdateSchema), TableController.updateTable);

// Delete a table
router.delete('/:id', TableController.deleteTable);

// Change table status
router.patch('/:id/status', validate(tableStatusSchema), TableController.changeTableStatus);

// Update table position
router.patch('/:id/position', validate(tablePositionSchema), TableController.updateTablePosition);

export default router; 