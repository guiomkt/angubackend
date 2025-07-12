import { Request, Response } from 'express';
import { MenuService } from '../services/menuService';

export class MenuController {
  /**
   * @swagger
   * /api/menu/categories:
   *   get:
   *     summary: Get all menu categories for a restaurant
   *     tags: [Menu]
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
   *         description: List of menu categories
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/MenuCategory'
   */
  static async getCategories(req: Request, res: Response) {
    try {
      const { restaurantId } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ error: 'Restaurant ID is required' });
      }

      const categories = await MenuService.getCategoriesByRestaurant(restaurantId);
      return res.json(categories);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/categories/{id}:
   *   get:
   *     summary: Get a single menu category by ID
   *     tags: [Menu]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Category ID
   *     responses:
   *       200:
   *         description: Category details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MenuCategory'
   *       404:
   *         description: Category not found
   */
  static async getCategoryById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const category = await MenuService.getCategoryById(id);
      
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      return res.json(category);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/categories:
   *   post:
   *     summary: Create a new menu category
   *     tags: [Menu]
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
   *               is_active:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Category created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MenuCategory'
   */
  static async createCategory(req: Request, res: Response) {
    try {
      const categoryData = req.body;
      const category = await MenuService.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/categories/{id}:
   *   put:
   *     summary: Update a menu category
   *     tags: [Menu]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Category ID
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
   *               is_active:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Category updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MenuCategory'
   *       404:
   *         description: Category not found
   */
  static async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const categoryData = req.body;
      
      const category = await MenuService.updateCategory(id, categoryData);
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/categories/{id}:
   *   delete:
   *     summary: Delete a menu category
   *     tags: [Menu]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Category ID
   *     responses:
   *       204:
   *         description: Category deleted successfully
   *       400:
   *         description: Cannot delete category with existing items
   */
  static async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await MenuService.deleteCategory(id);
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
   * /api/menu/categories/reorder:
   *   post:
   *     summary: Reorder menu categories
   *     tags: [Menu]
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
   *               - categoryIds
   *             properties:
   *               restaurantId:
   *                 type: string
   *               categoryIds:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Categories reordered successfully
   */
  static async reorderCategories(req: Request, res: Response) {
    try {
      const { restaurantId, categoryIds } = req.body;
      
      if (!restaurantId || !categoryIds || !Array.isArray(categoryIds)) {
        return res.status(400).json({ error: 'Restaurant ID and category IDs array are required' });
      }

      await MenuService.reorderCategories(restaurantId, categoryIds);
      return res.json({ message: 'Categories reordered successfully' });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/items:
   *   get:
   *     summary: Get all menu items for a restaurant
   *     tags: [Menu]
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
   *         name: categoryId
   *         schema:
   *           type: string
   *         description: Filter by category ID
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term for items
   *     responses:
   *       200:
   *         description: List of menu items with category information
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/MenuItemWithCategory'
   */
  static async getItems(req: Request, res: Response) {
    try {
      const { restaurantId, categoryId, search } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ error: 'Restaurant ID is required' });
      }

      let items;
      if (search && typeof search === 'string') {
        items = await MenuService.searchItems(restaurantId, search);
      } else if (categoryId && typeof categoryId === 'string') {
        items = await MenuService.getItemsByCategory(categoryId);
      } else {
        items = await MenuService.getItemsByRestaurant(restaurantId);
      }

      return res.json(items);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/items/{id}:
   *   get:
   *     summary: Get a single menu item by ID
   *     tags: [Menu]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Item ID
   *     responses:
   *       200:
   *         description: Item details with category information
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MenuItemWithCategory'
   *       404:
   *         description: Item not found
   */
  static async getItemById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const item = await MenuService.getItemById(id);
      
      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      return res.json(item);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/items:
   *   post:
   *     summary: Create a new menu item
   *     tags: [Menu]
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
   *               - category_id
   *               - name
   *               - price
   *             properties:
   *               restaurant_id:
   *                 type: string
   *               category_id:
   *                 type: string
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               price:
   *                 type: number
   *               image_url:
   *                 type: string
   *               is_active:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Item created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MenuItemWithCategory'
   */
  static async createItem(req: Request, res: Response) {
    try {
      const itemData = req.body;
      const item = await MenuService.createItem(itemData);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/items/{id}:
   *   put:
   *     summary: Update a menu item
   *     tags: [Menu]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Item ID
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
   *               price:
   *                 type: number
   *               image_url:
   *                 type: string
   *               is_active:
   *                 type: boolean
   *               category_id:
   *                 type: string
   *     responses:
   *       200:
   *         description: Item updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/MenuItemWithCategory'
   *       404:
   *         description: Item not found
   */
  static async updateItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const itemData = req.body;
      
      const item = await MenuService.updateItem(id, itemData);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/items/{id}:
   *   delete:
   *     summary: Delete a menu item
   *     tags: [Menu]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Item ID
   *     responses:
   *       204:
   *         description: Item deleted successfully
   */
  static async deleteItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await MenuService.deleteItem(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/complete:
   *   get:
   *     summary: Get complete menu with categories and items
   *     tags: [Menu]
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
   *         description: Complete menu structure
   */
  static async getCompleteMenu(req: Request, res: Response) {
    try {
      const { restaurantId } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ error: 'Restaurant ID is required' });
      }

      const menu = await MenuService.getCompleteMenu(restaurantId);
      return res.json(menu);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }

  /**
   * @swagger
   * /api/menu/stats:
   *   get:
   *     summary: Get menu statistics
   *     tags: [Menu]
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
   *         description: Menu statistics
   */
  static async getMenuStats(req: Request, res: Response) {
    try {
      const { restaurantId } = req.query;
      
      if (!restaurantId || typeof restaurantId !== 'string') {
        return res.status(400).json({ error: 'Restaurant ID is required' });
      }

      const stats = await MenuService.getMenuStats(restaurantId);
      return res.json(stats);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  }
} 