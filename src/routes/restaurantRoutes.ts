import { Router } from 'express';
import restaurantController from '../controllers/restaurantController';
import { authenticate, requireRestaurant } from '../middleware/auth';
import { validate, restaurantSchema, restaurantSchemas } from '../middleware/validation';
import multer from 'multer';

const router = Router();

// Configuração do multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Restaurant:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the restaurant
 *         name:
 *           type: string
 *           description: Restaurant name
 *         description:
 *           type: string
 *           description: Restaurant description
 *         logo_url:
 *           type: string
 *           format: uri
 *           description: URL to restaurant logo
 *         address:
 *           type: string
 *           description: Restaurant address
 *         city:
 *           type: string
 *           description: City where restaurant is located
 *         state:
 *           type: string
 *           description: State where restaurant is located
 *         postal_code:
 *           type: string
 *           description: Postal code
 *         phone:
 *           type: string
 *           description: Restaurant phone number
 *         email:
 *           type: string
 *           format: email
 *           description: Restaurant email
 *         website:
 *           type: string
 *           format: uri
 *           description: Restaurant website URL
 *         opening_hours:
 *           type: object
 *           description: Restaurant opening hours
 *         max_capacity:
 *           type: integer
 *           description: Maximum restaurant capacity
 *         onboarding_completed:
 *           type: boolean
 *           description: Whether onboarding is completed
 *         onboarding_step:
 *           type: integer
 *           description: Current onboarding step
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: Associated user ID
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/restaurants:
 *   get:
 *     summary: Get all restaurants
 *     tags: [Restaurants]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of restaurants
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
 *                     $ref: '#/components/schemas/Restaurant'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', restaurantController.getAllRestaurants);

/**
 * @swagger
 * /api/restaurants/my:
 *   get:
 *     summary: Get current user's restaurant
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's restaurant
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Restaurant'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/my', authenticate, restaurantController.getCurrentUserRestaurant);

/**
 * @swagger
 * /api/restaurants/user/{userId}:
 *   get:
 *     summary: Get restaurant by user ID
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: Restaurant details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Restaurant'
 *       404:
 *         description: Restaurant not found
 */
router.get('/user/:userId', restaurantController.getRestaurantByUserId);

/**
 * @swagger
 * /api/restaurants/{id}:
 *   get:
 *     summary: Get restaurant by ID
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Restaurant details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Restaurant'
 *       404:
 *         description: Restaurant not found
 */
router.get('/:id', restaurantController.getRestaurantById);

/**
 * @swagger
 * /api/restaurants:
 *   post:
 *     summary: Create a new restaurant
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               address:
 *                 type: string
 *                 maxLength: 200
 *               city:
 *                 type: string
 *                 maxLength: 100
 *               state:
 *                 type: string
 *                 maxLength: 50
 *               postal_code:
 *                 type: string
 *                 maxLength: 10
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *               email:
 *                 type: string
 *                 format: email
 *               website:
 *                 type: string
 *                 format: uri
 *               opening_hours:
 *                 type: object
 *               max_capacity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       201:
 *         description: Restaurant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Restaurant'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, validate(restaurantSchema), restaurantController.createRestaurant);

/**
 * @swagger
 * /api/restaurants/{id}:
 *   put:
 *     summary: Update restaurant
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Restaurant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               address:
 *                 type: string
 *                 maxLength: 200
 *               city:
 *                 type: string
 *                 maxLength: 100
 *               state:
 *                 type: string
 *                 maxLength: 50
 *               postal_code:
 *                 type: string
 *                 maxLength: 10
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *               email:
 *                 type: string
 *                 format: email
 *               website:
 *                 type: string
 *                 format: uri
 *               opening_hours:
 *                 type: object
 *               max_capacity:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Restaurant updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Restaurant'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Restaurant not found
 */
router.put('/:id', authenticate, requireRestaurant, validate(restaurantSchemas.update), restaurantController.updateRestaurant);

/**
 * @swagger
 * /api/restaurants/{id}/onboarding:
 *   patch:
 *     summary: Update restaurant onboarding status
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Restaurant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - completed
 *               - step
 *             properties:
 *               completed:
 *                 type: boolean
 *                 description: Whether onboarding is completed
 *               step:
 *                 type: integer
 *                 description: Current onboarding step
 *     responses:
 *       200:
 *         description: Onboarding status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Restaurant'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch('/:id/onboarding', authenticate, requireRestaurant, restaurantController.updateOnboardingStatus);

/**
 * @swagger
 * /api/restaurants/{id}:
 *   delete:
 *     summary: Delete restaurant
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Restaurant ID
 *     responses:
 *       200:
 *         description: Restaurant deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Restaurant not found
 */
router.delete('/:id', authenticate, requireRestaurant, restaurantController.deleteRestaurant);

// Rota de teste simples
router.get('/settings/test', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    console.log('Rota de teste /settings/test chamada');
    console.log('User na rota:', req.user);
    
    return res.json({
      success: true,
      message: 'Rota de teste funcionando',
      user: req.user,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro na rota de teste:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/restaurants/settings:
 *   get:
 *     summary: Obter configurações completas do restaurante
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações do restaurante
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
 *                     restaurant:
 *                       $ref: '#/components/schemas/Restaurant'
 *                     ai_settings:
 *                       $ref: '#/components/schemas/AISettings'
 *                     notification_settings:
 *                       $ref: '#/components/schemas/NotificationSettings'

 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UserProfileExtended'
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/settings', authenticate, requireRestaurant, async (req: any, res, next) => {
  try {
    return await restaurantController.getRestaurantSettings(req, res, next);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @swagger
 * /api/restaurants/settings:
 *   put:
 *     summary: Atualizar configurações do restaurante
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               restaurant:
 *                 $ref: '#/components/schemas/Restaurant'
 *               ai_settings:
 *                 $ref: '#/components/schemas/AISettings'
 *               notification_settings:
 *                 $ref: '#/components/schemas/NotificationSettings'

 *     responses:
 *       200:
 *         description: Configurações atualizadas com sucesso
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/settings', authenticate, requireRestaurant, restaurantController.updateRestaurantSettings);

/**
 * @swagger
 * /api/restaurants/logo:
 *   post:
 *     summary: Fazer upload do logo do restaurante
 *     tags: [Restaurants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Arquivo de imagem (JPG, PNG ou WebP, máximo 2MB)
 *     responses:
 *       200:
 *         description: Logo enviado com sucesso
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
 *                     logo_url:
 *                       type: string
 *       400:
 *         description: Arquivo inválido ou não enviado
 *       401:
 *         description: Não autorizado
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/logo', authenticate, requireRestaurant, upload.single('file'), restaurantController.uploadRestaurantLogo);

export default router; 