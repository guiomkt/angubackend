import { Router } from 'express'
import { WhatsAppController } from '../controllers/whatsappController'
import { authenticateToken } from '../middleware/auth'
import { validate } from '../middleware/validation'
import * as Joi from 'joi'
import multer from 'multer'
import { whatsappProfileSchema, registerTemplateSchema } from '../middleware/validation'

const router = Router()

// Configuração do multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 16 * 1024 * 1024 // 16MB
  }
})

const businessAccountsSchema = Joi.object({
  accessToken: Joi.string().required()
})

const phoneNumbersSchema = Joi.object({
  businessAccountId: Joi.string().required(),
  accessToken: Joi.string().required()
})

const saveIntegrationSchema = Joi.object({
  restaurantId: Joi.string().uuid().required(),
  phoneNumberId: Joi.string().required(),
  businessAccountId: Joi.string().required(),
  accessToken: Joi.string().required()
})

const sendMessageSchema = Joi.object({
  restaurantId: Joi.string().uuid().required(),
  to: Joi.string().required(),
  message: Joi.string().required()
})

const sendTemplateMessageSchema = Joi.object({
  restaurantId: Joi.string().uuid().required(),
  to: Joi.string().required(),
  templateName: Joi.string().required(),
  language: Joi.string().optional(),
  components: Joi.array().optional()
})

const saveTokenSchema = Joi.object({
  businessId: Joi.string().required(),
  accessToken: Joi.string().required(),
  refreshToken: Joi.string().required(),
  expiresIn: Joi.number().optional()
})

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
})

const contactSchema = Joi.object({
  restaurantId: Joi.string().uuid().required(),
  phoneNumber: Joi.string().required(),
  name: Joi.string().optional(),
  email: Joi.string().email().optional(),
  notes: Joi.string().optional(),
  tags: Joi.array().items(Joi.string()).optional()
})

const webhookSchema = Joi.object({
  restaurantId: Joi.string().uuid().required(),
  webhookUrl: Joi.string().uri().required(),
  verifyToken: Joi.string().required()
})

/**
 * @swagger
 * /api/whatsapp/business-accounts:
 *   post:
 *     summary: Buscar contas de negócio do Facebook
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *                 description: Token de acesso do Facebook
 *     responses:
 *       200:
 *         description: Lista de contas de negócio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/business-accounts', authenticateToken, validate(businessAccountsSchema), WhatsAppController.getBusinessAccounts)

/**
 * @swagger
 * /api/whatsapp/phone-numbers:
 *   post:
 *     summary: Buscar números de telefone de uma conta de negócio
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessAccountId
 *               - accessToken
 *             properties:
 *               businessAccountId:
 *                 type: string
 *                 description: ID da conta de negócio
 *               accessToken:
 *                 type: string
 *                 description: Token de acesso do Facebook
 *     responses:
 *       200:
 *         description: Lista de números de telefone
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
// Rota removida - usar OAuth em vez de tokens diretos

/**
 * @swagger
 * /api/whatsapp/integration:
 *   post:
 *     summary: Salvar integração WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - phoneNumberId
 *               - businessAccountId
 *               - accessToken
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *               phoneNumberId:
 *                 type: string
 *                 description: ID do número de telefone
 *               businessAccountId:
 *                 type: string
 *                 description: ID da conta de negócio
 *               accessToken:
 *                 type: string
 *                 description: Token de acesso
 *     responses:
 *       200:
 *         description: Integração salva com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Restaurante não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/integration', authenticateToken, validate(saveIntegrationSchema), WhatsAppController.saveIntegration)

/**
 * @swagger
 * /api/whatsapp/integration/{restaurantId}:
 *   get:
 *     summary: Buscar integração WhatsApp de um restaurante
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *     responses:
 *       200:
 *         description: Integração encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/integration/:restaurantId', authenticateToken, WhatsAppController.getIntegration)

/**
 * @swagger
 * /api/whatsapp/integration/{restaurantId}:
 *   put:
 *     summary: Atualizar integração WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Integração atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/integration/:restaurantId', authenticateToken, WhatsAppController.updateIntegration)

/**
 * @swagger
 * /api/whatsapp/integration/{restaurantId}:
 *   delete:
 *     summary: Deletar integração WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *     responses:
 *       200:
 *         description: Integração removida com sucesso
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
router.delete('/integration/:restaurantId', authenticateToken, WhatsAppController.deleteIntegration)

/**
 * @swagger
 * /api/whatsapp/send-message:
 *   post:
 *     summary: Enviar mensagem WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - to
 *               - message
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *               to:
 *                 type: string
 *                 description: Número de telefone do destinatário
 *               message:
 *                 type: string
 *                 description: Mensagem a ser enviada
 *     responses:
 *       200:
 *         description: Mensagem enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Integração WhatsApp não encontrada
 *       401:
 *         description: Token de acesso inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/send-message', authenticateToken, validate(sendMessageSchema), WhatsAppController.sendMessage)

/**
 * @swagger
 * /api/whatsapp/send-template:
 *   post:
 *     summary: Enviar mensagem template WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - to
 *               - templateName
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *               to:
 *                 type: string
 *                 description: Número de telefone do destinatário
 *               templateName:
 *                 type: string
 *                 description: Nome do template
 *               language:
 *                 type: string
 *                 description: Código do idioma (padrão: pt_BR)
 *               components:
 *                 type: array
 *                 description: Componentes do template
 *     responses:
 *       200:
 *         description: Template enviado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Integração WhatsApp não encontrada
 *       401:
 *         description: Token de acesso inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/send-template', authenticateToken, validate(sendTemplateMessageSchema), WhatsAppController.sendTemplateMessage)

/**
 * @swagger
 * /api/whatsapp/media:
 *   post:
 *     summary: Fazer upload de mídia
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - file
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de mídia
 *     responses:
 *       200:
 *         description: Mídia enviada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Integração WhatsApp não encontrada
 *       401:
 *         description: Token de acesso inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/media', authenticateToken, upload.single('file'), WhatsAppController.uploadMedia)

/**
 * @swagger
 * /api/whatsapp/media/{mediaId}:
 *   get:
 *     summary: Baixar mídia
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: mediaId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da mídia
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *     responses:
 *       200:
 *         description: Arquivo de mídia
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Integração WhatsApp não encontrada
 *       401:
 *         description: Token de acesso inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/media/:mediaId', authenticateToken, WhatsAppController.downloadMedia)

/**
 * @swagger
 * /api/whatsapp/messages/{messageId}/status:
 *   get:
 *     summary: Buscar status de uma mensagem
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da mensagem
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *     responses:
 *       200:
 *         description: Status da mensagem
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Integração WhatsApp não encontrada
 *       401:
 *         description: Token de acesso inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/messages/:messageId/status', authenticateToken, WhatsAppController.getMessageStatus)

/**
 * @swagger
 * /api/whatsapp/webhook/register:
 *   post:
 *     summary: Registrar webhook
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - webhookUrl
 *               - verifyToken
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *               webhookUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL do webhook
 *               verifyToken:
 *                 type: string
 *                 description: Token de verificação
 *     responses:
 *       200:
 *         description: Webhook registrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Integração WhatsApp não encontrada
 *       401:
 *         description: Token de acesso inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/webhook/register', authenticateToken, validate(webhookSchema), WhatsAppController.registerWebhook)

/**
 * @swagger
 * /api/whatsapp/webhook:
 *   get:
 *     summary: Verificar webhook (challenge)
 *     tags: [WhatsApp]
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         schema:
 *           type: string
 *         description: Modo do webhook
 *       - in: query
 *         name: hub.challenge
 *         schema:
 *           type: string
 *         description: Challenge do webhook
 *       - in: query
 *         name: hub.verify_token
 *         schema:
 *           type: string
 *         description: Token de verificação
 *     responses:
 *       200:
 *         description: Challenge respondido
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       403:
 *         description: Token inválido
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/webhook', WhatsAppController.verifyWebhook)

/**
 * @swagger
 * /api/whatsapp/webhook:
 *   post:
 *     summary: Receber eventos do webhook
 *     tags: [WhatsApp]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Evento processado
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/webhook', WhatsAppController.handleWebhook)

/**
 * @swagger
 * /api/whatsapp/contacts:
 *   post:
 *     summary: Criar/atualizar contato
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *               - phoneNumber
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *               phoneNumber:
 *                 type: string
 *                 description: Número de telefone
 *               name:
 *                 type: string
 *                 description: Nome do contato
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do contato
 *               notes:
 *                 type: string
 *                 description: Observações
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tags do contato
 *     responses:
 *       200:
 *         description: Contato salvo com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/contacts', authenticateToken, validate(contactSchema), WhatsAppController.saveContact)

/**
 * @swagger
 * /api/whatsapp/contacts/{restaurantId}/{phoneNumber}:
 *   get:
 *     summary: Buscar contato
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *       - in: path
 *         name: phoneNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Número de telefone
 *     responses:
 *       200:
 *         description: Contato encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/contacts/:restaurantId/:phoneNumber', authenticateToken, WhatsAppController.getContact)

/**
 * @swagger
 * /api/whatsapp/contacts/{restaurantId}:
 *   get:
 *     summary: Listar contatos
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *     responses:
 *       200:
 *         description: Lista de contatos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/contacts/:restaurantId', authenticateToken, WhatsAppController.getContacts)

/**
 * @swagger
 * /api/whatsapp/contacts/{restaurantId}/{phoneNumber}:
 *   put:
 *     summary: Atualizar contato
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *       - in: path
 *         name: phoneNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Número de telefone
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Contato atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/contacts/:restaurantId/:phoneNumber', authenticateToken, WhatsAppController.updateContact)

/**
 * @swagger
 * /api/whatsapp/contacts/{restaurantId}/{phoneNumber}:
 *   delete:
 *     summary: Deletar contato
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *       - in: path
 *         name: phoneNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Número de telefone
 *     responses:
 *       200:
 *         description: Contato removido com sucesso
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
router.delete('/contacts/:restaurantId/:phoneNumber', authenticateToken, WhatsAppController.deleteContact)

/**
 * @swagger
 * /api/whatsapp/messages/{restaurantId}:
 *   get:
 *     summary: Listar mensagens
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Limite de mensagens
 *     responses:
 *       200:
 *         description: Lista de mensagens
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/messages/:restaurantId', authenticateToken, WhatsAppController.getMessages)

/**
 * @swagger
 * /api/whatsapp/token:
 *   post:
 *     summary: Salvar token WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - businessId
 *               - accessToken
 *               - refreshToken
 *             properties:
 *               businessId:
 *                 type: string
 *                 description: ID da conta de negócio
 *               accessToken:
 *                 type: string
 *                 description: Token de acesso
 *               refreshToken:
 *                 type: string
 *                 description: Token de renovação
 *               expiresIn:
 *                 type: number
 *                 description: Tempo de expiração em segundos
 *     responses:
 *       200:
 *         description: Token salvo com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/token', authenticateToken, validate(saveTokenSchema), WhatsAppController.saveToken)

/**
 * @swagger
 * /api/whatsapp/profile:
 *   post:
 *     summary: Atualizar perfil do WhatsApp Business
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 */
router.post('/profile', authenticateToken, validate(whatsappProfileSchema), WhatsAppController.updateBusinessProfile)

/**
 * @swagger
 * /api/whatsapp/profile/photo:
 *   post:
 *     summary: Enviar foto de perfil do WhatsApp Business
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 */
router.post('/profile/photo', authenticateToken, upload.single('file'), WhatsAppController.uploadProfilePhoto)

/**
 * @swagger
 * /api/whatsapp/templates:
 *   post:
 *     summary: Registrar template na WABA
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 */
router.post('/templates', authenticateToken, validate(registerTemplateSchema), WhatsAppController.registerTemplate)

/**
 * @swagger
 * /api/whatsapp/token/{businessId}:
 *   get:
 *     summary: Buscar token WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conta de negócio
 *     responses:
 *       200:
 *         description: Token encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/token/:businessId', authenticateToken, WhatsAppController.getToken)

/**
 * @swagger
 * /api/whatsapp/token/{businessId}/refresh:
 *   post:
 *     summary: Renovar token WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da conta de negócio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Token de renovação
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/token/:businessId/refresh', authenticateToken, validate(refreshTokenSchema), WhatsAppController.refreshToken)

// OAuth token exchange
const oauthTokenSchema = Joi.object({
  code: Joi.string().required(),
  restaurantId: Joi.string().uuid().required(),
  state: Joi.string().required()
})

router.post('/oauth/token', validate(oauthTokenSchema), async (req, res) => {
  try {
    const { code, restaurantId, state } = req.body

    // TODO: Implement proper state verification
    // For now, we'll skip state verification

    // Método removido - usar OAuth em vez de troca direta de código
return res.status(400).json({
      success: false,
      message: 'Método não suportado. Use OAuth para conectar WhatsApp.'
    })
  } catch (error) {
return res.status(500).json({
      success: false,
      message: 'Erro ao trocar código por token',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * @swagger
 * /api/whatsapp/validate-token:
 *   get:
 *     summary: Validar token WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do restaurante
 *     responses:
 *       200:
 *         description: Token validado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 valid:
 *                   type: boolean
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/validate-token', authenticateToken, async (req, res) => {
  try {
    const { restaurantId } = req.query

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID é obrigatório'
      })
    }

    const isValid = await WhatsAppController.validateToken(restaurantId as string)
    
return res.json({
      success: true,
      valid: isValid
    })
  } catch (error) {
return res.status(500).json({
      success: false,
      message: 'Erro ao validar token',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

/**
 * @swagger
 * /api/whatsapp/oauth/initiate:
 *   get:
 *     summary: Inicia o fluxo OAuth do WhatsApp
 *     tags: [WhatsApp]
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *       - in: query
 *         name: redirectUrl
 *         required: true
 *         schema:
 *           type: string
 *         description: URL de redirecionamento após autorização
 *     responses:
 *       200:
 *         description: URL de autorização gerada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 authUrl:
 *                   type: string
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/oauth/initiate', WhatsAppController.initiateOAuth)

/**
 * @swagger
 * /api/whatsapp/oauth/callback:
 *   get:
 *     summary: Callback OAuth do WhatsApp
 *     tags: [WhatsApp]
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
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/oauth/callback', WhatsAppController.handleOAuthCallback)

/**
 * @swagger
 * /api/whatsapp/disconnect:
 *   post:
 *     summary: Desvincula o WhatsApp do restaurante
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - restaurantId
 *             properties:
 *               restaurantId:
 *                 type: string
 *                 format: uuid
 *                 description: ID do restaurante
 *     responses:
 *       200:
 *         description: WhatsApp desvinculado com sucesso
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
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const { restaurantId } = req.body

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant ID é obrigatório'
      })
    }

    // Verificar se o usuário tem acesso ao restaurante
    const user = (req as any).user
    if (!user || !user.restaurant_id || user.restaurant_id !== restaurantId) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado a desvincular este restaurante'
      })
    }

    const result = await WhatsAppController.disconnectWhatsApp(restaurantId)
    
return res.json({
      success: true,
      message: 'WhatsApp desvinculado com sucesso',
      data: result
    })
  } catch (error) {
    console.error('Erro ao desvincular WhatsApp:', error)
return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

/**
 * @swagger
 * /api/whatsapp/status:
 *   get:
 *     summary: Verifica o status da integração WhatsApp
 *     tags: [WhatsApp]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do restaurante
 *     responses:
 *       200:
 *         description: Status da integração
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     isConnected:
 *                       type: boolean
 *                     integration:
 *                       type: object
 *                     lastConnected:
 *                       type: string
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { restaurantId } = req.query

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant ID é obrigatório'
      })
    }

    // Verificar se o usuário tem acesso ao restaurante
    const user = (req as any).user
    if (!user || !user.restaurant_id || user.restaurant_id !== restaurantId) {
      return res.status(401).json({
        success: false,
        error: 'Não autorizado a verificar este restaurante'
      })
    }

    const status = await WhatsAppController.getWhatsAppStatus(restaurantId as string)
    
return res.json({
      success: true,
      data: status
    })
  } catch (error) {
    console.error('Erro ao verificar status do WhatsApp:', error)
return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    })
  }
})

export default router 