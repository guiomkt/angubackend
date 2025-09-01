import { supabase } from '../config/database';
import axios from 'axios';
import { META_URLS, BSP_CONFIG } from '../config/meta';

// --- Interfaces ---

interface WABACreationResult {
  success: boolean;
  waba_id?: string;
  error?: string;
  details?: any;
}

interface DiscoveryResult {
  found: boolean;
  waba_id?: string;
  business_id?: string;
  strategy?: string;
}

interface MetaWABAListResponse {
  data: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

interface MetaBusinessResponse {
  data: Array<{
    id: string;
    name: string;
  }>;
}

/**
 * Log de integração para monitoramento e debug.
 */
export async function logIntegrationStep(
  step: string,
  strategy: string,
  success: boolean,
  restaurantId: string,
  details: any = {}
): Promise<void> {
  const logData = {
    restaurant_id: restaurantId,
    step,
    strategy,
    success,
    error_message: success ? null : details.error || 'Erro desconhecido',
    details
  };
  console.log(`[LOG] Step: ${step}, Strategy: ${strategy}, Success: ${success}`, details);
  await supabase.from('whatsapp_integration_logs').insert(logData);
}

/**
 * Descobre o Business Manager (BM) do usuário.
 * Requer o scope 'business_management'.
 */
async function discoverBusinessId(userToken: string): Promise<string | null> {
  try {
    console.log('[DISCOVER_BM] Buscando Business Manager do usuário...');
    const response = await axios.get<MetaBusinessResponse>(
      `${META_URLS.GRAPH_API}/me/businesses`,
      { headers: { Authorization: `Bearer ${userToken}` } }
    );
    if (!response.data.data || response.data.data.length === 0) {
      console.warn('[DISCOVER_BM] Nenhum Business Manager encontrado para o usuário.');
      return null;
    }
    const businessId = response.data.data[0].id;
    console.log(`[DISCOVER_BM] Business Manager encontrado: ${businessId}`);
    return businessId;
  } catch (error: any) {
    console.error('[DISCOVER_BM] Erro ao buscar Business Manager:', error.response?.data?.error);
    throw new Error('Falha ao buscar Business Manager do usuário. Verifique as permissões (business_management).');
  }
}

/**
 * ESTRATÉGIA 1 (CORRIGIDA): Busca WABA existente usando as edges corretas.
 */
export async function discoverExistingWABA(userToken: string, restaurantId: string): Promise<DiscoveryResult> {
  const businessId = await discoverBusinessId(userToken);
  if (!businessId) {
    await logIntegrationStep('waba_discovery', 'discover_business_id', false, restaurantId, {
      error: 'Nenhum Business Manager encontrado para o usuário.'
    });
    return { found: false };
  }

  const edgesToTry: Array<{ edge: string; strategy: string }> = [
    { edge: 'owned_whatsapp_business_accounts', strategy: 'owned_waba_discovery' },
    { edge: 'client_whatsapp_business_accounts', strategy: 'client_waba_discovery' }
  ];

  for (const { edge, strategy } of edgesToTry) {
    try {
      console.log(`[DISCOVER_WABA] Tentando edge: ${edge}`);
      const response = await axios.get<MetaWABAListResponse>(
        `${META_URLS.GRAPH_API}/${businessId}/${edge}`,
        { headers: { Authorization: `Bearer ${userToken}` } }
      );
      if (response.data.data && response.data.data.length > 0) {
        const waba = response.data.data[0];
        console.log(`[DISCOVER_WABA] WABA encontrada via ${edge}: ${waba.id}`);
        await logIntegrationStep('waba_discovery', strategy, true, restaurantId, {
          business_id: businessId,
          waba_id: waba.id
        });
        return { found: true, waba_id: waba.id, business_id: businessId, strategy };
      }
    } catch (error: any) {
      console.warn(`[DISCOVER_WABA] Edge ${edge} falhou ou retornou vazia:`, error.response?.data?.error);
    }
  }

  console.log('[DISCOVER_WABA] Nenhuma WABA encontrada para o BM:', businessId);
  return { found: false, business_id: businessId };
}

/**
 * ESTRATÉGIA 2 (CORRIGIDA): Cria WABA via BSP usando o endpoint, BM e token corretos.
 */
export async function createWABAViaBSP(clientBusinessId: string, restaurantId: string): Promise<WABACreationResult> {
  try {
    const bspBusinessId = BSP_CONFIG.BSP_BUSINESS_ID;
    const bspToken = BSP_CONFIG.SYSTEM_USER_ACCESS_TOKEN;
    const wabaName = `Angu.ai Integration - ${restaurantId}`;

    console.log(`[CREATE_WABA_BSP] Iniciando criação de WABA para client_business_id: ${clientBusinessId}`);
    
    const response = await axios.post(
      `${META_URLS.GRAPH_API}/${bspBusinessId}/client_whatsapp_business_accounts`,
      {
        name: wabaName,
        client_business_id: clientBusinessId
      },
      { headers: { Authorization: `Bearer ${bspToken}` } }
    );

    const wabaId = (response.data as any).id;
    console.log(`[CREATE_WABA_BSP] WABA criada com sucesso: ${wabaId}`);
    await logIntegrationStep('waba_creation', 'bsp_creation', true, restaurantId, {
      bsp_business_id: bspBusinessId,
      client_business_id: clientBusinessId,
      waba_id: wabaId,
    });
    return { success: true, waba_id: wabaId, details: response.data };
  } catch (error: any) {
    console.error('[CREATE_WABA_BSP] Falha na criação de WABA:', error.response?.data?.error);
    await logIntegrationStep('waba_creation', 'bsp_creation', false, restaurantId, {
      client_business_id: clientBusinessId,
      error: 'Falha ao criar WABA via BSP.',
      details: error.response?.data?.error
    });
    throw new Error('Falha ao criar WABA. Verifique as capabilities do App do BSP e permissões do System User.');
  }
}

export default {
  discoverExistingWABA,
  createWABAViaBSP,
  logIntegrationStep
};
