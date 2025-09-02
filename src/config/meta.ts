/**
 * Configurações centralizadas para integração com Meta API
 * Centraliza versões, URLs e constantes para evitar inconsistências
 */

export const META_CONFIG = {
  API_VERSION: process.env.META_API_VERSION || 'v22.0',
  GRAPH_API_BASE: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com',
  OAUTH_DIALOG_BASE: 'https://www.facebook.com',
  PHONE_REGISTRATION_PIN: process.env.PHONE_REGISTRATION_PIN || '000000',
  OAUTH_SCOPES: process.env.OAUTH_SCOPES || [
    'business_management',
    'whatsapp_business_management',
    'whatsapp_business_messaging',
    'pages_show_list',
    'pages_read_engagement'
  ].join(',')
} as const;

export const META_URLS = {
  GRAPH_API: `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}`,
  OAUTH_DIALOG: `${META_CONFIG.OAUTH_DIALOG_BASE}/${META_CONFIG.API_VERSION}/dialog/oauth`,
  OAUTH_ACCESS_TOKEN: `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.API_VERSION}/oauth/access_token`
} as const;

export const BSP_CONFIG = {
  BSP_BUSINESS_ID: process.env.BSP_BUSINESS_ID || '',
  SYSTEM_USER_ACCESS_TOKEN: process.env.BSP_SYSTEM_USER_ACCESS_TOKEN || '',
  PERMANENT_TOKEN: process.env.BSP_PERMANENT_TOKEN || ''
} as const;

export default META_CONFIG; 
