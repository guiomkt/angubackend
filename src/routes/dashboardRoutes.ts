import { Router } from 'express';
import { authenticateToken, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../config/database';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardStats:
 *       type: object
 *       properties:
 *         reservations:
 *           type: object
 *           properties:
 *             today: { type: number }
 *             upcoming: { type: number }
 *             total: { type: number }
 *         tables:
 *           type: object
 *           properties:
 *             total: { type: number }
 *             occupied: { type: number }
 *             available: { type: number }
 *             reserved: { type: number }
 *         customers:
 *           type: object
 *           properties:
 *             today: { type: number }
 *             yesterday: { type: number }
 *             total: { type: number }
 *         waitingList:
 *           type: object
 *           properties:
 *             waiting: { type: number }
 *             notified: { type: number }
 *             seated: { type: number }
 *         revenue:
 *           type: object
 *           properties:
 *             today: { type: number }
 *             week: { type: number }
 *             month: { type: number }
 */

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 */
router.get('/stats', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [
      todayReservations,
      upcomingReservations,
      totalReservations,
      tableStats,
      todayCustomers,
      yesterdayCustomers,
      totalCustomers,
      waitingListStats,
      weeklyOccupancy
    ] = await Promise.all([
      // Reservas de hoje
      supabase
        .from('reservations')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .eq('reservation_date', today),

      // Próximas reservas (7 dias)
      supabase
        .from('reservations')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .gte('reservation_date', today)
        .lte('reservation_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),

      // Total de reservas
      supabase
        .from('reservations')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId),

      // Estatísticas das mesas
      supabase
        .from('tables')
        .select('status')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true),

      // Clientes de hoje
      supabase
        .from('chat_contacts')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', today),

      // Clientes de ontem
      supabase
        .from('chat_contacts')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', yesterday)
        .lt('created_at', today),

      // Total de clientes
      supabase
        .from('chat_contacts')
        .select('id', { count: 'exact' })
        .eq('restaurant_id', restaurantId),

      // Lista de espera
      supabase
        .from('waiting_lists')
        .select('status')
        .eq('restaurant_id', restaurantId),

      // Ocupação semanal
      supabase
        .from('tables')
        .select('status')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
    ]);

    // Processar estatísticas das mesas
    const tableStatusCounts = tableStats.data?.reduce((acc, table) => {
      acc[table.status] = (acc[table.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Processar estatísticas da lista de espera
    const waitingStatusCounts = waitingListStats.data?.reduce((acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const stats = {
      reservations: {
        today: todayReservations.count || 0,
        upcoming: upcomingReservations.count || 0,
        total: totalReservations.count || 0
      },
      tables: {
        total: tableStats.data?.length || 0,
        occupied: tableStatusCounts.occupied || 0,
        available: tableStatusCounts.available || 0,
        reserved: tableStatusCounts.reserved || 0,
        blocked: tableStatusCounts.blocked || 0
      },
      customers: {
        today: todayCustomers.count || 0,
        yesterday: yesterdayCustomers.count || 0,
        total: totalCustomers.count || 0
      },
      waitingList: {
        waiting: waitingStatusCounts.waiting || 0,
        notified: waitingStatusCounts.notified || 0,
        seated: waitingStatusCounts.seated || 0,
        no_show: waitingStatusCounts.no_show || 0
      },
      occupancy: {
        current: ((tableStatusCounts.occupied || 0) / (tableStats.data?.length || 1)) * 100,
        weekly: weeklyOccupancy.data?.length ? 
          weeklyOccupancy.data.filter(t => t.status === 'occupied').length / weeklyOccupancy.data.length * 100 : 0
      }
    };

return res.json({
      success: true,
      data: stats
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
 * /api/dashboard/recent-activity:
 *   get:
 *     summary: Get recent activity
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of activities to return
 *     responses:
 *       200:
 *         description: Recent activity
 */
router.get('/recent-activity', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const limit = parseInt(req.query.limit as string) || 10;

    const [recentReservations, recentCustomers, recentTables] = await Promise.all([
      // Reservas recentes
      supabase
        .from('reservations')
        .select(`
          id,
          customer_name,
          reservation_date,
          start_time,
          status,
          created_at
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Clientes recentes
      supabase
        .from('chat_contacts')
        .select(`
          id,
          name,
          phone_number,
          created_at
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Mudanças de status das mesas
      supabase
        .from('table_status_history')
        .select(`
          id,
          table_id,
          previous_status,
          new_status,
          changed_at,
          notes
        `)
        .eq('restaurant_id', restaurantId)
        .order('changed_at', { ascending: false })
        .limit(limit)
    ]);

    const activity = {
      reservations: recentReservations.data || [],
      customers: recentCustomers.data || [],
      tableChanges: recentTables.data || []
    };

return res.json({
      success: true,
      data: activity
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
 * /api/dashboard/charts:
 *   get:
 *     summary: Get chart data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *           default: week
 *         description: Time period for chart data
 *     responses:
 *       200:
 *         description: Chart data
 */
router.get('/charts', authenticateToken, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user?.restaurant_id;
    const period = req.query.period as string || 'week';

    let startDate: string;
    const endDate = new Date().toISOString().split('T')[0];

    switch (period) {
      case 'week':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'month':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'year':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    const [reservationsByDate, customersByDate, tableOccupancy] = await Promise.all([
      // Reservas por data
      supabase
        .from('reservations')
        .select('reservation_date, status')
        .eq('restaurant_id', restaurantId)
        .gte('reservation_date', startDate)
        .lte('reservation_date', endDate),

      // Clientes por data
      supabase
        .from('chat_contacts')
        .select('created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate),

      // Ocupação das mesas por data
      supabase
        .from('table_status_history')
        .select('changed_at, new_status')
        .eq('restaurant_id', restaurantId)
        .gte('changed_at', startDate)
        .lte('changed_at', endDate)
    ]);

    // Processar dados para gráficos
    const processDataByDate = (data: any[], dateField: string) => {
      const grouped = data.reduce((acc, item) => {
        const date = item[dateField].split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(grouped).map(([date, count]) => ({
        date,
        count
      })).sort((a, b) => a.date.localeCompare(b.date));
    };

    const charts = {
      reservations: processDataByDate(reservationsByDate.data || [], 'reservation_date'),
      customers: processDataByDate(customersByDate.data || [], 'created_at'),
      occupancy: processDataByDate(tableOccupancy.data || [], 'changed_at')
    };

return res.json({
      success: true,
      data: charts
    });
  } catch (error) {
return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router; 