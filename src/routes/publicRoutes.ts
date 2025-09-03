import { Router } from 'express';
import restaurantService from '../services/restaurantService';
import { Request, Response } from 'express';

const router = Router();

/**
 * @swagger
 * /api/public/restaurant/{id}:
 *   get:
 *     summary: Get restaurant information (public access)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Restaurant information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 address:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 email:
 *                   type: string
 *                 logo_url:
 *                   type: string
 *       404:
 *         description: Restaurant not found
 */
router.get('/restaurant/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    try {
      const restaurant = await restaurantService.getRestaurantById(id);
      
      // Return only public information
      const publicInfo = {
        id: restaurant.id,
        name: restaurant.name,
        description: restaurant.description,
        address: restaurant.address,
        phone: restaurant.phone,
        email: restaurant.email,
        logo_url: restaurant.logo_url
      };

      return res.json(publicInfo);
    } catch (error) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

export default router; 