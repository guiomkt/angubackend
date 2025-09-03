import { Router } from 'express';
import reservationController from '../controllers/reservationController';
import { authenticate, requireRestaurant } from '../middleware/auth';
import { validate, reservationSchema } from '../middleware/validation';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Reservation:
 *       type: object
 *       required:
 *         - customer_name
 *         - number_of_people
 *         - reservation_date
 *         - start_time
 *         - restaurant_id
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the reservation
 *         customer_name:
 *           type: string
 *           description: Customer name
 *         phone:
 *           type: string
 *           description: Customer phone number
 *         number_of_people:
 *           type: integer
 *           minimum: 1
 *           description: Number of people for the reservation
 *         reservation_date:
 *           type: string
 *           format: date
 *           description: Reservation date (YYYY-MM-DD)
 *         start_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: "Reservation start time (HH:MM)"
 *         table_id:
 *           type: string
 *           format: uuid
 *           description: Assigned table ID
 *         area_id:
 *           type: string
 *           format: uuid
 *           description: Assigned area ID
 *         status:
 *           type: string
 *           enum: [pending, confirmed, canceled, completed, seated]
 *           default: pending
 *           description: Reservation status
 *         notes:
 *           type: string
 *           description: Additional notes
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *           description: Restaurant ID
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         table:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             name:
 *               type: string
 *         area:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             name:
 *               type: string
 */

/**
 * @swagger
 * /api/reservations:
 *   get:
 *     summary: Get reservations for current restaurant
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
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
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by reservation date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, canceled, completed, seated]
 *         description: Filter by status
 *       - in: query
 *         name: area_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by area ID
 *       - in: query
 *         name: table_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by table ID
 *     responses:
 *       200:
 *         description: List of reservations
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
 *                     $ref: '#/components/schemas/Reservation'
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/', authenticate, requireRestaurant, reservationController.getReservations);

/**
 * @swagger
 * /api/reservations/today:
 *   get:
 *     summary: Get today's reservations
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's reservations
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
 *                     $ref: '#/components/schemas/Reservation'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/today', authenticate, requireRestaurant, reservationController.getTodayReservations);

/**
 * @swagger
 * /api/reservations/upcoming:
 *   get:
 *     summary: Get upcoming reservations
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to look ahead
 *     responses:
 *       200:
 *         description: Upcoming reservations
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
 *                     $ref: '#/components/schemas/Reservation'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 */
router.get('/upcoming', authenticate, requireRestaurant, reservationController.getUpcomingReservations);

/**
 * @swagger
 * /api/reservations/{id}:
 *   get:
 *     summary: Get reservation by ID
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reservation ID
 *     responses:
 *       200:
 *         description: Reservation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Reservation'
 *       404:
 *         description: Reservation not found
 */
router.get('/:id', authenticate, reservationController.getReservationById);

/**
 * @swagger
 * /api/reservations:
 *   post:
 *     summary: Create a new reservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_name
 *               - number_of_people
 *               - reservation_date
 *               - start_time
 *             properties:
 *               customer_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *               number_of_people:
 *                 type: integer
 *                 minimum: 1
 *               reservation_date:
 *                 type: string
 *                 format: date
 *               start_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *               table_id:
 *                 type: string
 *                 format: uuid
 *               area_id:
 *                 type: string
 *                 format: uuid
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, canceled, completed, seated]
 *                 default: pending
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Reservation created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Reservation'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       409:
 *         description: Table conflict
 */
router.post('/', authenticate, requireRestaurant, validate(reservationSchema), reservationController.createReservation);

/**
 * @swagger
 * /api/reservations/{id}:
 *   put:
 *     summary: Update reservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reservation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customer_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *               number_of_people:
 *                 type: integer
 *                 minimum: 1
 *               reservation_date:
 *                 type: string
 *                 format: date
 *               start_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *               table_id:
 *                 type: string
 *                 format: uuid
 *               area_id:
 *                 type: string
 *                 format: uuid
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, canceled, completed, seated]
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Reservation updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Reservation'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       404:
 *         description: Reservation not found
 */
router.put('/:id', authenticate, validate(reservationSchema), reservationController.updateReservation);

/**
 * @swagger
 * /api/reservations/{id}/status:
 *   patch:
 *     summary: Update reservation status
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reservation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, canceled, completed, seated]
 *                 description: New reservation status
 *     responses:
 *       200:
 *         description: Reservation status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Reservation'
 *                 message:
 *                   type: string
 *       400:
 *         description: Status is required
 *       404:
 *         description: Reservation not found
 */
router.patch('/:id/status', authenticate, reservationController.updateReservationStatus);

/**
 * @swagger
 * /api/reservations/{id}:
 *   delete:
 *     summary: Delete reservation
 *     tags: [Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reservation ID
 *     responses:
 *       200:
 *         description: Reservation deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Reservation not found
 */
router.delete('/:id', authenticate, reservationController.deleteReservation);

export default router; 