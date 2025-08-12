import { supabase } from '../config/database';
import { ChatContact, CustomerFilters, CustomerStats } from '../types';

export class CustomerService {
  /**
   * Get customers by restaurant with pagination and filters
   */
  static async getCustomers(
    restaurantId: string,
    page: number = 1,
    limit: number = 20,
    filters?: CustomerFilters
  ): Promise<{ customers: ChatContact[]; total: number; totalPages: number }> {
    try {
      let query = supabase.from('chat_contacts').select('*', { count: 'exact' }).eq('restaurant_id', restaurantId);

      // Apply filters
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,phone_number.ilike.%${filters.search}%`);
      }
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.customer_type && filters.customer_type !== 'all') {
        query = query.eq('customer_type', filters.customer_type);
      }

      // Apply pagination
      const start = (page - 1) * limit;
      const end = start + limit - 1;
      query = query.range(start, end).order('created_at', { ascending: false });

      const { data: customers, error, count } = await query;

      if (error) {
        throw new Error(`Error fetching customers: ${error.message}`);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        customers: customers || [],
        total,
        totalPages
      };
    } catch (error) {
      throw new Error(`Failed to get customers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get customer by ID
   */
  static async getCustomerById(id: string): Promise<ChatContact | null> {
    try {
      const { data, error } = await supabase
        .from('chat_contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error(`Error fetching customer: ${error.message}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to get customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new customer
   */
  static async createCustomer(customerData: Partial<ChatContact>): Promise<ChatContact> {
    try {
      // Check if customer already exists with same phone number
      if (customerData.phone_number) {
        const { data: existingCustomer } = await supabase
          .from('chat_contacts')
          .select('id')
          .eq('restaurant_id', customerData.restaurant_id)
          .eq('phone_number', customerData.phone_number)
          .single();

        if (existingCustomer) {
          throw new Error('Customer with this phone number already exists');
        }
      }

      // Set default values for optional fields
      const newCustomer = {
        ...customerData,
        // Campos obrigatórios já validados no controller
        name: customerData.name,
        phone_number: customerData.phone_number,
        restaurant_id: customerData.restaurant_id,
        
        // Campos opcionais com valores padrão
        status: customerData.status || 'new',
        customer_type: customerData.customer_type || 'new',
        tags: Array.isArray(customerData.tags) ? customerData.tags : [],
        notes: customerData.notes || null,
        profile_image_url: customerData.profile_image_url || null,
        unread_count: 0,
        ai_enable: customerData.ai_enable !== undefined ? customerData.ai_enable : true,
        last_message_at: null
      };

      const { data, error } = await supabase
        .from('chat_contacts')
        .insert(newCustomer)
        .select()
        .single();

      if (error) {
        throw new Error(`Error creating customer: ${error.message}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update customer
   */
  static async updateCustomer(id: string, customerData: Partial<ChatContact>): Promise<ChatContact> {
    try {
      // First, get the existing customer to ensure it exists and get restaurant_id
      const { data: existingCustomer, error: fetchError } = await supabase
        .from('chat_contacts')
        .select('restaurant_id, phone_number')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(`Customer not found: ${fetchError.message}`);
      }

      // Check if customer already exists with same phone number (excluding current customer)
      if (customerData.phone_number && existingCustomer.restaurant_id) {
        const { data: duplicateCustomer } = await supabase
          .from('chat_contacts')
          .select('id')
          .eq('restaurant_id', existingCustomer.restaurant_id)
          .eq('phone_number', customerData.phone_number)
          .neq('id', id)
          .single();

        if (duplicateCustomer) {
          throw new Error('Customer with this phone number already exists');
        }
      }

      // Update the customer with the existing restaurant_id
      const updateData = {
        ...customerData,
        restaurant_id: existingCustomer.restaurant_id, // Ensure restaurant_id is preserved
        updated_at: new Date().toISOString()
      };

      // Primeiro fazer o update
      const { error: updateError } = await supabase
        .from('chat_contacts')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        throw new Error(`Error updating customer: ${updateError.message}`);
      }

      // Depois buscar o cliente atualizado
      const { data, error: selectError } = await supabase
        .from('chat_contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (selectError) {
        throw new Error(`Error fetching updated customer: ${selectError.message}`);
      }

      return data;
    } catch (error) {
      console.error('🔄 Service Update - Error:', error);
      throw new Error(`Failed to update customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete customer
   */
  static async deleteCustomer(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_contacts')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Error deleting customer: ${error.message}`);
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to delete customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update customer status
   */
  static async updateCustomerStatus(id: string, status: string): Promise<ChatContact> {
    try {
      const { data, error } = await supabase
        .from('chat_contacts')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Error updating customer status: ${error.message}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Failed to update customer status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get customer statistics
   */
  static async getCustomerStats(restaurantId: string): Promise<CustomerStats> {
    try {
      const { data: customers, error } = await supabase
        .from('chat_contacts')
        .select('status, customer_type')
        .eq('restaurant_id', restaurantId);

      if (error) {
        throw new Error(`Error fetching customer stats: ${error.message}`);
      }

      const stats: CustomerStats = {
        total_customers: customers?.length || 0,
        new_customers: customers?.filter(c => c.status === 'new').length || 0,
        active_customers: customers?.filter(c => c.status === 'active').length || 0,
        inactive_customers: customers?.filter(c => c.status === 'inactive').length || 0,
        vip_customers: customers?.filter(c => c.customer_type === 'vip').length || 0,
        returning_customers: customers?.filter(c => c.customer_type === 'returning').length || 0
      };

      return stats;
    } catch (error) {
      throw new Error(`Failed to get customer stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Bulk update customer tags
   */
  static async bulkUpdateTags(customerIds: string[], tags: string[]): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .update({
          tags,
          updated_at: new Date().toISOString()
        })
        .in('id', customerIds);

      if (error) {
        throw new Error(`Error bulk updating tags: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to bulk update tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get customers by tags
   */
  static async getCustomersByTags(restaurantId: string, tags: string[]): Promise<ChatContact[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .overlaps('tags', tags);

      if (error) {
        throw new Error(`Error fetching customers by tags: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error(`Failed to get customers by tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 