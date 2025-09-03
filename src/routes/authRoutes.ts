import express from 'express'
import { AuthController } from '../controllers/authController'
import { validate } from '../middleware/validation'
import { authSchemas } from '../middleware/validation'
import { authenticate } from '../middleware/auth'

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
 *           description: Status da operação
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             authUrl:
 *               type: string
 *               description: URL de autorização da Meta para OAuth
 *               example: "https://www.facebook.com/v22.0/dialog/oauth?client_id=123&redirect_uri=https://api.cheffguio.com/api/auth/meta/callback&state=..."
 *             state:
 *               type: string
 *               description: Estado criptografado para validação da requisição
 *               example: "eyJ1c2VySWQiOiIxMjMiLCJyZXN0YXVyYW50SWQiOiI0NTYiLCJyZWRpcmVjdFVybCI6Imh0dHBzOi8vY2hlZmZndWlvLmNvbS93aGF0c2FwcCIsInRpbWVzdGFtcCI6MTYzNDU2Nzg5MH0="
 *     MetaTokenResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Status da operação
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             access_token:
 *               type: string
 *               description: Token de acesso da Meta
 *               example: "EAA..."
 *             expires_in:
 *               type: number
 *               description: Tempo de expiração em segundos
 *               example: 5184000
 *             token_type:
 *               type: string
 *               description: Tipo do token
 *               example: "long_lived"
 *     MetaCallbackResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Status da operação
 *           example: true
 *         message:
 *           type: string
 *           description: Mensagem de sucesso
 *           example: "OAuth processado com sucesso"
 *         data:
 *           type: object
 *           description: Dados da integração
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Status da operação
 *           example: false
 *         message:
 *           type: string
 *           description: Mensagem de erro
 *           example: "Token inválido ou expirado"
 *         error:
 *           type: string
 *           description: Detalhes do erro (opcional)
 *           example: "JWT token expired"
 */

/**
 * @swagger
 * /api/auth/meta/login:
 *   get:
 *     summary: Inicia processo de OAuth com Meta
 *     description: |
 *       Gera URL de autorização para conectar via Meta OAuth.
 *       Esta rota inicia o fluxo de autenticação que permite ao usuário autorizar
 *       o acesso às funcionalidades das APIs da Meta.
 *       
 *       **Fluxo:**
 *       1. Usuário chama esta rota
 *       2. Sistema gera URL de autorização Meta
 *       3. Usuário é redirecionado para Facebook
 *       4. Após autorização, Facebook redireciona para callback
 *       5. Sistema processa tokens e salva credenciais
 *       
 *       **Permissões necessárias:**
 *       - pages_manage_posts
 *       - ads_management
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: URL de autorização gerada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetaLoginResponse'
 *       401:
 *         description: Token de autenticação inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/meta/login', authenticate, AuthController.initiateMetaLogin)

/**
 * @swagger
 * /api/auth/meta/callback:
 *   get:
 *     summary: Callback OAuth Meta para processamento de autorização
 *     description: |
 *       Endpoint de callback para processar a resposta do OAuth da Meta.
 *       Esta rota é chamada automaticamente pelo Facebook após o usuário
 *       autorizar o acesso.
 *       
 *       **Processo automático:**
 *       1. Facebook redireciona para esta rota com code e state
 *       2. Sistema valida o state e troca code por token
 *       3. Sistema troca token curto por long-lived (60 dias)
 *       4. Sistema salva credenciais no banco de dados
 *       5. Sistema redireciona para frontend com status
 *       
 *       **Parâmetros obrigatórios:**
 *       - code: Código de autorização fornecido pelo Facebook
 *       - state: Estado criptografado para validação
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Código de autorização fornecido pelo Facebook
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: Estado criptografado para validação da requisição
 *     responses:
 *       200:
 *         description: Autorização processada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetaCallbackResponse'
 *       302:
 *         description: Redirecionamento para frontend após processamento
 *       400:
 *         description: Parâmetros obrigatórios não fornecidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/meta/callback', AuthController.handleMetaCallback)

/**
 * @swagger
 * /api/auth/meta/token:
 *   get:
 *     summary: Obtém token válido para integrações externas (n8n)
 *     description: |
 *       Endpoint para obter token de acesso válido para integrações externas
 *       como n8n ou outros sistemas que precisam acessar a API da Meta.
 *       
 *       **Segurança:**
 *       - Requer API Key válida no header X-API-Key
 *       
 *       **Uso:**
 *       - Integrações com n8n para automação
 *       - Webhooks externos
 *       - Sistemas de terceiros autorizados
 *     tags: [Auth, Integrations]
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante para buscar o token
 *         example: "eceaace6-0327-46d9-b835-e170a8c9d4a4"
 *     responses:
 *       200:
 *         description: Token válido retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MetaTokenResponse'
 *       400:
 *         description: Restaurant ID não fornecido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: API Key inválida ou não fornecida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Token não encontrado ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/meta/token', AuthController.getMetaToken)

// Existing routes
router.post('/register', validate(authSchemas.register), AuthController.register)
router.post('/login', validate(authSchemas.login), AuthController.login)
router.post('/logout', authenticate, AuthController.logout)
router.get('/me', authenticate, AuthController.getMe)
router.post('/refresh', authenticate, AuthController.refreshToken)

export default router 