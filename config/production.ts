declare global {
  namespace NodeJS {
    interface ProcessEnv {
      FACEBOOK_APP_ID: string;
      FACEBOOK_APP_SECRET: string;
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: string;
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      JWT_SECRET: string;
    }
  }
}

export const productionConfig = {
  // URLs de produção
  urls: {
    backend: 'https://api.cheffguio.com',
    frontend: 'https://cheffguio.com',
    whatsapp: 'https://cheffguio.com/whatsapp'
  },
  
  // Configurações de segurança
  security: {
    cors: {
      origin: [
        'https://cheffguio.com',
        'https://www.cheffguio.com',
        'https://homolog-alfreddo.netlify.app'
      ],
      credentials: true
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 1000 // limite por IP
    }
  },
  
  // Configurações do Facebook App
  facebook: {
    redirectUri: 'https://api.cheffguio.com/api/auth/meta/callback',
    scopes: [
      'whatsapp_business_management',
      'whatsapp_business_messaging',
      'pages_manage_posts',
      'ads_management'
    ]
  },
  
  // Configurações do WhatsApp
  whatsapp: {
    apiUrl: 'https://graph.facebook.com/v20.0'
  }
}; 