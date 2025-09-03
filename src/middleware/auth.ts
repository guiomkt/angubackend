import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import { AuthService } from '../services/authService';
import restaurantService from '../services/restaurantService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
    restaurant_id?: string;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token de acesso não fornecido'
      });
      return;
    }

    try {
      const decoded = AuthService.verifyToken(token);
      
      let restaurant_id: string | undefined = undefined;
      try {
        const result = await restaurantService.getRestaurantByUserId(decoded.id);
        if (result && result.id) {
          restaurant_id = result.id;
        }
      } catch (e) {
        // Ignorar erro ao buscar restaurante
      }
      
      req.user = { ...decoded, restaurant_id };
      next();
    } catch (error) {
      res.status(403).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro na autenticação'
    });
    return;
  }
};

export const requireRole = (roles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      // Buscar dados do usuário para verificar o role
      const userProfile = await AuthService.getUserProfile(req.user.id);

      if (!userProfile) {
        res.status(401).json({
          success: false,
          message: 'Usuário não encontrado'
        });
        return;
      }

      if (!roles.includes(userProfile.user.role)) {
        res.status(403).json({
          success: false,
          message: 'Acesso negado. Permissão insuficiente.'
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro na verificação de permissões'
      });
      return;
    }
  };
};

export const requireRestaurant = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user?.restaurant_id) {
    res.status(403).json({
      success: false,
      message: 'Acesso ao restaurante necessário'
    });
    return;
  }
  next();
}; 