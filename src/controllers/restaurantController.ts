import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import restaurantService from '../services/restaurantService';
import { createError } from '../middleware/errorHandler';

export class RestaurantController {
  async getAllRestaurants(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await restaurantService.getAllRestaurants(page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getRestaurantById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await restaurantService.getRestaurantById(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMyRestaurant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw createError('User not authenticated', 401);
      }

      const result = await restaurantService.getRestaurantByUserId(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getRestaurantByUserId(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const result = await restaurantService.getRestaurantByUserId(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createRestaurant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw createError('User not authenticated', 401);
      }

      const restaurantData = {
        ...req.body,
        user_id: req.user.id
      };

      const result = await restaurantService.createRestaurant(restaurantData);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateRestaurant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!req.user?.restaurant_id || req.user.restaurant_id !== id) {
        throw createError('Unauthorized to update this restaurant', 403);
      }

      const result = await restaurantService.updateRestaurant(id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async deleteRestaurant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!req.user?.restaurant_id || req.user.restaurant_id !== id) {
        throw createError('Unauthorized to delete this restaurant', 403);
      }

      const result = await restaurantService.deleteRestaurant(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateOnboardingStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { completed, step } = req.body;
      
      if (!req.user?.restaurant_id || req.user.restaurant_id !== id) {
        throw createError('Unauthorized to update this restaurant', 403);
      }

      const result = await restaurantService.updateOnboardingStatus(id, completed, step);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export default new RestaurantController(); 