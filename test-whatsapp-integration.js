/**
 * Teste do fluxo completo de integração WhatsApp Business Cloud API
 * 
 * Este arquivo demonstra como usar os novos endpoints implementados
 * para integrar um restaurante com WhatsApp Business.
 */

const axios = require('axios');

// Configuração
const API_BASE_URL = 'http://localhost:3001'\;
const RESTAURANT_ID = 'your-restaurant-uuid-here';

// Exemplo de uso do fluxo completo
async function testCompleteFlow() {
  try {
    console.log('🚀 Iniciando teste do fluxo completo...');

    // Simular dados do callback OAuth
    const oauthData = {
      code: 'authorization_code_from_facebook',
      state: encodeURIComponent(JSON.stringify({ 
        user_id: 'user_uuid',
        restaurant_id: RESTAURANT_ID 
      })),
      restaurant_id: RESTAURANT_ID
    };

    // 1. Executar fluxo completo
    console.log('📞 Executando fluxo completo...');
    const response = await axios.post(`${API_BASE_URL}/api/whatsapp/waba/complete-flow`, oauthData);
    
    console.log('✅ Resposta do fluxo completo:', response.data);

    if (response.data.success) {
      console.log('🎉 Integração concluída com sucesso!');
      console.log('📊 Dados da integração:', response.data.data);
    } else {
      console.log('❌ Falha na integração:', response.data.message);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
  }
}

// Exemplo de uso dos endpoints individuais
async function testIndividualEndpoints() {
  try {
    console.log('🔧 Testando endpoints individuais...');

    // 1. Trocar code por token
    console.log('🔄 Testando troca de token...');
    const tokenResponse = await axios.post(`${API_BASE_URL}/api/whatsapp/auth/exchange-token`, {
      code: 'authorization_code',
      state: encodeURIComponent(JSON.stringify({ user_id: 'user_uuid' })),
      restaurant_id: RESTAURANT_ID
    });
    console.log('✅ Token trocado:', tokenResponse.data);

    // 2. Descobrir WABA
    console.log('🔍 Testando descoberta de WABA...');
    const discoverResponse = await axios.post(`${API_BASE_URL}/api/whatsapp/waba/discover-or-create`, {
      access_token: tokenResponse.data.data.access_token,
      restaurant_id: RESTAURANT_ID
    });
    console.log('✅ WABA descoberta:', discoverResponse.data);

    // 3. Criar WABA (se necessário)
    if (!discoverResponse.data.data.found) {
      console.log('🚀 Testando criação de WABA...');
      const createResponse = await axios.post(`${API_BASE_URL}/api/whatsapp/waba/create-strategies`, {
        business_id: discoverResponse.data.data.business_id,
        access_token: tokenResponse.data.data.access_token,
        restaurant_id: RESTAURANT_ID
      });
      console.log('✅ WABA criada:', createResponse.data);

      // 4. Polling (se WABA foi criada)
      if (createResponse.data.success) {
        console.log('⏳ Testando sistema de polling...');
        const pollingResponse = await axios.post(`${API_BASE_URL}/api/whatsapp/waba/polling-system`, {
          business_id: discoverResponse.data.data.business_id,
          access_token: tokenResponse.data.data.access_token,
          restaurant_id: RESTAURANT_ID,
          max_attempts: 5
        });
        console.log('✅ Polling concluído:', pollingResponse.data);
      }
    }

  } catch (error) {
    console.error('❌ Erro nos testes individuais:', error.response?.data || error.message);
  }
}

// Exemplo de verificação de status
async function checkIntegrationStatus() {
  try {
    console.log('📊 Verificando status da integração...');
    
    // Buscar logs de integração
    const logsResponse = await axios.get(`${API_BASE_URL}/api/whatsapp/integration-logs/${RESTAURANT_ID}`);
    console.log('📋 Logs de integração:', logsResponse.data);

    // Buscar status consolidado
    const statusResponse = await axios.get(`${API_BASE_URL}/api/whatsapp/integration-status/${RESTAURANT_ID}`);
    console.log('📈 Status consolidado:', statusResponse.data);

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error.response?.data || error.message);
  }
}

// Executar testes
async function runTests() {
  console.log('🧪 Iniciando testes da integração WhatsApp...\n');

  // Teste 1: Fluxo completo
  await testCompleteFlow();
  console.log('\n' + '='.repeat(50) + '\n');

  // Teste 2: Endpoints individuais
  await testIndividualEndpoints();
  console.log('\n' + '='.repeat(50) + '\n');

  // Teste 3: Verificação de status
  await checkIntegrationStatus();

  console.log('\n✅ Testes concluídos!');
}

// Executar se chamado diretamente
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testCompleteFlow,
  testIndividualEndpoints,
  checkIntegrationStatus
};
