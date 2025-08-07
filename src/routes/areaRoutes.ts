import { Router } from 'express';
import { AreaController } from '../controllers/areaController';
import { AreaService } from '../services/areaService';
import { authenticateToken, requireRestaurant } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { areaSchema, areaUpdateSchema } from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     RestaurantArea:
 *       type: object
 *       required:
 *         - id
 *         - restaurant_id
 *         - name
 *         - is_active
 *         - max_tables
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         max_capacity:
 *           type: number
 *         max_tables:
 *           type: number
 *         is_active:
 *           type: boolean
 *         order:
 *           type: number
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Get all areas for a restaurant (using authenticated user's restaurant)
router.get('/my', requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID is required' 
      });
    }

    const areas = await AreaService.getAreasByRestaurant(restaurantId);
    return res.json({
      success: true,
      data: areas
    });
  } catch (error) {
    console.error('Error fetching areas:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// Get all areas for a restaurant
router.get('/', AreaController.getAreas);

// Get area statistics
router.get('/stats', AreaController.getAreaStats);

// Get a single area by ID
router.get('/:id', AreaController.getAreaById);

// Create a new area
router.post('/', validate(areaSchema), AreaController.createArea);

// Update an area
router.put('/:id', validate(areaUpdateSchema), AreaController.updateArea);

// Delete an area
router.delete('/:id', AreaController.deleteArea);

// Reorder areas
router.post('/reorder', AreaController.reorderAreas);

export default router; 