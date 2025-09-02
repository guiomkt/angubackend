/**
 * Configurações centralizadas para integração com Meta API
 * Centraliza versões, URLs e constantes para evitar inconsistências
 */

export const META_CONFIG = {
  // Versão da API Meta
  API_VERSION: 'v22.0',
  
  // URLs base
  GRAPH_API_BASE: 'https://graph.facebook.com',
  OAUTH_DIALOG_BASE: 'https://www.facebook.com',
  
  // Constantes específicas
  PHONE_REGISTRATION_PIN: '152563',
  
  // Parâmetros para polling
  POLLING_INTERVAL_MS: 3000,
  MAX_POLLING_ATTEMPTS: 10,
  RETRY_AFTER_SECONDS: 300,
  
  // Escopos OAuth CORRETOS para WhatsApp Business (usuário final)
  OAUTH_SCOPES: [
    'business_management',           // Necessário para /me/businesses
    'whatsapp_business_management',  // Necessário para gerenciar WABA
    'whatsapp_business_messaging',   // Necessário para enviar mensagens
    'pages_show_list',               // Opcional: Ver páginas do usuário
    'pages_read_engagement'          // Opcional: Ler engajamento de páginas
  ]
};

// URLs centralizadas para integração
export const META_URLS = {
  GRAPH_API: `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}`,
  OAUTH_DIALOG: `${META_CONFIG.OAUTH_DIALOG_BASE}/${META_CONFIG.API_VERSION}/dialog/oauth`,
  OAUTH_ACCESS_TOKEN: `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}/oauth/access_token`,
  DEBUG_TOKEN: `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}/debug_token`
};

// Configuração do BSP (Business Solution Provider)
export const BSP_CONFIG = {
  SYSTEM_USER_ACCESS_TOKEN: process.env.META_SYSTEM_USER_TOKEN || '',
  BSP_BUSINESS_ID: process.env.META_BSP_BUSINESS_ID || '',
  APP_ID: process.env.FACEBOOK_APP_ID || '',
  APP_SECRET: process.env.FACEBOOK_APP_SECRET || ''
};

// Configurações BSP hardcoded para produção
console.log('🔍 Configurações BSP carregadas com valores hardcoded');

export default META_CONFIG; 
