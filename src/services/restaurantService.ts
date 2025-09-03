import { supabase } from '../config/database';
import { Restaurant, ApiResponse, PaginatedResponse, RestaurantSettingsResponse, AISettings, NotificationSettings } from '../types';
import { createError } from '../middleware/errorHandler';

class RestaurantService {
  async createRestaurant(restaurantData: Partial<Restaurant>): Promise<Restaurant> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .insert([{ ...restaurantData, created_at: new Date().toISOString() }])
        .select()
        .single();

      if (error) throw createError(error.message, 400);
      if (!data) throw createError('Failed to create restaurant', 500);

      return data;
    } catch (error) {
      throw createError(`Failed to create restaurant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRestaurantById(id: string): Promise<Restaurant> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw createError(error.message, 400);
      if (!data) throw createError('Restaurant not found', 404);

      return data;
    } catch (error) {
      throw createError(`Failed to fetch restaurant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRestaurantByUserId(userId: string): Promise<Restaurant | null> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No restaurant found for this user
          return null;
        }
        throw createError(error.message, 400);
      }

      return data;
    } catch (error) {
      throw createError(`Failed to fetch restaurant by user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllRestaurants(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedResponse<Restaurant>> {
    try {
      let query = supabase.from('restaurants').select('*', { count: 'exact' });

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const offset = (page - 1) * limit;
      
      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('name');

      if (error) throw createError(error.message, 400);

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        success: true,
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages
        }
      };
    } catch (error) {
      throw createError(`Failed to fetch restaurants: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateRestaurant(id: string, restaurantData: Partial<Restaurant>): Promise<Restaurant> {
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .update({ ...restaurantData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw createError(error.message, 400);
      if (!data) throw createError('Restaurant not found', 404);

      return data;
    } catch (error) {
      throw createError(`Failed to update restaurant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteRestaurant(id: string): Promise<ApiResponse> {
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

  async getRestaurantStats(id: string): Promise<ApiResponse<any>> {
    try {
      // Placeholder para estatísticas (implementar conforme necessário)
      const stats = {
        reservations: {
          total: 0,
          upcoming: 0,
          today: 0
        },
        tables: {
          total: 0,
          available: 0,
          occupied: 0
        },
        revenue: {
          today: 0,
          weekly: 0,
          monthly: 0
        },
        customers: {
          total: 0,
          new: 0,
          returning: 0
        }
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      throw createError(`Failed to fetch restaurant stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getRestaurantSettings(restaurantId: string): Promise<ApiResponse<RestaurantSettingsResponse>> {
    try {
      // Buscar restaurante
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (error) throw createError(error.message, 400);
      if (!restaurant) throw createError('Restaurant not found', 404);

      // Buscar configurações de IA (opcional)
      let aiSettings = null;
      try {
        const { data: aiData } = await supabase
          .from('ai_settings')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();
        aiSettings = aiData;
      } catch (aiError) {
        // Ignorar erro, tabela pode não existir
      }

      // Buscar configurações de notificação (opcional)
      let notificationSettings = null;
      try {
        const { data: notificationData } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();
        notificationSettings = notificationData;
      } catch (notificationError) {
        // Ignorar erro, tabela pode não existir
      }

      // Buscar usuários (opcional)
      let users = [];
      try {
        const { data: usersData } = await supabase
          .from('users_profile')
          .select('*')
          .eq('restaurant_id', restaurantId);
        users = usersData || [];
      } catch (usersError) {
        // Ignorar erro, tabela pode não existir
      }

      return {
        success: true,
        data: {
          restaurant,
          ai_settings: aiSettings,
          notification_settings: notificationSettings,
          users
        }
      };
    } catch (error) {
      throw createError(`Failed to fetch restaurant settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateRestaurantSettings(
    restaurantId: string, 
    updates: {
      restaurant?: Partial<Restaurant>;
      ai_settings?: Partial<AISettings>;
      notification_settings?: Partial<NotificationSettings>;
    }
  ): Promise<ApiResponse<RestaurantSettingsResponse>> {
    try {
      const updatesPromises = [];

      // Atualizar restaurante
      if (updates.restaurant) {
        updatesPromises.push(
          supabase
            .from('restaurants')
            .update({ ...updates.restaurant, updated_at: new Date().toISOString() })
            .eq('id', restaurantId)
            .select()
            .single()
        );
      }

      // Atualizar configurações de IA
      if (updates.ai_settings) {
        updatesPromises.push(
          supabase
            .from('ai_settings')
            .upsert({ ...updates.ai_settings, restaurant_id: restaurantId, updated_at: new Date().toISOString() })
            .select()
            .single()
        );
      }

      // Atualizar configurações de notificação
      if (updates.notification_settings) {
        updatesPromises.push(
          supabase
            .from('notification_settings')
            .upsert({ ...updates.notification_settings, restaurant_id: restaurantId, updated_at: new Date().toISOString() })
            .select()
            .single()
        );
      }

      // Executar todas as atualizações
      const results = await Promise.all(updatesPromises);
      
      // Verificar erros
      for (const result of results) {
        if (result.error) throw createError(result.error.message, 400);
      }

      // Buscar configurações atualizadas
      const updatedSettings = await this.getRestaurantSettings(restaurantId);

      return {
        success: true,
        data: updatedSettings.data!,
        message: 'Restaurant settings updated successfully'
      };
    } catch (error) {
      throw createError(`Failed to update restaurant settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadRestaurantLogo(restaurantId: string, logoFile: Express.Multer.File): Promise<ApiResponse<{ logo_url: string }>> {
    try {
      // TODO: Implementar upload para storage (Supabase Storage ou serviço externo)
      // Por enquanto, retornar URL mock
      const logoUrl = `https://example.com/logos/${restaurantId}/${Date.now()}.jpg`;

      // Atualizar restaurante com nova URL do logo
      const { error } = await supabase
        .from('restaurants')
        .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq('id', restaurantId);

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data: { logo_url: logoUrl },
        message: 'Logo uploaded successfully'
      };
    } catch (error) {
      throw createError(`Failed to upload logo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new RestaurantService(); 