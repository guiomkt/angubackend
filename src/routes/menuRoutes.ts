import { Router } from 'express';
import { MenuController } from '../controllers/menuController';
import { authenticateToken } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { 
  menuCategorySchema, 
  menuCategoryUpdateSchema,
  menuItemSchema, 
  menuItemUpdateSchema 
} from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     MenuCategory:
 *       type: object
 *       required:
 *         - id
 *         - restaurant_id
 *         - name
 *         - is_active
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
 *         order:
 *           type: number
 *         is_active:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     MenuItem:
 *       type: object
 *       required:
 *         - id
 *         - restaurant_id
 *         - category_id
 *         - name
 *         - price
 *         - is_active
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *         category_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: number
 *         image_url:
 *           type: string
 *         is_active:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     MenuItemWithCategory:
 *       allOf:
 *         - $ref: '#/components/schemas/MenuItem'
 *         - type: object
 *           properties:
 *             category:
 *               $ref: '#/components/schemas/MenuCategory'
 */

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Categories routes
router.get('/categories', MenuController.getCategories);
router.get('/categories/:id', MenuController.getCategoryById);
router.post('/categories', validate(menuCategorySchema), MenuController.createCategory);
router.put('/categories/:id', validate(menuCategoryUpdateSchema), MenuController.updateCategory);
router.delete('/categories/:id', MenuController.deleteCategory);
router.post('/categories/reorder', MenuController.reorderCategories);

// Items routes
router.get('/items', MenuController.getItems);
router.get('/items/:id', MenuController.getItemById);
router.post('/items', validate(menuItemSchema), MenuController.createItem);
router.put('/items/:id', validate(menuItemUpdateSchema), MenuController.updateItem);
router.delete('/items/:id', MenuController.deleteItem);

// Complete menu and stats
router.get('/complete', MenuController.getCompleteMenu);
router.get('/search', MenuController.searchItems);
router.get('/stats', MenuController.getMenuStats);

// Bulk operations
router.delete('/categories/restaurant/:restaurantId', MenuController.deleteAllCategoriesByRestaurant);
router.delete('/items/restaurant/:restaurantId', MenuController.deleteAllItemsByRestaurant);

export default router; 