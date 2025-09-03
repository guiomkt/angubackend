import { Router } from 'express';
import { authenticate, requireRestaurant } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Bonification:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - rules
 *         - status
 *         - restaurant_id
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único da bonificação
 *         name:
 *           type: string
 *           description: Nome da bonificação
 *         description:
 *           type: string
 *           description: Descrição detalhada da bonificação
 *         rules:
 *           type: string
 *           description: Regras e condições para aplicação da bonificação
 *         observation:
 *           type: string
 *           description: Observações internas para a equipe
 *         status:
 *           type: boolean
 *           description: Status ativo/inativo da bonificação
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *           description: ID do restaurante
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data de criação
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização
 *     
 *     Event:
 *       type: object
 *       required:
 *         - name
 *         - restaurant_id
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único do evento
 *         name:
 *           type: string
 *           description: Nome do evento
 *         description:
 *           type: string
 *           description: Descrição do evento
 *         init_date:
 *           type: string
 *           format: date
 *           description: Data de início do evento
 *         end_date:
 *           type: string
 *           format: date
 *           description: Data de fim do evento
 *         init_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Horário de início do evento
 *         end_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Horário de fim do evento
 *         link_event:
 *           type: string
 *           format: uri
 *           description: Link externo para o evento
 *         code:
 *           type: string
 *           description: Código único do evento
 *         percentage_discount:
 *           type: string
 *           description: Percentual de desconto oferecido
 *         recurrence_type:
 *           type: string
 *           enum: [SEMANAL, MENSAL, ANUAL]
 *           description: Tipo de recorrência do evento
 *         day_recurrence:
 *           type: object
 *           description: Configuração da recorrência (dia da semana, dia do mês, etc.)
 *         rules:
 *           type: string
 *           description: Regras e condições do evento
 *         observation:
 *           type: string
 *           description: Observações internas
 *         status:
 *           type: boolean
 *           description: Status ativo/inativo do evento
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *           description: ID do restaurante
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data de criação
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização
 *     
 *     EventExclusive:
 *       type: object
 *       required:
 *         - name
 *         - restaurant_id
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único do evento exclusivo
 *         name:
 *           type: string
 *           description: Nome do evento exclusivo
 *         description:
 *           type: string
 *           description: Descrição detalhada do evento
 *         rules:
 *           type: string
 *           description: Regras e condições específicas
 *         observation:
 *           type: string
 *           description: Observações internas para a equipe
 *         status:
 *           type: boolean
 *           description: Status ativo/inativo (disponível para reservas)
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *           description: ID do restaurante
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data de criação
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização
 *     
 *     BlockedDate:
 *       type: object
 *       required:
 *         - restaurant_id
 *         - area_id
 *         - init_date
 *         - end_date
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único da data bloqueada
 *         restaurant_id:
 *           type: string
 *           format: uuid
 *           description: ID do restaurante
 *         area_id:
 *           type: string
 *           format: uuid
 *           description: ID da área do restaurante
 *         init_date:
 *           type: string
 *           format: date
 *           description: Data de início do bloqueio
 *         end_date:
 *           type: string
 *           format: date
 *           description: Data de fim do bloqueio
 *         init_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Horário de início do bloqueio (opcional)
 *         end_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Horário de fim do bloqueio (opcional)
 *         reason:
 *           type: string
 *           description: Motivo do bloqueio
 *         is_full_day:
 *           type: boolean
 *           default: true
 *           description: Se bloqueia o dia inteiro
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data de criação
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização
 *     
 *     ExperienceEvents:
 *       type: object
 *       properties:
 *         bonifications:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Bonification'
 *           description: Lista de bonificações
 *         events:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Event'
 *           description: Lista de eventos
 *         events_exclusive:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/EventExclusive'
 *           description: Lista de eventos exclusivos
 *     
 *     CreateBonificationRequest:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - rules
 *       properties:
 *         name:
 *           type: string
 *           description: Nome da bonificação
 *         description:
 *           type: string
 *           description: Descrição da bonificação
 *         rules:
 *           type: string
 *           description: Regras e condições
 *         observation:
 *           type: string
 *           description: Observações internas
 *         status:
 *           type: boolean
 *           default: false
 *           description: Status ativo/inativo
 *     
 *     CreateEventRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: Nome do evento
 *         description:
 *           type: string
 *           description: Descrição do evento
 *         init_date:
 *           type: string
 *           format: date
 *           description: Data de início
 *         end_date:
 *           type: string
 *           format: date
 *           description: Data de fim
 *         init_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Horário de início
 *         end_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Horário de fim
 *         link_event:
 *           type: string
 *           format: uri
 *           description: Link externo
 *         code:
 *           type: string
 *           description: Código do evento
 *         percentage_discount:
 *           type: string
 *           description: Percentual de desconto
 *         recurrence_type:
 *           type: string
 *           enum: [SEMANAL, MENSAL, ANUAL]
 *           description: Tipo de recorrência
 *         day_recurrence:
 *           type: object
 *           description: Configuração da recorrência
 *         rules:
 *           type: string
 *           description: Regras e condições
 *         observation:
 *           type: string
 *           description: Observações internas
 *         status:
 *           type: boolean
 *           default: true
 *           description: Status ativo/inativo
 *     
 *     CreateEventExclusiveRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: Nome do evento exclusivo
 *         description:
 *           type: string
 *           description: Descrição do evento
 *         rules:
 *           type: string
 *           description: Regras e condições
 *         observation:
 *           type: string
 *           description: Observações internas
 *         status:
 *           type: boolean
 *           default: true
 *           description: Status ativo/inativo
 *     
 *     UpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Nome atualizado
 *         description:
 *           type: string
 *           description: Descrição atualizada
 *         rules:
 *           type: string
 *           description: Regras atualizadas
 *         observation:
 *           type: string
 *           description: Observações atualizadas
 *         status:
 *           type: boolean
 *           description: Status atualizado
 *         # Para eventos, incluir campos específicos
 *         init_date:
 *           type: string
 *           format: date
 *         end_date:
 *           type: string
 *           format: date
 *         init_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         end_time:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         link_event:
 *           type: string
 *           format: uri
 *         code:
 *           type: string
 *         percentage_discount:
 *           type: string
 *         recurrence_type:
 *           type: string
 *           enum: [SEMANAL, MENSAL, ANUAL]
 *         day_recurrence:
 *           type: object
 *     
 *     ApiResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Indica se a operação foi bem-sucedida
 *         data:
 *           description: Dados retornados pela operação
 *         message:
 *           type: string
 *           description: Mensagem de sucesso
 *         error:
 *           type: string
 *           description: Mensagem de erro
 *     
 *     PaginatedResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ApiResponse'
 *         - type: object
 *           properties:
 *             pagination:
 *               type: object
 *               properties:
 *                 page:
 *                   type: number
 *                   description: Página atual
 *                 limit:
 *                   type: number
 *                   description: Itens por página
 *                 total:
 *                   type: number
 *                   description: Total de itens
 *                 totalPages:
 *                   type: number
 *                   description: Total de páginas
 */

/**
 * @swagger
 * /api/experience/events:
 *   get:
 *     summary: Get all experience events for current restaurant
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of experience events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ExperienceEvents'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       500:
 *         description: Internal server error
 */
router.get('/events', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;

    const [bonifications, events, events_exclusive] = await Promise.all([
      supabase
        .from("experience_bonifications")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .eq("status", true),
      supabase
        .from("experience_events")
        .select("id, name")
        .eq("restaurant_id", restaurantId),
      supabase
        .from("experience_events_exclusives")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .eq("status", true),
    ]);

    const experiences = {
      bonifications: bonifications.data || [],
      events: events.data || [],
      events_exclusive: events_exclusive.data || [],
    };

    return res.json({
      success: true,
      data: experiences
    });
  } catch (error) {
    console.error('Error fetching experiences:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/experience/blocked-dates:
 *   get:
 *     summary: Get blocked dates for current restaurant
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of blocked dates
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
 *                     $ref: '#/components/schemas/BlockedDate'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       500:
 *         description: Internal server error
 */
router.get('/blocked-dates', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from("bloqued_dates")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch blocked dates'
      });
    }

    return res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/experience/blocked-dates:
 *   post:
 *     summary: Create a new blocked date
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - area_id
 *               - init_date
 *               - end_date
 *             properties:
 *               area_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID da área do restaurante
 *               init_date:
 *                 type: string
 *                 format: date
 *                 description: Data de início do bloqueio
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: Data de fim do bloqueio
 *               init_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Horário de início (opcional, se não informado bloqueia o dia inteiro)
 *               end_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Horário de fim (opcional, se não informado bloqueia o dia inteiro)
 *               is_full_day:
 *                 type: boolean
 *                 default: true
 *                 description: Se bloqueia o dia inteiro
 *               reason:
 *                 type: string
 *                 description: Motivo do bloqueio
 *     responses:
 *       201:
 *         description: Blocked date created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BlockedDate'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       500:
 *         description: Internal server error
 */
router.post('/blocked-dates', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { area_id, init_date, end_date, init_time, end_time, reason, is_full_day = true } = req.body;

    const { data, error } = await supabase
      .from("bloqued_dates")
      .insert([{
        restaurant_id: restaurantId,
        area_id,
        init_date,
        end_date,
        init_time: is_full_day ? null : init_time,
        end_time: is_full_day ? null : end_time,
        reason,
        is_full_day
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/experience/blocked-dates/{id}:
 *   put:
 *     summary: Update a blocked date
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blocked date ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               area_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID da área do restaurante
 *               init_date:
 *                 type: string
 *                 format: date
 *                 description: Data de início do bloqueio
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: Data de fim do bloqueio
 *               init_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Horário de início (opcional, se não informado bloqueia o dia inteiro)
 *               end_time:
 *                 type: string
 *                 pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Horário de fim (opcional, se não informado bloqueia o dia inteiro)
 *               is_full_day:
 *                 type: boolean
 *                 default: true
 *                 description: Se bloqueia o dia inteiro
 *               reason:
 *                 type: string
 *                 description: Motivo do bloqueio
 *     responses:
 *       200:
 *         description: Blocked date updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/BlockedDate'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       404:
 *         description: Blocked date not found
 *       500:
 *         description: Internal server error
 */
router.put('/blocked-dates/:id', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { area_id, init_date, end_date, init_time, end_time, reason, is_full_day = true } = req.body;

    const { data, error } = await supabase
      .from("bloqued_dates")
      .update({
        area_id,
        init_date,
        end_date,
        init_time: is_full_day ? null : init_time,
        end_time: is_full_day ? null : end_time,
        reason,
        is_full_day,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/experience/blocked-dates/{id}:
 *   delete:
 *     summary: Delete a blocked date
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Blocked date ID
 *     responses:
 *       200:
 *         description: Blocked date deleted successfully
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
 *         description: Restaurant access required
 *       404:
 *         description: Blocked date not found
 *       500:
 *         description: Internal server error
 */
router.delete('/blocked-dates/:id', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from("bloqued_dates")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      message: 'Blocked date deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Experiences CRUD (bonifications, events, events_exclusive)
 */

/**
 * @swagger
 * /api/experience/bonifications:
 *   get:
 *     summary: Get all bonifications for current restaurant
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bonifications
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
 *                     $ref: '#/components/schemas/Bonification'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       500:
 *         description: Internal server error
 */
router.get('/bonifications', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_bonifications')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/bonifications:
 *   post:
 *     summary: Create a new bonification
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBonificationRequest'
 *     responses:
 *       201:
 *         description: Bonification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Bonification'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       500:
 *         description: Internal server error
 */
router.post('/bonifications', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const payload = { ...req.body, restaurant_id: restaurantId };
    const { data, error } = await supabase
      .from('experience_bonifications')
      .insert([payload])
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/bonifications/{id}:
 *   put:
 *     summary: Update a bonification
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bonification ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRequest'
 *     responses:
 *       200:
 *         description: Bonification updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Bonification'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       404:
 *         description: Bonification not found
 *       500:
 *         description: Internal server error
 */
router.put('/bonifications/:id', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_bonifications')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/bonifications/{id}:
 *   delete:
 *     summary: Delete a bonification
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Bonification ID
 *     responses:
 *       200:
 *         description: Bonification deleted successfully
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
 *         description: Restaurant access required
 *       404:
 *         description: Bonification not found
 *       500:
 *         description: Internal server error
 */
router.delete('/bonifications/:id', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { error } = await supabase
      .from('experience_bonifications')
      .delete()
      .eq("id", id)
      .eq('restaurant_id', restaurantId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/events/list:
 *   get:
 *     summary: Get all events for current restaurant
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of events
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
 *                     $ref: '#/components/schemas/Event'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       500:
 *         description: Internal server error
 */
router.get('/events/list', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID not found in user context' 
      });
    }

    const { data, error } = await supabase
      .from('experience_events')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
    
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEventRequest'
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       500:
 *         description: Internal server error
 */
router.post('/events', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID not found in user context' 
      });
    }

    // Limpar campos vazios para evitar problemas de validação
    const payload = { 
      ...req.body, 
      restaurant_id: restaurantId,
      // Garantir que campos opcionais sejam null se vazios
      day_recurrence: req.body.day_recurrence || null,
      description: req.body.description || null,
      rules: req.body.rules || null,
      observation: req.body.observation || null,
      link_event: req.body.link_event || null,
      code: req.body.code || null,
      percentage_discount: req.body.percentage_discount || "0",
      init_date: req.body.init_date || null,
      end_date: req.body.end_date || null,
      init_time: req.body.init_time || null,
      end_time: req.body.end_time || null,
      status: req.body.status !== undefined ? req.body.status : true
    };

    const { data, error } = await supabase
      .from('experience_events')
      .insert([payload])
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
    
    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/events/{id}:
 *   put:
 *     summary: Update an event
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRequest'
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal server error
 */
router.put('/events/:id', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    
    if (!restaurantId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Restaurant ID not found in user context' 
      });
    }

    // Limpar campos vazios para evitar problemas de validação
    const updateData = { 
      ...req.body,
      updated_at: new Date().toISOString(),
      // Garantir que campos opcionais sejam null se vazios
      day_recurrence: req.body.day_recurrence || null,
      description: req.body.description || null,
      rules: req.body.rules || null,
      observation: req.body.observation || null,
      link_event: req.body.link_event || null,
      code: req.body.code || null,
      percentage_discount: req.body.percentage_discount || "0",
      init_date: req.body.init_date || null,
      end_date: req.body.end_date || null,
      init_time: req.body.init_time || null,
      end_time: req.body.end_time || null
    };

    const { data, error } = await supabase
      .from('experience_events')
      .update(updateData)
      .eq("id", id)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
    
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
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
 *         description: Restaurant access required
 *       404:
 *         description: Event not found
 *       500:
 *         description: Internal server error
 */
router.delete('/events/:id', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { error } = await supabase
      .from('experience_events')
      .delete()
      .eq("id", id)
      .eq('restaurant_id', restaurantId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/events-exclusive:
 *   get:
 *     summary: Get all exclusive events for current restaurant
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of exclusive events
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
 *                     $ref: '#/components/schemas/EventExclusive'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       500:
 *         description: Internal server error
 */
router.get('/events-exclusive', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_events_exclusives')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/events-exclusive:
 *   post:
 *     summary: Create a new exclusive event
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEventExclusiveRequest'
 *     responses:
 *       201:
 *         description: Exclusive event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/EventExclusive'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       500:
 *         description: Internal server error
 */
router.post('/events-exclusive', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const payload = { ...req.body, restaurant_id: restaurantId };
    const { data, error } = await supabase
      .from('experience_events_exclusives')
      .insert([payload])
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/events-exclusive/{id}:
 *   put:
 *     summary: Update an exclusive event
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Exclusive event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRequest'
 *     responses:
 *       200:
 *         description: Exclusive event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/EventExclusive'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Restaurant access required
 *       404:
 *         description: Exclusive event not found
 *       500:
 *         description: Internal server error
 */
router.put('/events-exclusive/:id', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { data, error } = await supabase
      .from('experience_events_exclusives')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq('restaurant_id', restaurantId)
      .select('*')
      .single();

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/experience/events-exclusive/{id}:
 *   delete:
 *     summary: Delete an exclusive event
 *     tags: [Experience]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Exclusive event ID
 *     responses:
 *       200:
 *         description: Exclusive event deleted successfully
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
 *         description: Restaurant access required
 *       404:
 *         description: Exclusive event not found
 *       500:
 *         description: Internal server error
 */
router.delete('/events-exclusive/:id', authenticate, requireRestaurant, async (req: any, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.user?.restaurant_id;
    const { error } = await supabase
      .from('experience_events_exclusives')
      .delete()
      .eq("id", id)
      .eq('restaurant_id', restaurantId);

    if (error) return res.status(400).json({ success: false, error: error.message });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router; 