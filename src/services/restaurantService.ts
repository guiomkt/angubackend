import { supabase } from '../config/database';
import { Restaurant, ApiResponse, PaginatedResponse } from '../types';
import { createError } from '../middleware/errorHandler';

export class RestaurantService {
  async getAllRestaurants(page: number = 1, limit: number = 10): Promise<PaginatedResponse<Restaurant>> {
    try {
      const offset = (page - 1) * limit;

      const { data, error, count } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

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
      throw createError(`Failed to fetch restaurants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRestaurantById(id: string): Promise<ApiResponse<Restaurant>> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw createError(error.message, 404);

      return {
        success: true,
        data
      };
    } catch (error) {
      throw createError(`Failed to fetch restaurant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRestaurantByUserId(userId: string): Promise<ApiResponse<Restaurant>> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw createError(error.message, 404);

      return {
        success: true,
        data
      };
    } catch (error) {
      throw createError(`Failed to fetch restaurant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createRestaurant(restaurantData: Partial<Restaurant>): Promise<ApiResponse<Restaurant>> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .insert([restaurantData])
        .select()
        .single();

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data,
        message: 'Restaurant created successfully'
      };
    } catch (error) {
      throw createError(`Failed to create restaurant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateRestaurant(id: string, restaurantData: Partial<Restaurant>): Promise<ApiResponse<Restaurant>> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .update({ ...restaurantData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw createError(error.message, 400)
      }

      return {
        success: true,
        data,
        message: 'Restaurant updated successfully'
      };
    } catch (error) {
      throw createError(`Failed to update restaurant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteRestaurant(id: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', id);

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        message: 'Restaurant deleted successfully'
      };
    } catch (error) {
      throw createError(`Failed to delete restaurant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateOnboardingStatus(id: string, completed: boolean, step: number): Promise<ApiResponse<Restaurant>> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .update({
          onboarding_completed: completed,
          onboarding_step: step,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data,
        message: 'Onboarding status updated successfully'
      };
    } catch (error) {
      throw createError(`Failed to update onboarding status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new RestaurantService(); 