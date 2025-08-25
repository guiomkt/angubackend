import { Router } from 'express';
import { MenuService } from '../services/menuService';
import { Request, Response } from 'express';

const router = Router();

/**
 * @swagger
 * /api/public/menu/categories:
 *   get:
 *     summary: Get all active menu categories for a restaurant (public access)
 *     tags: [Public Menu]
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: List of active menu categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MenuCategory'
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.query;
    
    if (!restaurantId || typeof restaurantId !== 'string') {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    const categories = await MenuService.getCategoriesByRestaurant(restaurantId);
    // Filter only active categories for public access
    const activeCategories = categories.filter(cat => cat.is_active);
    return res.json(activeCategories);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/public/menu/items:
 *   get:
 *     summary: Get all active menu items for a restaurant (public access)
 *     tags: [Public Menu]
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Restaurant ID
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *     responses:
 *       200:
 *         description: List of active menu items with category information
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MenuItemWithCategory'
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const { restaurantId, categoryId } = req.query;
    
    if (!restaurantId || typeof restaurantId !== 'string') {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    let items;
    if (categoryId && typeof categoryId === 'string') {
      items = await MenuService.getItemsByCategory(categoryId);
    } else {
      items = await MenuService.getItemsByRestaurant(restaurantId);
    }

    // Filter only active items for public access
    const activeItems = items.filter(item => item.is_active);
    return res.json(activeItems);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/public/menu/complete:
 *   get:
 *     summary: Get complete menu with categories and items (public access)
 *     tags: [Public Menu]
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema:
 *           type: string
 *         required: true
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Complete menu structure with only active items
 */
router.get('/complete', async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.query;
    
    if (!restaurantId || typeof restaurantId !== 'string') {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    const menu = await MenuService.getCompleteMenu(restaurantId);
    
    // Filter only active categories and items for public access
    const activeMenu = menu
      .filter((category: any) => category.is_active)
      .map((category: any) => ({
        ...category,
        items: category.items.filter((item: any) => item.is_active)
      }));
      
    return res.json(activeMenu);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

export default router; 