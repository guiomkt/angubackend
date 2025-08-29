import { supabase } from '../config/database';
import { META_CONFIG, META_URLS } from '../config/meta';
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

// Interfaces para respostas da API do Facebook
interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

interface FacebookLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

interface FacebookBusinessAccountsResponse {
  data: Array<{
    id: string;
    name: string;
    access_token: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

// Constantes para integração com Meta
const META_API_VERSION = META_CONFIG.API_VERSION;
const META_GRAPH_URL = META_URLS.GRAPH_API;
const META_OAUTH_DIALOG_URL = META_URLS.OAUTH_DIALOG;

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private static readonly JWT_EXPIRES_IN = '7d';

  /**
   * Realiza login do usuário
   */
  static async login(email: string, password: string): Promise<LoginResult> {
    try {
      // Autenticar com Supabase Auth
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
      let { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Se não encontrar restaurante, criar um básico para onboarding
      if (restaurantError || !restaurantData) {
        console.log('Restaurante não encontrado, criando para onboarding...');
        
        const { data: newRestaurant, error: createError } = await supabase
          .from('restaurants')
          .insert({
            name: 'Meu Restaurante',
            user_id: userId,
            description: null,
            logo_url: null,
            address: null,
            city: null,
            state: null,
            postal_code: null,
            phone: null,
            email: authData.user.email,
            website: null,
            opening_hours: null,
            max_capacity: null,
            onboarding_completed: false,
            onboarding_step: 0
          })
          .select()
          .single();

        if (createError) {
          throw new Error('Erro ao criar restaurante para onboarding');
        }

        restaurantData = newRestaurant;
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

      // Criar usuário na tabela users
      const { error: userInsertError } = await supabase
        .from('users')
        .insert({
          name: data.name,
          role: 'owner',
          user_id: userId
        });

      if (userInsertError) {
        console.warn('Aviso: Erro ao criar usuário na tabela users:', userInsertError);
        // Não falhar se não conseguir criar na tabela users, pois o restaurante já foi criado
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

        let { data: restaurantData, error: restaurantError } = await supabase
          .from('restaurants')
          .select('id, onboarding_completed, onboarding_step')
          .eq('user_id', userId)
          .single();

        // Se não encontrar restaurante, criar um básico para onboarding
        if (restaurantError || !restaurantData) {
          console.log('Restaurante não encontrado em getUserProfile, criando para onboarding...');
          
          const { data: newRestaurant, error: createError } = await supabase
            .from('restaurants')
            .insert({
              name: 'Meu Restaurante',
              user_id: userId,
              description: null,
              logo_url: null,
              address: null,
              city: null,
              state: null,
              postal_code: null,
              phone: null,
              email: '',
              website: null,
              opening_hours: null,
              max_capacity: null,
              onboarding_completed: false,
              onboarding_step: 0
            })
            .select('id, onboarding_completed, onboarding_step')
            .single();

          if (createError) {
            throw new Error('Erro ao criar restaurante para onboarding');
          }

          restaurantData = newRestaurant;
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

      let { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, onboarding_completed, onboarding_step')
        .eq('user_id', userId)
        .single();

      // Se não encontrar restaurante, criar um básico para onboarding
      if (restaurantError || !restaurantData) {
        console.log('Restaurante não encontrado em getUserProfile (com userData), criando para onboarding...');
        
        const { data: newRestaurant, error: createError } = await supabase
          .from('restaurants')
          .insert({
            name: 'Meu Restaurante',
            user_id: userId,
            description: null,
            logo_url: null,
            address: null,
            city: null,
            state: null,
            postal_code: null,
            phone: null,
            email: userData.email || '',
            website: null,
            opening_hours: null,
            max_capacity: null,
            onboarding_completed: false,
            onboarding_step: 0
          })
          .select('id, onboarding_completed, onboarding_step')
          .single();

        if (createError) {
          throw new Error('Erro ao criar restaurante para onboarding');
        }

        restaurantData = newRestaurant;
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

  static async refreshToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      const user = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .single();

      if (!user.data) {
        throw new Error('Usuário não encontrado');
      }

      const newToken = jwt.sign(
        { userId: user.data.id, email: user.data.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );

      return {
        token: newToken,
        user: user.data
      };
    } catch (error) {
      throw new Error('Token inválido');
    }
  }

  static async logout(token: string): Promise<void> {
    // Em uma implementação mais robusta, você poderia invalidar o token
    // Por enquanto, apenas retornamos sucesso
    return;
  }

  static async initiateMetaLogin(userId: string): Promise<any> {
    try {
      // Buscar dados do usuário e restaurante
      // O userId que vem do JWT é o id do auth.users
      // Precisamos buscar na tabela users onde user_id = userId
      const user = await supabase
        .from('users')
        .select(`
          *,
          restaurants (*)
        `)
        .eq('user_id', userId)
        .single();

      if (!user.data) {
        // Se não encontrar na tabela users, tentar buscar direto no restaurante
        const restaurant = await supabase
          .from('restaurants')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (!restaurant.data) {
          throw new Error('Restaurante não encontrado');
        }
        
        const restaurantId = restaurant.data.id;
        
              // Criar um usuário na tabela users se não existir
        const { data: newUser, error: createUserError } = await supabase
          .from('users')
          .insert({
            user_id: userId, // ID do Supabase Auth
            name: 'Usuário WhatsApp',
            email: '', // Será preenchido depois
            role: 'owner'
          })
          .select()
          .single();
        
        if (createUserError) {
          throw new Error(`Erro ao criar usuário: ${createUserError.message}`);
        }
        
        return {
          authUrl: this.generateAuthUrl(newUser.id, restaurantId),
          state: this.generateState(newUser.id, restaurantId)
        };
      }

      const restaurantId = user.data.restaurant_id;
      
      if (!restaurantId) {
        throw new Error('Restaurante não encontrado');
      }

      // Criar state com dados necessários
      // IMPORTANTE: Em produção, SEMPRE usar a URL correta
      const isProduction = process.env.NODE_ENV === 'production';
      const frontendUrl = isProduction 
        ? 'https://www.angu.ai' 
        : (process.env.FRONTEND_URL || 'http://localhost:5173');
      
      const stateData = {
        userId: user.data.id, // Usar o ID da tabela users, não do auth.users
        restaurantId,
        redirectUrl: `${frontendUrl}/whatsapp/callback`,
        timestamp: Date.now()
      };

      const encodedState = encodeURIComponent(JSON.stringify(stateData));

      // Gerar URL de autorização
      const clientId = process.env.FACEBOOK_APP_ID;
      const redirectUri = process.env.REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/meta/callback`;
      
      const params = new URLSearchParams({
        client_id: clientId!,
        redirect_uri: redirectUri,
        state: encodedState,
        scope: 'whatsapp_business_management,whatsapp_business_messaging,pages_manage_posts,ads_management'
      });

      const authUrl = `${META_OAUTH_DIALOG_URL}?${params.toString()}`;

      return {
        authUrl,
        state: encodedState
      };
    } catch (error) {
      throw new Error(`Erro ao iniciar login Meta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Gera URL de autorização para OAuth
   */
  private static generateAuthUrl(userId: string, restaurantId: string): string {
    const clientId = process.env.FACEBOOK_APP_ID;
    
    // IMPORTANTE: O redirect_uri deve ser a URL do backend de produção
    // Em produção, sempre usar api.angu.ai, em desenvolvimento usar localhost
    const isProduction = process.env.NODE_ENV === 'production';
    const redirectUri = process.env.REDIRECT_URI || 
      (isProduction 
        ? 'https://api.angu.ai/api/auth/meta/callback'
        : `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/meta/callback`
      );
    
    const stateData = {
      userId,
      restaurantId,
      // IMPORTANTE: Em produção, SEMPRE usar a URL correta
              redirectUrl: isProduction 
          ? 'https://www.angu.ai/whatsapp/callback'
          : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/whatsapp/callback`,
      timestamp: Date.now()
    };

    const encodedState = encodeURIComponent(JSON.stringify(stateData));
    
    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: redirectUri,
      state: encodedState,
      scope: 'whatsapp_business_management,whatsapp_business_messaging,pages_manage_posts,ads_management'
    });

    const authUrl = `${META_OAUTH_DIALOG_URL}?${params.toString()}`;
    
    return authUrl;
  }

  /**
   * Gera state para OAuth
   */
  private static generateState(userId: string, restaurantId: string): string {
    // IMPORTANTE: Em produção, SEMPRE usar a URL correta
    const isProduction = process.env.NODE_ENV === 'production';
    
    const stateData = {
      userId,
      restaurantId,
      // IMPORTANTE: Em produção, SEMPRE usar a URL correta
      redirectUrl: isProduction 
        ? 'https://www.angu.ai/whatsapp'
        : `${process.env.FRONTEND_URL || 'http://localhost:5173'}/whatsapp`,
      timestamp: Date.now()
    };

    return encodeURIComponent(JSON.stringify(stateData));
  }

  static async handleMetaCallback(code: string, state: string): Promise<any> {
    try {
      // Decodificar state
      const stateData = JSON.parse(decodeURIComponent(state));
      let { userId, restaurantId } = stateData;

      console.log('🔍 Debug OAuth - State decodificado:', { userId, restaurantId });

      // Validar se userId e restaurantId existem
      if (!userId || !restaurantId) {
        throw new Error('userId e restaurantId são obrigatórios no state');
      }

      // Verificar se o usuário existe na tabela users
      console.log('🔍 Debug OAuth - Buscando usuário:', userId);
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, user_id, name')
        .eq('id', userId)
        .single();

      console.log('🔍 Debug OAuth - Resultado busca usuário:', { userData, userError });

      if (userError || !userData) {
        // Tentar buscar por user_id (Supabase Auth ID)
        console.log('🔍 Debug OAuth - Tentando buscar por user_id:', userId);
        const { data: userByAuthId, error: userByAuthIdError } = await supabase
          .from('users')
          .select('id, user_id, name')
          .eq('user_id', userId)
          .single();

        console.log('🔍 Debug OAuth - Resultado busca por user_id:', { userByAuthId, userByAuthIdError });

        if (userByAuthIdError || !userByAuthId) {
          // Se não encontrar, criar o usuário na tabela users
          console.log('🔍 Debug OAuth - Criando usuário na tabela users');
          
          // Buscar dados do restaurante para obter informações do usuário
          const { data: restaurantData, error: restaurantError } = await supabase
            .from('restaurants')
            .select('name, email')
            .eq('id', restaurantId)
            .single();

          if (restaurantError || !restaurantData) {
            throw new Error(`Restaurante não encontrado: ${restaurantId}`);
          }

          // Criar usuário na tabela users
          const { data: newUser, error: createUserError } = await supabase
            .from('users')
            .insert({
              user_id: userId, // ID do Supabase Auth
              name: restaurantData.name || 'Usuário WhatsApp',
              role: 'owner'
            })
            .select()
            .single();

          if (createUserError) {
            console.error('🔍 Debug OAuth - Erro ao criar usuário:', createUserError);
            throw new Error(`Erro ao criar usuário: ${createUserError.message}`);
          }

          console.log('🔍 Debug OAuth - Usuário criado com sucesso:', newUser);
          userId = newUser.id; // Usar o ID da tabela users
        } else {
          // Usar o ID da tabela users
          userId = userByAuthId.id;
          console.log('🔍 Debug OAuth - Usando ID da tabela users:', userId);
        }
      }

      // Verificar se o restaurante existe
      console.log('🔍 Debug OAuth - Buscando restaurante:', restaurantId);
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, name')
        .eq('id', restaurantId)
        .single();

      console.log('🔍 Debug OAuth - Resultado busca restaurante:', { restaurantData, restaurantError });

      if (restaurantError || !restaurantData) {
        throw new Error(`Restaurante não encontrado: ${restaurantId}`);
      }

      // Trocar code por short-lived token
      const clientId = process.env.FACEBOOK_APP_ID;
      const clientSecret = process.env.FACEBOOK_APP_SECRET;
      
      // IMPORTANTE: O redirect_uri deve ser a URL do backend de produção
      const isProduction = process.env.NODE_ENV === 'production';
      const redirectUri = process.env.REDIRECT_URI || 
        (isProduction 
          ? 'https://api.angu.ai/api/auth/meta/callback'
          : `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/meta/callback`
        );

      const tokenResponse = await fetch(META_URLS.OAUTH_ACCESS_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId!,
          redirect_uri: redirectUri,
          client_secret: clientSecret!,
          code: code
        })
      });

      const tokenData = await tokenResponse.json() as FacebookTokenResponse;

      if (tokenData.error) {
        throw new Error(`Erro ao trocar code por token: ${tokenData.error.message}`);
      }

      // Trocar por long-lived token
      const longLivedResponse = await fetch(META_URLS.OAUTH_ACCESS_TOKEN, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });

      const longLivedParams = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: clientId!,
        client_secret: clientSecret!,
        fb_exchange_token: tokenData.access_token
      });

      const longLivedUrl = `${META_URLS.OAUTH_ACCESS_TOKEN}?${longLivedParams.toString()}`;
      const longLivedData = await fetch(longLivedUrl).then(res => res.json()) as FacebookLongLivedTokenResponse;

      if (longLivedData.error) {
        throw new Error(`Erro ao trocar por long-lived token: ${longLivedData.error.message}`);
      }

      // Buscar contas de negócio
              const accountsResponse = await fetch(`${META_URLS.GRAPH_API}/me/accounts?access_token=${longLivedData.access_token}`);
      const accountsData = await accountsResponse.json() as FacebookBusinessAccountsResponse;

      if (accountsData.error) {
        throw new Error(`Erro ao buscar contas: ${accountsData.error.message}`);
      }

      // Salvar token no banco - USAR TABELA CORRETA (whatsapp_tokens)
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + longLivedData.expires_in);

      // Buscar ou criar integração WhatsApp
      let integration = await supabase
        .from('whatsapp_integrations')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .single();

      if (!integration.data) {
        // Criar integração se não existir
        const { data: newIntegration, error: createError } = await supabase
          .from('whatsapp_integrations')
          .insert({
            restaurant_id: restaurantId,
            instance_name: 'WhatsApp Business',
            status: 'connected',
            oauth_access_token: longLivedData.access_token,
            oauth_token_expires_at: expiresAt.toISOString(),
            oauth_token_type: 'long_lived',
            is_oauth_connected: true,
            last_oauth_refresh: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          throw new Error(`Erro ao criar integração: ${createError.message}`);
        }

        integration = { data: newIntegration, error: null } as any;
      } else {
        // Atualizar integração existente
        const { error: updateError } = await supabase
          .from('whatsapp_integrations')
          .update({
            oauth_access_token: longLivedData.access_token,
            oauth_token_expires_at: expiresAt.toISOString(),
            oauth_token_type: 'long_lived',
            is_oauth_connected: true,
            last_oauth_refresh: new Date().toISOString(),
            status: 'connected'
          })
          .eq('id', integration.data.id);

        if (updateError) {
          throw new Error(`Erro ao atualizar integração: ${updateError.message}`);
        }
      }

      // Salvar token na tabela meta_tokens (que REALMENTE EXISTE no banco)
      // Primeiro, garantir que temos um usuário válido na tabela users
      let finalUserId = userId;
      
      // Se o userId não for um UUID válido da tabela users, criar o usuário
      if (!userData) {
        console.log('🔍 Debug OAuth - Criando usuário na tabela users para meta_tokens');
        
        const { data: newUser, error: createUserError } = await supabase
          .from('users')
          .insert({
            user_id: userId, // ID do Supabase Auth
            name: 'Usuário WhatsApp',
            role: 'owner'
          })
          .select()
          .single();

        if (createUserError) {
          console.error('🔍 Debug OAuth - Erro ao criar usuário:', createUserError);
          throw new Error(`Erro ao criar usuário: ${createUserError.message}`);
        }

        finalUserId = newUser.id;
        console.log('🔍 Debug OAuth - Usuário criado com sucesso:', newUser);
      }

      // Verificar se já existe um token para este usuário/restaurante
      console.log('🔍 Debug OAuth - Verificando token existente para:', { finalUserId, restaurantId });
      
      const { data: existingToken, error: checkError } = await supabase
        .from('meta_tokens')
        .select('id, access_token, expires_at')
        .eq('user_id', finalUserId)
        .eq('restaurant_id', restaurantId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('🔍 Debug OAuth - Erro ao verificar token existente:', checkError);
      }

      let metaTokenError;
      
      if (existingToken) {
        // Atualizar token existente
        console.log('🔍 Debug OAuth - Atualizando token existente:', existingToken.id);
        
        const { error: updateError } = await supabase
          .from('meta_tokens')
          .update({
            access_token: longLivedData.access_token,
            token_type: 'whatsapp_business',
            expires_at: expiresAt.toISOString(),
            business_accounts: accountsData.data || [],
            updated_at: new Date().toISOString()
          })
          .eq('id', existingToken.id);

        metaTokenError = updateError;
      } else {
        // Criar novo token
        console.log('🔍 Debug OAuth - Criando novo token');
        
        const { error: insertError } = await supabase
          .from('meta_tokens')
          .insert({
            user_id: finalUserId,
            restaurant_id: restaurantId,
            access_token: longLivedData.access_token,
            token_type: 'whatsapp_business',
            expires_at: expiresAt.toISOString(),
            business_accounts: accountsData.data || []
          });

        metaTokenError = insertError;
      }

      if (metaTokenError) {
        console.error('🔍 Debug OAuth - Erro ao salvar em meta_tokens:', metaTokenError);
        throw new Error(`Erro ao salvar token: ${metaTokenError.message}`);
      }

      console.log('🔍 Debug OAuth - Token salvo com sucesso em meta_tokens');

      return {
        success: true,
        restaurantId,
        businessAccounts: accountsData.data || []
      };
    } catch (error) {
      throw new Error(`Erro no callback Meta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  static async getMetaToken(restaurantId: string): Promise<any> {
    try {
      // Buscar token válido
      const { data: tokenData, error } = await supabase
        .from('meta_tokens')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !tokenData) {
        throw new Error('Token não encontrado ou expirado');
      }

      return {
        access_token: tokenData.access_token,
        expires_in: Math.floor((new Date(tokenData.expires_at).getTime() - Date.now()) / 1000),
        token_type: tokenData.token_type
      };
    } catch (error) {
      throw new Error(`Erro ao obter token: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }
} 