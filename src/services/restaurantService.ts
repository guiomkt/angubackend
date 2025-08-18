import { supabase } from '../config/database';
import { Restaurant, ApiResponse, PaginatedResponse, RestaurantSettingsResponse, AISettings, NotificationSettings, WhatsAppAccountInfo } from '../types';
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

  async getRestaurantSettings(restaurantId: string): Promise<ApiResponse<RestaurantSettingsResponse>> {
    try {
      // Buscar restaurante
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single();

      if (restaurantError) {
        throw createError(restaurantError.message, 404);
      }

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

      // Buscar informações do WhatsApp (opcional)
      let whatsappAccountInfo = null;
      try {
        const { data: whatsappData } = await supabase
          .from('whatsapp_account_info')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .maybeSingle();
        whatsappAccountInfo = whatsappData;
      } catch (whatsappError) {
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
          whatsapp_account_info: whatsappAccountInfo,
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
      whatsapp_account_info?: Partial<WhatsAppAccountInfo>;
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

      // Atualizar informações da conta WhatsApp
      if (updates.whatsapp_account_info) {
        updatesPromises.push(
          supabase
            .from('whatsapp_account_info')
            .upsert({ ...updates.whatsapp_account_info, restaurant_id: restaurantId, updated_at: new Date().toISOString() })
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