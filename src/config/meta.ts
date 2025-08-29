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
  BSP_BUSINESS_ID: '3246838805460539',
  // System User Access Token para operações de BSP
  SYSTEM_USER_ACCESS_TOKEN: 'f1509ad9d2ff834f70c04aaef5055e979f3ca72f1d611aeaa0272d396b8f1733',
  // Token permanente para operações avançadas
  PERMANENT_TOKEN: '2552c2e8b5957d753135fd4198a43ab0cb2dd1ca2ce093c3506772b6012fd922',
} as const;

// Configurações BSP hardcoded para produção
console.log('🔍 Configurações BSP carregadas com valores hardcoded');

export default META_CONFIG; 