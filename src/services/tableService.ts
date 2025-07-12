import { supabase } from '../config/database';
import { Table, TableWithArea, TableStatusHistory } from '../types';

export class TableService {
  /**
   * Get all tables for a restaurant with area information
   */
  static async getTablesByRestaurant(restaurantId: string): Promise<TableWithArea[]> {
    const { data, error } = await supabase
      .from('tables')
      .select(`
        *,
        area:restaurant_areas(*)
      `)
      .eq('restaurant_id', restaurantId)
      .order('number', { ascending: true });

    if (error) {
      throw new Error(`Error fetching tables: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tables by area
   */
  static async getTablesByArea(areaId: string): Promise<TableWithArea[]> {
    const { data, error } = await supabase
      .from('tables')
      .select(`
        *,
        area:restaurant_areas(*)
      `)
      .eq('area_id', areaId)
      .order('number', { ascending: true });

    if (error) {
      throw new Error(`Error fetching tables: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single table by ID
   */
  static async getTableById(id: string): Promise<TableWithArea | null> {
    const { data, error } = await supabase
      .from('tables')
      .select(`
        *,
        area:restaurant_areas(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching table: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new table
   */
  static async createTable(tableData: Omit<Table, 'id' | 'created_at' | 'updated_at'>): Promise<TableWithArea> {
    // Get the highest table number in the area
    const { data: maxNumberData } = await supabase
      .from('tables')
      .select('number')
      .eq('restaurant_id', tableData.restaurant_id)
      .eq('area_id', tableData.area_id)
      .order('number', { ascending: false })
      .limit(1);

    const nextNumber = maxNumberData && maxNumberData.length > 0 ? maxNumberData[0].number + 1 : 1;

    const { data, error } = await supabase
      .from('tables')
      .insert({
        ...tableData,
        number: nextNumber
      })
      .select(`
        *,
        area:restaurant_areas(*)
      `)
      .single();

    if (error) {
      throw new Error(`Error creating table: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a table
   */
  static async updateTable(id: string, tableData: Partial<Table>): Promise<TableWithArea> {
    const { data, error } = await supabase
      .from('tables')
      .update({
        ...tableData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        area:restaurant_areas(*)
      `)
      .single();

    if (error) {
      throw new Error(`Error updating table: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a table
   */
  static async deleteTable(id: string): Promise<void> {
    // Check if table has active reservations
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id')
      .eq('table_id', id)
      .in('status', ['pending', 'confirmed']);

    if (reservationsError) {
      throw new Error(`Error checking reservations: ${reservationsError.message}`);
    }

    if (reservations && reservations.length > 0) {
      throw new Error('Cannot delete table with active reservations');
    }

    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting table: ${error.message}`);
    }
  }

  /**
   * Change table status
   */
  static async changeTableStatus(
    id: string, 
    newStatus: Table['status'], 
    notes?: string,
    changedBy?: string
  ): Promise<TableWithArea> {
    // Get current table status
    const { data: currentTable } = await supabase
      .from('tables')
      .select('status')
      .eq('id', id)
      .single();

    const previousStatus = currentTable?.status || 'unknown';

    // Update table status
    const { data, error } = await supabase
      .from('tables')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        area:restaurant_areas(*)
      `)
      .single();

    if (error) {
      throw new Error(`Error updating table status: ${error.message}`);
    }

    // Record status change in history
    await this.recordStatusChange(id, previousStatus, newStatus, notes, changedBy);

    return data;
  }

  /**
   * Update table position
   */
  static async updateTablePosition(id: string, positionX: number, positionY: number): Promise<TableWithArea> {
    const { data, error } = await supabase
      .from('tables')
      .update({
        position_x: positionX,
        position_y: positionY,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        area:restaurant_areas(*)
      `)
      .single();

    if (error) {
      throw new Error(`Error updating table position: ${error.message}`);
    }

    return data;
  }

  /**
   * Record status change in history
   */
  private static async recordStatusChange(
    tableId: string,
    previousStatus: string,
    newStatus: string,
    notes?: string,
    changedBy?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('table_status_history')
      .insert({
        table_id: tableId,
        previous_status: previousStatus,
        new_status: newStatus,
        changed_by: changedBy,
        notes: notes,
        changed_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error recording status change:', error);
    }
  }

  /**
   * Get table statistics
   */
  static async getTableStats(restaurantId: string): Promise<any> {
    const { data: tables, error } = await supabase
      .from('tables')
      .select('status, capacity, is_active')
      .eq('restaurant_id', restaurantId);

    if (error) {
      throw new Error(`Error fetching table stats: ${error.message}`);
    }

    const totalTables = tables?.length || 0;
    const activeTables = tables?.filter(t => t.is_active).length || 0;
    const availableTables = tables?.filter(t => t.is_active && t.status === 'available').length || 0;
    const occupiedTables = tables?.filter(t => t.is_active && t.status === 'occupied').length || 0;
    const reservedTables = tables?.filter(t => t.is_active && t.status === 'reserved').length || 0;
    const blockedTables = tables?.filter(t => t.is_active && t.status === 'blocked').length || 0;
    const totalCapacity = tables?.reduce((sum, t) => sum + t.capacity, 0) || 0;
    const occupiedCapacity = tables
      ?.filter(t => t.is_active && (t.status === 'occupied' || t.status === 'reserved'))
      .reduce((sum, t) => sum + t.capacity, 0) || 0;

    return {
      totalTables,
      activeTables,
      availableTables,
      occupiedTables,
      reservedTables,
      blockedTables,
      totalCapacity,
      occupiedCapacity,
      occupationPercentage: totalCapacity > 0 ? Math.round((occupiedCapacity / totalCapacity) * 100) : 0
    };
  }

  /**
   * Get table status history
   */
  static async getTableStatusHistory(tableId: string): Promise<TableStatusHistory[]> {
    const { data, error } = await supabase
      .from('table_status_history')
      .select('*')
      .eq('table_id', tableId)
      .order('changed_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching table status history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get occupied tables for a restaurant
   */
  static async getOccupiedTables(restaurantId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('tables')
      .select('id, status')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'occupied');

    if (error) {
      throw new Error(`Error fetching occupied tables: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get weekly occupancy data for a restaurant
   */
  static async getWeeklyOccupancy(restaurantId: string): Promise<any[]> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);

    const todayFormatted = today.toISOString().split('T')[0];
    const startDateFormatted = startDate.toISOString().split('T')[0];

    const { count, error } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .gte('reservation_date', startDateFormatted)
      .lte('reservation_date', todayFormatted)
      .eq('status', 'confirmed');

    if (error) {
      throw new Error(`Error fetching weekly occupancy: ${error.message}`);
    }

    return [
      {
        date: todayFormatted,
        percentage: (count || 0) / 7,
        total_tables: 7,
        occupied_tables: count || 0,
      },
    ];
  }
} 