import { supabase } from '../config/database';
import { RestaurantArea } from '../types';

export class AreaService {
  /**
   * Get all areas for a restaurant
   */
  static async getAreasByRestaurant(restaurantId: string): Promise<RestaurantArea[]> {
    const { data, error } = await supabase
      .from('restaurant_areas')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('order', { ascending: true });

    if (error) {
      throw new Error(`Error fetching areas: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single area by ID
   */
  static async getAreaById(id: string): Promise<RestaurantArea | null> {
    const { data, error } = await supabase
      .from('restaurant_areas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching area: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new area
   */
  static async createArea(areaData: Omit<RestaurantArea, 'id' | 'created_at' | 'updated_at'>): Promise<RestaurantArea> {
    // Get the highest order number for this restaurant
    const { data: maxOrderData } = await supabase
      .from('restaurant_areas')
      .select('order')
      .eq('restaurant_id', areaData.restaurant_id)
      .order('order', { ascending: false })
      .limit(1);

    const nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].order + 1 : 0;

    const { data, error } = await supabase
      .from('restaurant_areas')
      .insert({
        ...areaData,
        order: nextOrder
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating area: ${error.message}`);
    }

    return data;
  }

  /**
   * Update an area
   */
  static async updateArea(id: string, areaData: Partial<RestaurantArea>): Promise<RestaurantArea> {
    const { data, error } = await supabase
      .from('restaurant_areas')
      .update({
        ...areaData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating area: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete an area
   */
  static async deleteArea(id: string): Promise<void> {
    // Check if area has tables
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id')
      .eq('area_id', id);

    if (tablesError) {
      throw new Error(`Error checking tables: ${tablesError.message}`);
    }

    if (tables && tables.length > 0) {
      throw new Error('Cannot delete area with existing tables');
    }

    const { error } = await supabase
      .from('restaurant_areas')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting area: ${error.message}`);
    }
  }

  /**
   * Reorder areas
   */
  static async reorderAreas(restaurantId: string, areaIds: string[]): Promise<void> {
    const updates = areaIds.map((id, index) => ({
      id,
      order: index
    }));

    const { error } = await supabase
      .from('restaurant_areas')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      throw new Error(`Error reordering areas: ${error.message}`);
    }
  }

  /**
   * Get area statistics
   */
  static async getAreaStats(restaurantId: string): Promise<any> {
    const { data: areas, error: areasError } = await supabase
      .from('restaurant_areas')
      .select(`
        id,
        name,
        max_capacity,
        max_tables,
        is_active,
        tables (
          id,
          status,
          capacity
        )
      `)
      .eq('restaurant_id', restaurantId);

    if (areasError) {
      throw new Error(`Error fetching area stats: ${areasError.message}`);
    }

    return areas?.map(area => {
      const tables = area.tables || [];
      const totalTables = tables.length;
      const availableTables = tables.filter(t => t.status === 'available').length;
      const occupiedTables = tables.filter(t => t.status === 'occupied').length;
      const reservedTables = tables.filter(t => t.status === 'reserved').length;
      const blockedTables = tables.filter(t => t.status === 'blocked').length;
      const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
      const occupiedCapacity = tables
        .filter(t => t.status === 'occupied' || t.status === 'reserved')
        .reduce((sum, t) => sum + t.capacity, 0);

      return {
        id: area.id,
        name: area.name,
        max_capacity: area.max_capacity,
        max_tables: area.max_tables,
        is_active: area.is_active,
        stats: {
          totalTables,
          availableTables,
          occupiedTables,
          reservedTables,
          blockedTables,
          totalCapacity,
          occupiedCapacity,
          occupationPercentage: totalCapacity > 0 ? Math.round((occupiedCapacity / totalCapacity) * 100) : 0
        }
      };
    }) || [];
  }
} 