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
  
  // Escopos OAuth CORRETOS para WhatsApp Business (usuário final)
  // business_management: Necessário para acessar Business Manager
  // whatsapp_business_management: Necessário para gerenciar WABA
  OAUTH_SCOPES: [
    'business_management',           // ✅ CORRIGIDO: Necessário para /me/businesses
    'whatsapp_business_management',  // ✅ CORRIGIDO: Necessário para WABA
    'whatsapp_business_messaging',   // Para enviar mensagens
    'pages_show_list',              // Para listar páginas
    'pages_read_engagement'         // Para ler dados das páginas
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
  BSP_BUSINESS_ID: '100442081662109',
  // System User Access Token para operações de BSP
  SYSTEM_USER_ACCESS_TOKEN: 'EAAuIZB5GkdjsBPcIkR0omZB3CBkwU2B5r8scoKrM5JZC4c1R9QZBlS6sTLjSdV1FIZA8p5cBGq4rlxKJQCrguX3CSpg1cdsULnSJJZAaqeZBbOEjJ4UqkYNLExS2ulcWuyiQ76yCGaWVMKemmoJUZBF2R2jkZAmsKSgZCyZCDry8eqUwJ7w6v0ddFWWArsuiiUziXiHLQZDZD',
  // Token permanente para operações avançadas
  PERMANENT_TOKEN: '2552c2e8b5957d753135fd4198a43ab0cb2dd1ca72f1d611aeaa0272d396b8f1733',
} as const;

// Configurações BSP hardcoded para produção
console.log('🔍 Configurações BSP carregadas com valores hardcoded');

export default META_CONFIG; 
