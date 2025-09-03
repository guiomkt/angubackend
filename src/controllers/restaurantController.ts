import { Request, Response, NextFunction } from 'express';
import restaurantService from '../services/restaurantService';
import { AuthenticatedRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

class RestaurantController {
  async getAllRestaurants(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string;

      const result = await restaurantService.getAllRestaurants(page, limit, search);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async getRestaurantById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await restaurantService.getRestaurantById(id);
      return res.json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getRestaurantByUserId(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const result = await restaurantService.getRestaurantByUserId(userId);
      
      if (!result) {
        return res.json({ success: false, message: 'No restaurant found for this user' });
      }

      return res.json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getCurrentUserRestaurant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw createError('User not authenticated', 401);
      }

      const result = await restaurantService.getRestaurantByUserId(req.user.id);

      if (!result) {
        return res.json({ success: false, message: 'No restaurant found for this user' });
      }

      return res.json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  async createRestaurant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.id) {
        throw createError('User not authenticated', 401);
      }

      const restaurantData = {
        ...req.body,
        user_id: req.user.id,
      };

      const result = await restaurantService.createRestaurant(restaurantData);
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  async updateRestaurant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!req.user?.restaurant_id || req.user.restaurant_id !== id) {
        throw createError('Unauthorized to update this restaurant', 403);
      }

      const result = await restaurantService.updateRestaurant(id, req.body);
      return res.json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  async deleteRestaurant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!req.user?.restaurant_id || req.user.restaurant_id !== id) {
        throw createError('Unauthorized to delete this restaurant', 403);
      }

      const result = await restaurantService.deleteRestaurant(id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async updateOnboardingStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { completed, step } = req.body;
      
      if (!req.user?.restaurant_id || req.user.restaurant_id !== id) {
        throw createError('Unauthorized to update this restaurant', 403);
      }

      // Use updateRestaurant instead of updateOnboardingStatus since we removed the latter
      const result = await restaurantService.updateRestaurant(id, { 
        onboarding_completed: completed, 
        onboarding_step: step 
      });
      
      return res.json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }

  async getRestaurantSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.restaurant_id) {
        throw createError('User not authenticated', 401);
      }

      const result = await restaurantService.getRestaurantSettings(req.user.restaurant_id);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async updateRestaurantSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.restaurant_id) {
        throw createError('User not authenticated', 401);
      }

      const result = await restaurantService.updateRestaurantSettings(req.user.restaurant_id, req.body);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  async uploadRestaurantLogo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.restaurant_id) {
        throw createError('User not authenticated', 401);
      }

      if (!req.file) {
        throw createError('No file uploaded', 400);
      }

      const result = await restaurantService.uploadRestaurantLogo(req.user.restaurant_id, req.file);
      return res.json(result);
    } catch (error) {
      return next(error);
    }
  }
}

export default new RestaurantController(); 