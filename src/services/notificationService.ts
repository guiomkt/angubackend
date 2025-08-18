import { supabase } from '../config/database';
import { NotificationSettings, ApiResponse } from '../types';
import { createError } from '../middleware/errorHandler';

export class NotificationService {
  async getNotificationSettings(restaurantId: string): Promise<ApiResponse<NotificationSettings | null>> {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data: data || null
      };
    } catch (error) {
      throw createError(`Failed to fetch notification settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateNotificationSettings(restaurantId: string, settings: Partial<NotificationSettings['settings']>): Promise<ApiResponse<NotificationSettings>> {
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .upsert({
          restaurant_id: restaurantId,
          settings: settings,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data,
        message: 'Notification settings updated successfully'
      };
    } catch (error) {
      throw createError(`Failed to update notification settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createDefaultNotificationSettings(restaurantId: string): Promise<ApiResponse<NotificationSettings>> {
    try {
      const defaultSettings: NotificationSettings['settings'] = {
        email_notifications: true,
        sms_notifications: false,
        whatsapp_notifications: true,
        push_notifications: false,
        reservation_confirmation: true,
        reservation_reminder: true,
        waiting_list_notification: true,
        table_ready_notification: true,
        marketing_notifications: false,
        notification_timing: {
          reservation_reminder_hours: 24,
          table_ready_delay: 5
        }
      };

      const { data, error } = await supabase
        .from('notification_settings')
        .insert([{
          restaurant_id: restaurantId,
          settings: defaultSettings
        }])
        .select()
        .single();

      if (error) throw createError(error.message, 400);

      return {
        success: true,
        data,
        message: 'Default notification settings created successfully'
      };
    } catch (error) {
      throw createError(`Failed to create default notification settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async toggleNotificationType(restaurantId: string, notificationType: keyof NotificationSettings['settings'], enabled: boolean): Promise<ApiResponse<NotificationSettings>> {
    try {
      // Buscar configurações atuais
      const currentSettings = await this.getNotificationSettings(restaurantId);
      
      if (!currentSettings.data) {
        // Criar configurações padrão se não existirem
        await this.createDefaultNotificationSettings(restaurantId);
        const newSettings = await this.getNotificationSettings(restaurantId);
        if (!newSettings.data) {
          throw createError('Failed to create notification settings');
        }
        currentSettings.data = newSettings.data;
      }

      // Atualizar configuração específica
      const updatedSettings = {
        ...currentSettings.data.settings,
        [notificationType]: enabled
      };

      return await this.updateNotificationSettings(restaurantId, updatedSettings);
    } catch (error) {
      throw createError(`Failed to toggle notification type: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateNotificationTiming(restaurantId: string, timing: NotificationSettings['settings']['notification_timing']): Promise<ApiResponse<NotificationSettings>> {
    try {
      const currentSettings = await this.getNotificationSettings(restaurantId);
      
      if (!currentSettings.data) {
        await this.createDefaultNotificationSettings(restaurantId);
        const newSettings = await this.getNotificationSettings(restaurantId);
        if (!newSettings.data) {
          throw createError('Failed to create notification settings');
        }
        currentSettings.data = newSettings.data;
      }

      const updatedSettings = {
        ...currentSettings.data.settings,
        notification_timing: timing
      };

      return await this.updateNotificationSettings(restaurantId, updatedSettings);
    } catch (error) {
      throw createError(`Failed to update notification timing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new NotificationService(); 