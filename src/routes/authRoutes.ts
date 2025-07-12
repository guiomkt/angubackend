import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validate } from '../middleware/validation';
import { authSchemas } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           type: string
 *         user_id:
 *           type: string
 *     Restaurant:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         logo_url:
 *           type: string
 *           nullable: true
 *         address:
 *           type: string
 *           nullable: true
 *         city:
 *           type: string
 *           nullable: true
 *         state:
 *           type: string
 *           nullable: true
 *         postal_code:
 *           type: string
 *           nullable: true
 *         phone:
 *           type: string
 *           nullable: true
 *         email:
 *           type: string
 *           format: email
 *         website:
 *           type: string
 *           nullable: true
 *         opening_hours:
 *           type: object
 *           nullable: true
 *         max_capacity:
 *           type: number
 *           nullable: true
 *         onboarding_completed:
 *           type: boolean
 *         onboarding_step:
 *           type: number
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Rotas públicas
router.post('/login', validate(authSchemas.login), AuthController.login);
router.post('/register', validate(authSchemas.register), AuthController.register);

// Rotas protegidas
router.get('/me', authenticateToken, AuthController.getMe);
router.post('/refresh', authenticateToken, AuthController.refreshToken);
router.post('/logout', authenticateToken, AuthController.logout);

export default router; 