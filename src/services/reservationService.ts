import { supabase } from '../config/database';
import { Reservation, ApiResponse, PaginatedResponse } from '../types';
import { createError } from '../middleware/errorHandler';
import moment from 'moment';

export class ReservationService {
  async getReservationsByRestaurant(
    restaurantId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      date?: string;
      status?: string;
      area_id?: string;
      table_id?: string;
    }
  ): Promise<PaginatedResponse<Reservation>> {
    try {
      const offset = (page - 1) * limit;
      let query = supabase
        .from('reservations')
        .select(`
          *,
          table:tables(name, id),
          area:restaurant_areas(name, id)
        `, { count: 'exact' })
        .eq('restaurant_id', restaurantId);

      // Apply filters
      if (filters?.date) {
        query = query.eq('reservation_date', filters.date);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.area_id) {
        query = query.eq('area_id', filters.area_id);
      }
      if (filters?.table_id) {
        query = query.eq('table_id', filters.table_id);
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('reservation_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw createError(error.message, 400);

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: data || [],
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      throw createError(`Failed to fetch reservations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTodayReservations(restaurantId: string): Promise<ApiResponse<Reservation[]>> {
    try {
      const today = moment().format('YYYY-MM-DD');

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          table:tables(name, id),
          area:restaurant_areas(name, id)
        `)
        .eq('restaurant_id', restaurantId)
        .eq('reservation_date', today)
        .order('start_time', { ascending: true });

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      throw createError(`Failed to fetch today's reservations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUpcomingReservations(restaurantId: string, days: number = 7): Promise<ApiResponse<Reservation[]>> {
    try {
      const today = moment().format('YYYY-MM-DD');
      const endDate = moment().add(days, 'days').format('YYYY-MM-DD');

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          table:tables(name, id),
          area:restaurant_areas(name, id)
        `)
        .eq('restaurant_id', restaurantId)
        .gte('reservation_date', today)
        .lte('reservation_date', endDate)
        .in('status', ['pending', 'confirmed'])
        .order('reservation_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      throw createError(`Failed to fetch upcoming reservations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getReservationById(id: string): Promise<ApiResponse<Reservation>> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          table:tables(name, id),
          area:restaurant_areas(name, id)
        `)
        .eq('id', id)
        .single();

      if (error) throw createError(error.message, 404);

      return {
        success: true,
        data
      };
    } catch (error) {
      throw createError(`Failed to fetch reservation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createReservation(reservationData: Partial<Reservation>): Promise<ApiResponse<Reservation>> {
    try {
      // Check for conflicts
      if (reservationData.table_id && reservationData.reservation_date && reservationData.start_time) {
        const conflict = await this.checkTableConflict(
          reservationData.table_id,
          reservationData.reservation_date,
          reservationData.start_time
        );
        
        if (conflict) {
          throw createError('Table is already reserved for this time', 409);
        }
      }

      // Remove end_time from data since it doesn't exist in the table
      const { end_time, ...dataToInsert } = reservationData as any;

      const { data, error } = await supabase
        .from('reservations')
        .insert([dataToInsert])
        .select(`
          *,
          table:tables(name, id),
          area:restaurant_areas(name, id)
        `)
        .single();

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data,
        message: 'Reservation created successfully'
      };
    } catch (error) {
      throw createError(`Failed to create reservation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateReservation(id: string, reservationData: Partial<Reservation>): Promise<ApiResponse<Reservation>> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .update({ ...reservationData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(`
          *,
          table:tables(name, id),
          area:restaurant_areas(name, id)
        `)
        .single();

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data,
        message: 'Reservation updated successfully'
      };
    } catch (error) {
      throw createError(`Failed to update reservation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteReservation(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        message: 'Reservation deleted successfully'
      };
    } catch (error) {
      throw createError(`Failed to delete reservation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateReservationStatus(id: string, status: string): Promise<ApiResponse<Reservation>> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select(`
          *,
          table:tables(name, id),
          area:restaurant_areas(name, id)
        `)
        .single();

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data,
        message: 'Reservation status updated successfully'
      };
    } catch (error) {
      throw createError(`Failed to update reservation status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async checkTableConflict(
    tableId: string,
    date: string,
    time: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('id')
        .eq('table_id', tableId)
        .eq('reservation_date', date)
        .eq('start_time', time)
        .in('status', ['pending', 'confirmed'])
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking table conflict:', error);
      return false;
    }
  }
}

export default new ReservationService(); 