import { Router, Request, Response } from 'express';
import { supabase } from '../config/database';
import WhatsAppIntegrationService, { logIntegrationStep } from '../services/whatsappIntegrationService';

const router = Router();

// Função mockada/simplificada para trocar o código por token.
// Em um cenário real, isso faria a chamada para a API da Meta.
async function exchangeCodeForToken(code: string, restaurantId: string): Promise<{ access_token: string }> {
  console.log(`[MOCK_TOKEN_EXCHANGE] Trocando código "${code}" para o restaurante ${restaurantId}`);
  // NÃO FAÇA ISSO EM PRODUÇÃO. O token deve vir da API da Meta.
  const mockAccessToken = `FAKE_TOKEN_FOR_${restaurantId}_${Date.now()}`;
  await logIntegrationStep('token_exchange', 'oauth_callback', true, restaurantId, { info: "Token trocado com sucesso (MOCK)." });
  return { access_token: mockAccessToken };
}

// Função mockada/simplificada para finalizar a integração.
// Em um cenário real, isso salvaria os detalhes da WABA no banco de dados.
async function finalizeIntegration(wabaId: string, businessId: string, restaurantId: string) {
  console.log(`[MOCK_FINALIZE] Finalizando integração para o restaurante ${restaurantId}`);
  console.log(`[MOCK_FINALIZE] Salvando WABA ID: ${wabaId} e Business ID: ${businessId}`);
  await supabase.from('whatsapp_business_integrations').upsert(
    { restaurant_id: restaurantId, business_account_id: wabaId, is_active: true },
    { onConflict: 'restaurant_id' }
  );
  console.log(`[MOCK_FINALIZE] Integração finalizada com sucesso.`);
}

/**
 * @swagger
 * /api/whatsapp/oauth/callback:
 *   get:
 *     summary: (CORRIGIDO) Callback do fluxo OAuth da Meta para integração.
 *     description: Orquestra o fluxo completo de descoberta ou criação de WABA.
 *     tags: [WhatsApp Integration]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         description: Authorization code retornado pela Meta.
 *       - in: query
 *         name: state
 *         required: true
 *         description: UUID do restaurante para validar a requisição.
 *     responses:
 *       '200':
 *         description: "Integração bem-sucedida."
 *       '400':
 *         description: "Erro de validação nos parâmetros."
 *       '500':
 *         description: "Falha crítica no fluxo de integração."
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state: restaurantId } = req.query;

  if (!code || typeof code !== 'string' || !restaurantId || typeof restaurantId !== 'string') {
    return res.status(400).json({ success: false, message: 'Parâmetros `code` e `state` (como restaurant_id) são obrigatórios.' });
  }

  try {
    // 1. Trocar o código por um User Access Token
    const { access_token } = await exchangeCodeForToken(code, restaurantId);

    // 2. Tentar descobrir uma WABA existente
    const discovery = await WhatsAppIntegrationService.discoverExistingWABA(access_token, restaurantId);

    if (discovery.found && discovery.waba_id && discovery.business_id) {
      // 3a. Se encontrou, finalizar a integração
      await finalizeIntegration(discovery.waba_id, discovery.business_id, restaurantId);
      return res.status(200).json({ 
        success: true, 
        message: 'WABA existente encontrada e integração finalizada.',
        data: { status: 'completed', waba_id: discovery.waba_id, business_id: discovery.business_id }
      });
    }

    // 3b. Se não encontrou, tentar criar uma WABA via BSP
    if (!discovery.business_id) {
      throw new Error("Business ID não foi encontrado, impossível prosseguir com a criação da WABA.");
    }

    const creation = await WhatsAppIntegrationService.createWABAViaBSP(discovery.business_id, restaurantId);

    if (creation.success && creation.waba_id) {
      // 4. Se a criação foi bem-sucedida, finalizar a integração
      await finalizeIntegration(creation.waba_id, discovery.business_id, restaurantId);
      return res.status(200).json({ 
        success: true, 
        message: 'WABA criada com sucesso via BSP e integração finalizada.',
        data: { status: 'completed', waba_id: creation.waba_id, business_id: discovery.business_id }
      });
    }
    
    // 5. Se a criação falhou
    throw new Error('Falha ao criar a WABA via BSP após a descoberta falhar.');

  } catch (error: any) {
    console.error('[CALLBACK_ERROR] Erro crítico no fluxo de integração:', error.message);
    await logIntegrationStep('complete_flow', 'oauth_callback', false, restaurantId, { error: error.message });
    return res.status(500).json({ 
      success: false, 
      message: 'Erro crítico no fluxo de integração.',
      error: error.message
    });
  }
});

export default router;
