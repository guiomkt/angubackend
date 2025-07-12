import { supabase } from '../config/database';
import jwt from 'jsonwebtoken';

interface RegisterData {
  email: string;
  password: string;
  name: string;
  restaurantName: string;
  phone?: string;
}

interface LoginResult {
  token: string;
  user: any;
  restaurant: any;
}

interface UserProfileResult {
  user: any;
  restaurant: any;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private static readonly JWT_EXPIRES_IN = '7d';

  /**
   * Realiza login do usuário usando Supabase Auth
   */
  static async login(email: string, password: string): Promise<LoginResult> {
    try {
      // Autenticar com Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        throw new Error('Credenciais inválidas');
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('Usuário não encontrado');
      }

      // Buscar dados do restaurante
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (restaurantError || !restaurantData) {
        throw new Error('Restaurante não encontrado');
      }

      // Gerar token JWT
      const token = this.generateToken(userId);

      return {
        token,
        user: {
          id: userId,
          name: authData.user.user_metadata?.name || 'Usuário',
          email: authData.user.email,
          role: 'owner',
          user_id: userId
        },
        restaurant: {
          id: restaurantData.id,
          name: restaurantData.name,
          description: restaurantData.description,
          logo_url: restaurantData.logo_url,
          address: restaurantData.address,
          city: restaurantData.city,
          state: restaurantData.state,
          postal_code: restaurantData.postal_code,
          phone: restaurantData.phone,
          email: restaurantData.email,
          website: restaurantData.website,
          opening_hours: restaurantData.opening_hours,
          max_capacity: restaurantData.max_capacity,
          onboarding_completed: restaurantData.onboarding_completed,
          onboarding_step: restaurantData.onboarding_step
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Registra novo usuário usando Supabase Auth
   */
  static async register(data: RegisterData): Promise<LoginResult> {
    try {
      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: 'owner'
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error('Erro ao criar usuário');
      }

      // Criar restaurante
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .insert({
          name: data.restaurantName,
          user_id: userId,
          description: null,
          logo_url: null,
          address: null,
          city: null,
          state: null,
          postal_code: null,
          phone: data.phone || null,
          email: data.email,
          website: null,
          opening_hours: null,
          max_capacity: null,
          onboarding_completed: false,
          onboarding_step: 0
        })
        .select()
        .single();

      if (restaurantError) {
        throw new Error('Erro ao criar restaurante');
      }

      // Gerar token JWT
      const token = this.generateToken(userId);

      return {
        token,
        user: {
          id: userId,
          name: data.name,
          email: data.email,
          role: 'owner',
          user_id: userId
        },
        restaurant: {
          id: restaurantData.id,
          name: restaurantData.name,
          description: restaurantData.description,
          logo_url: restaurantData.logo_url,
          address: restaurantData.address,
          city: restaurantData.city,
          state: restaurantData.state,
          postal_code: restaurantData.postal_code,
          phone: restaurantData.phone,
          email: restaurantData.email,
          website: restaurantData.website,
          opening_hours: restaurantData.opening_hours,
          max_capacity: restaurantData.max_capacity,
          onboarding_completed: restaurantData.onboarding_completed,
          onboarding_step: restaurantData.onboarding_step
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Obtém perfil do usuário
   */
  static async getUserProfile(userId: string): Promise<UserProfileResult> {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users_profile')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userError || !userData) {
        const user = {
          id: userId,
          name: 'Usuário',
          email: '',
          role: 'owner',
          user_id: userId
        };

        const { data: restaurantData, error: restaurantError } = await supabase
          .from('restaurants')
          .select('id, onboarding_completed, onboarding_step')
          .eq('user_id', userId)
          .single();

        if (restaurantError || !restaurantData) {
          throw new Error('Restaurante não encontrado');
        }

        return {
          user,
          restaurant: {
            id: restaurantData.id,
            onboarding_completed: restaurantData.onboarding_completed,
            onboarding_step: restaurantData.onboarding_step
          }
        };
      }

      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, onboarding_completed, onboarding_step')
        .eq('user_id', userId)
        .single();

      if (restaurantError || !restaurantData) {
        throw new Error('Restaurante não encontrado');
      }

      return {
        user: {
          id: userData.user_id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          user_id: userData.user_id
        },
        restaurant: {
          id: restaurantData.id,
          onboarding_completed: restaurantData.onboarding_completed,
          onboarding_step: restaurantData.onboarding_step
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gera token JWT
   */
  static generateToken(userId: string): string {
    return jwt.sign(
      { 
        id: userId,
        iat: Math.floor(Date.now() / 1000)
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  /**
   * Verifica token JWT
   */
  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      throw new Error('Token inválido');
    }
  }
} 