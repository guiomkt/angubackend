import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

export class AuthController {
  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: Login de usuário
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *                 minLength: 6
   *     responses:
   *       200:
   *         description: Login realizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 token:
   *                   type: string
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *                 restaurant:
   *                   $ref: '#/components/schemas/Restaurant'
   *       401:
   *         description: Credenciais inválidas
   *       500:
   *         description: Erro interno do servidor
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      
      const result = await AuthService.login(email, password);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Registro de novo usuário
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *               - name
   *               - restaurantName
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *                 minLength: 6
   *               name:
   *                 type: string
   *               restaurantName:
   *                 type: string
   *               phone:
   *                 type: string
   *     responses:
   *       201:
   *         description: Usuário registrado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *                 restaurant:
   *                   $ref: '#/components/schemas/Restaurant'
   *       400:
   *         description: Dados inválidos
   *       409:
   *         description: Usuário já existe
   *       500:
   *         description: Erro interno do servidor
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name, restaurantName, phone } = req.body;
      
      const result = await AuthService.register({
        email,
        password,
        name,
        restaurantName,
        phone
      });
      
      res.status(201).json({
        success: true,
        message: 'Usuário registrado com sucesso',
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     summary: Obter dados do usuário logado
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dados do usuário
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *                 restaurant:
   *                   $ref: '#/components/schemas/Restaurant'
   *       401:
   *         description: Token inválido
   *       500:
   *         description: Erro interno do servidor
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Token inválido'
        });
        return;
      }
      
      const result = await AuthService.getUserProfile(userId);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/auth/refresh:
   *   post:
   *     summary: Renovar token de acesso
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Token renovado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 token:
   *                   type: string
   *       401:
   *         description: Token inválido
   *       500:
   *         description: Erro interno do servidor
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Token inválido'
        });
        return;
      }
      
      const token = await AuthService.generateToken(userId);
      
      res.status(200).json({
        success: true,
        token
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: Logout do usuário
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout realizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       500:
   *         description: Erro interno do servidor
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Em uma implementação mais robusta, você poderia invalidar o token
      // Por enquanto, apenas retornamos sucesso
      res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
} 