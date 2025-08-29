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
  
  // Escopos OAuth para WhatsApp Business (usuário final)
  OAUTH_SCOPES: [
    'whatsapp_business_management',
    'whatsapp_business_messaging',
    'pages_show_list',
    'pages_read_engagement'
  ].join(',')
} as const;

// URLs completas
export const META_URLS = {
  GRAPH_API: `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}`,
  OAUTH_DIALOG: `${META_CONFIG.OAUTH_DIALOG_BASE}/${META_CONFIG.API_VERSION}/dialog/oauth`,
  OAUTH_ACCESS_TOKEN: `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}/oauth/access_token`
} as const;

// Configurações para BSP (Business Solution Provider)
export const BSP_CONFIG = {
  // Business ID do nosso BSP
  BSP_BUSINESS_ID: process.env.WHATSAPP_APP_ID || '',
  // System User Access Token para operações de BSP
  SYSTEM_USER_ACCESS_TOKEN: process.env.WHATSAPP_SYSTEM_USER_TOKEN || '',
  // Token permanente para operações avançadas
  SYSTEM_USER_ACCESS_TOKEN: process.env.WHATSAPP_TOKEN_PERMANENT || '',
} as const;

export default META_CONFIG; 