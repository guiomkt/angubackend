// Base types
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// Restaurant types
export interface Restaurant extends BaseEntity {
  name: string;
  description?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  website?: string;
  opening_hours?: Record<string, { open: string; close: string }>;
  max_capacity?: number;
  onboarding_completed: boolean;
  onboarding_step: number;
  user_id: string;
}

// Area types
export interface RestaurantArea extends BaseEntity {
  restaurant_id: string;
  name: string;
  description?: string;
  max_capacity?: number;
  is_active: boolean;
  order?: number;
  max_tables: number;
}

// Table types
export interface Table extends BaseEntity {
  restaurant_id: string;
  area_id: string;
  number: number;
  name?: string;
  capacity: number;
  shape: 'round' | 'square' | 'rectangle';
  width: number;
  height: number;
  position_x: number;
  position_y: number;
  status: 'available' | 'occupied' | 'reserved' | 'blocked';
  is_active: boolean;
}

export interface TableWithArea extends Table {
  area: RestaurantArea;
}

export interface TableStatusHistory extends BaseEntity {
  table_id: string;
  previous_status: string;
  new_status: string;
  changed_by?: string;
  notes?: string;
}

// Menu types
export interface MenuCategory extends BaseEntity {
  restaurant_id: string;
  name: string;
  description?: string;
  order: number;
  is_active: boolean;
}

export interface MenuItem extends BaseEntity {
  restaurant_id: string;
  category_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
}

export interface MenuItemWithCategory extends MenuItem {
  category: MenuCategory;
}

// Reservation types
export interface Reservation extends BaseEntity {
  restaurant_id: string;
  customer_name: string;
  phone: string;
  number_of_people: number;
  reservation_date: string;
  start_time: string;
  end_time: string;
  table_id: string;
  area_id: string;
  status: 'pending' | 'confirmed' | 'canceled' | 'completed';
  notes?: string;
  categoria_comemoracao_id?: string;
  people_list?: string[];
}

export interface ReservationWithDetails extends Reservation {
  table: Table;
  area: RestaurantArea;
  celebration?: {
    id: string;
    nome: string;
    cor?: string;
  };
}

// Celebration types
export interface CategoriaComemoracao extends BaseEntity {
  restaurant_id: string;
  nome: string;
  tipo_recorrencia: 'unica' | 'dias_semana' | 'periodo';
  dias_semana?: number[];
  data_inicio: string;
  data_fim: string;
  descricao?: string;
  qtd_min: number;
  cor?: string;
  status: boolean;
}

// Waiting List types
export interface WaitingList extends BaseEntity {
  restaurant_id: string;
  customer_name: string;
  phone_number: string;
  party_size: number;
  queue_number: number;
  status: 'waiting' | 'notified' | 'seated' | 'no_show';
  priority: 'low' | 'medium' | 'high';
  area_preference?: string;
  estimated_wait_time?: number;
  notification_time?: string;
  notes?: string;
  table_id?: string;
}

// Chat types
export interface ChatContact extends BaseEntity {
  restaurant_id: string;
  phone_number: string;
  name: string;
  profile_image_url?: string;
  status: 'new' | 'active' | 'inactive';
  customer_type: 'new' | 'returning' | 'vip';
  last_message_at: string;
  unread_count: number;
  tags: string[];
  notes?: string;
  thread_id?: string;
  ai_enable: boolean;
}

export interface ChatMessage extends BaseEntity {
  sender_type: 'customer' | 'restaurant' | 'ai';
  sender_id?: string;
  content: string;
  content_type: 'text' | 'image' | 'file' | 'location' | 'contact';
  media_url?: string;
  is_read: boolean;
  restaurant_id: string;
  status?: 'open' | 'closed' | 'archived';
  intent?: 'general' | 'reservation' | 'menu' | 'complaint' | 'feedback' | 'other';
  sentiment?: 'positive' | 'neutral' | 'negative';
  ai_enabled?: boolean;
  assigned_to?: string;
}

// CRM types
export interface CrmStage extends BaseEntity {
  restaurant_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  order: number;
  is_active: boolean;
}

export interface CrmCard extends BaseEntity {
  restaurant_id: string;
  stage_id: string;
  contact_id?: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'archived';
  due_date?: string;
  assigned_to?: string;
  last_contact_date?: string;
  last_contact_channel?: string;
  value?: number;
}

// Experience types
export interface ExperienceBonification extends BaseEntity {
  name?: string;
  description?: string;
  rules?: string;
  observation?: string;
  status: boolean;
  restaurant_id: string;
}

export interface ExperienceEvent extends BaseEntity {
  name?: string;
  init_date?: string;
  end_date?: string;
  day_recurrence?: any;
  description?: string;
  restaurant_id: string;
  link_event?: string;
  rules?: string;
  recurrence_type?: string;
  code?: string;
  observation?: string;
  init_time?: string;
  end_time?: string;
  percentage_discount?: string;
}

export interface ExperienceEventExclusive extends BaseEntity {
  name?: string;
  rules?: string;
  observation?: string;
  description?: string;
  restaurant_id: string;
  status: boolean;
}

// User types
export interface UserProfile extends BaseEntity {
  name?: string;
  role?: string;
  restaurant_id?: string;
  user_id: string;
  created_by?: string;
}

// WhatsApp types
export interface WhatsAppCredentials {
  id: number;
  restaurant_id: string;
  phone_number?: string;
  phone_number_id?: string;
  business_name?: string;
  status?: string;
  whatsapp_business_account_id?: string;
  message_template_namespace: boolean;
  access_token?: string;
  webhook_status?: string;
  disconnected_at?: string;
  disconnect_reason?: string;
  created_at: string;
  updated_at?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} 