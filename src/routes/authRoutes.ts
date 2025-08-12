import express from 'express'
import { AuthController } from '../controllers/authController'
import { validate } from '../middleware/validation'
import { authSchemas } from '../middleware/validation'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()

/**
 * @swagger
 * components:
 *   schemas:
 *     MetaLoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             authUrl:
 *               type: string
 *               description: URL de autorização da Meta
 *             state:
 *               type: string
 *               description: Estado para validação
 *     MetaTokenResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             access_token:
 *               type: string
 *             expires_in:
 *               type: number
 *             token_type:
 *               type: string
 */

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetaLoginResponse'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/meta/login', authenticateToken, AuthController.initiateMetaLogin)

/**
 * @swagger
 * /api/auth/meta/callback:
 *   get:
 *     summary: Callback OAuth Meta
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Código de autorização
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: Estado da requisição
 *     responses:
 *       200:
 *         description: Autorização processada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/meta/callback', AuthController.handleMetaCallback)

/**
 * @swagger
 * /api/auth/meta/token:
 *   get:
 *     summary: Obtém token válido para n8n
 *     tags: [Auth]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: Token válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetaTokenResponse'
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Token não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/meta/token', AuthController.getMetaToken)

// Existing routes
router.post('/register', validate(authSchemas.register), AuthController.register)
router.post('/login', validate(authSchemas.login), AuthController.login)
router.post('/logout', authenticateToken, AuthController.logout)
router.get('/me', authenticateToken, AuthController.getMe)
router.post('/refresh', authenticateToken, AuthController.refreshToken)

export default router 