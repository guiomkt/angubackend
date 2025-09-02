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
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      
      const result = await AuthService.login(email, password);
      
      return res.status(200).json({
        success: true,
        ...result
      })
    } catch (error) {
      return next(error);
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
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, restaurantName, phone } = req.body;
      
      const result = await AuthService.register({
        email,
        password,
        name,
        restaurantName,
        phone
      });
      
      return res.status(201).json({
        success: true,
        message: 'Usuário registrado com sucesso',
        ...result
      })
    } catch (error) {
      return next(error);
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
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido'
        })
        return;
      }
      
      const result = await AuthService.getUserProfile(userId);
      
      return res.status(200).json({
        success: true,
        ...result
      })
    } catch (error) {
      return next(error);
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
  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido'
        })
        return;
      }
      
      const token = await AuthService.generateToken(userId);
      
      return res.status(200).json({
        success: true,
        token
      })
    } catch (error) {
      return next(error);
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
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (token) {
        await AuthService.logout(token);
      }
      
      return res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso'
      })
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @swagger
   * /api/auth/meta/login:
   *   get:
   *     summary: Inicia login OAuth com Meta
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: URL de autorização gerada
   *       401:
   *         description: Não autorizado
   *       500:
   *         description: Erro interno do servidor
   */
  static async initiateMetaLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        })
      }

      const result = await AuthService.initiateMetaLogin(userId);
      
      return res.status(200).json({
        success: true,
        data: result
      })
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @swagger
   * /api/auth/meta/callback:
   *   get:
   *     summary: Callback OAuth Meta
   *     tags: [Auth]
   *     responses:
   *       200:
   *         description: Autorização processada
   *       400:
   *         description: Dados inválidos
   *       500:
   *         description: Erro interno do servidor
   */
  static async handleMetaCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({
          success: false,
          message: 'Código e estado são obrigatórios'
        })
      }

      const result = await AuthService.handleMetaCallback(code as string, state as string);

      // Redirecionar baseado no state
      const stateData = JSON.parse(decodeURIComponent(state as string));
      const redirectUrl = stateData.redirectUrl;

      if (redirectUrl.includes('localhost') || redirectUrl.includes(process.env.FRONTEND_URL || 'localhost')) {
        return res.redirect(`${redirectUrl}?code=${encodeURIComponent('ok')}&state=${state}`)
      } else {
        return res.json({ success: true, data: result, message: 'OAuth processado com sucesso' })
      }
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @swagger
   * /api/auth/meta/token:
   *   get:
   *     summary: Obtém token válido para n8n
   *     tags: [Auth]
   *     responses:
   *       200:
   *         description: Token válido
   *       401:
   *         description: Não autorizado
   *       404:
   *         description: Token não encontrado
   *       500:
   *         description: Erro interno do servidor
   */
  static async getMetaToken(req: Request, res: Response, next: NextFunction) {
    try {
      // Verificar API Key para n8n
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey || apiKey !== process.env.N8N_API_KEY) {
        return res.status(401).json({
          success: false,
          message: 'API Key inválida'
        })
      }

      const restaurantId = req.query.restaurantId as string;
      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant ID é obrigatório'
        })
      }

      const token = await AuthService.getMetaToken(restaurantId);
      
      return res.status(200).json({
        success: true,
        data: token
      })
    } catch (error) {
      return next(error);
    }
  }
} 