import { supabase } from '../config/database';
import { MenuCategory, MenuItem, MenuItemWithCategory } from '../types';

export class MenuService {
  /**
   * Get all menu categories for a restaurant
   */
  static async getCategoriesByRestaurant(restaurantId: string): Promise<MenuCategory[]> {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('order', { ascending: true });

    if (error) {
      throw new Error(`Error fetching menu categories: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single category by ID
   */
  static async getCategoryById(id: string): Promise<MenuCategory | null> {
    const { data, error } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching menu category: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new menu category
   */
  static async createCategory(categoryData: Omit<MenuCategory, 'id' | 'created_at' | 'updated_at'>): Promise<MenuCategory> {
    // Get the highest order number for this restaurant
    const { data: maxOrderData } = await supabase
      .from('menu_categories')
      .select('order')
      .eq('restaurant_id', categoryData.restaurant_id)
      .order('order', { ascending: false })
      .limit(1);

    const nextOrder = maxOrderData && maxOrderData.length > 0 ? maxOrderData[0].order + 1 : 0;

    const { data, error } = await supabase
      .from('menu_categories')
      .insert({
        ...categoryData,
        order: nextOrder
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating menu category: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a menu category
   */
  static async updateCategory(id: string, categoryData: Partial<MenuCategory>): Promise<MenuCategory> {
    const { data, error } = await supabase
      .from('menu_categories')
      .update({
        ...categoryData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating menu category: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a menu category
   */
  static async deleteCategory(id: string): Promise<void> {
    // Check if category has items
    const { data: items, error: itemsError } = await supabase
      .from('menu_items')
      .select('id')
      .eq('category_id', id);

    if (itemsError) {
      throw new Error(`Error checking menu items: ${itemsError.message}`);
    }

    if (items && items.length > 0) {
      throw new Error('Cannot delete category with existing items');
    }

    const { error } = await supabase
      .from('menu_categories')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting menu category: ${error.message}`);
    }
  }

  /**
   * Reorder categories
   */
  static async reorderCategories(restaurantId: string, categoryIds: string[]): Promise<void> {
    const updates = categoryIds.map((id, index) => ({
      id,
      order: index
    }));

    const { error } = await supabase
      .from('menu_categories')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      throw new Error(`Error reordering categories: ${error.message}`);
    }
  }

  /**
   * Get all menu items for a restaurant with category information
   */
  static async getItemsByRestaurant(restaurantId: string): Promise<MenuItemWithCategory[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories(*)
      `)
      .eq('restaurant_id', restaurantId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Error fetching menu items: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get menu items by category
   */
  static async getItemsByCategory(categoryId: string): Promise<MenuItemWithCategory[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories(*)
      `)
      .eq('category_id', categoryId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Error fetching menu items: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single menu item by ID
   */
  static async getItemById(id: string): Promise<MenuItemWithCategory | null> {
    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Error fetching menu item: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new menu item
   */
  static async createItem(itemData: Omit<MenuItem, 'id' | 'created_at' | 'updated_at'>): Promise<MenuItemWithCategory> {
    const { data, error } = await supabase
      .from('menu_items')
      .insert(itemData)
      .select(`
        *,
        category:menu_categories(*)
      `)
      .single();

    if (error) {
      throw new Error(`Error creating menu item: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a menu item
   */
  static async updateItem(id: string, itemData: Partial<MenuItem>): Promise<MenuItemWithCategory> {
    const { data, error } = await supabase
      .from('menu_items')
      .update({
        ...itemData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        category:menu_categories(*)
      `)
      .single();

    if (error) {
      throw new Error(`Error updating menu item: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a menu item
   */
  static async deleteItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Error deleting menu item: ${error.message}`);
    }
  }

  /**
   * Get complete menu with categories and items
   */
  static async getCompleteMenu(restaurantId: string): Promise<any> {
    const categories = await this.getCategoriesByRestaurant(restaurantId);
    const items = await this.getItemsByRestaurant(restaurantId);

    return categories.map(category => ({
      ...category,
      items: items.filter(item => item.category_id === category.id)
    }));
  }

  /**
   * Search menu items
   */
  static async searchItems(restaurantId: string, searchTerm: string): Promise<MenuItemWithCategory[]> {
    const { data, error } = await supabase
      .from('menu_items')
      .select(`
        *,
        category:menu_categories(*)
      `)
      .eq('restaurant_id', restaurantId)
      .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Error searching menu items: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get menu statistics
   */
  static async getMenuStats(restaurantId: string): Promise<any> {
    const { data: categories, error: categoriesError } = await supabase
      .from('menu_categories')
      .select('id, is_active')
      .eq('restaurant_id', restaurantId);

    if (categoriesError) {
      throw new Error(`Error fetching category stats: ${categoriesError.message}`);
    }

    const { data: items, error: itemsError } = await supabase
      .from('menu_items')
      .select('id, is_active, price')
      .eq('restaurant_id', restaurantId);

    if (itemsError) {
      throw new Error(`Error fetching item stats: ${itemsError.message}`);
    }

    const totalCategories = categories?.length || 0;
    const activeCategories = categories?.filter(c => c.is_active).length || 0;
    const totalItems = items?.length || 0;
    const activeItems = items?.filter(i => i.is_active).length || 0;
    const averagePrice = items && items.length > 0 
      ? items.reduce((sum, item) => sum + item.price, 0) / items.length 
      : 0;

    return {
      totalCategories,
      activeCategories,
      totalItems,
      activeItems,
      averagePrice: Math.round(averagePrice * 100) / 100
    };
  }
} 