import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import reservationService from '../services/reservationService';
import { createError } from '../middleware/errorHandler';

export class ReservationController {
  async getReservations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.restaurant_id) {
        throw createError('Restaurant access required', 403);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        date: req.query.date as string,
        status: req.query.status as string,
        area_id: req.query.area_id as string,
        table_id: req.query.table_id as string
      };

      const result = await reservationService.getReservationsByRestaurant(
        req.user.restaurant_id,
        page,
        limit,
        filters
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTodayReservations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.restaurant_id) {
        throw createError('Restaurant access required', 403);
      }

      const result = await reservationService.getTodayReservations(req.user.restaurant_id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getUpcomingReservations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.restaurant_id) {
        throw createError('Restaurant access required', 403);
      }

      const days = parseInt(req.query.days as string) || 7;
      const result = await reservationService.getUpcomingReservations(req.user.restaurant_id, days);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getReservationById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await reservationService.getReservationById(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createReservation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user?.restaurant_id) {
        throw createError('Restaurant access required', 403);
      }

      const reservationData = {
        ...req.body,
        restaurant_id: req.user.restaurant_id
      };

      const result = await reservationService.createReservation(reservationData);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateReservation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await reservationService.updateReservation(id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async deleteReservation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await reservationService.deleteReservation(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateReservationStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        throw createError('Status is required', 400);
      }

      const result = await reservationService.updateReservationStatus(id, status);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export default new ReservationController(); 