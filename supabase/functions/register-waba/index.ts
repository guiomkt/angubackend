import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Função para inscrever o app no WABA
async function subscribeAppToWABA(wabaId: string, token: string) {
  try {
    const response = await fetch(`https://graph.facebook.com/v22.0/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    //passando por cima
    const data = await response.json();
    if (!response.ok) {
      // Se já está inscrito, isso é ok
      if (data.error?.code === 100 && data.error?.error_subcode === 2018001) {
        return {
          success: true,
          message: 'App já inscrito no WABA'
        };
      }
      throw new Error(data.error?.message || 'Erro ao inscrever app no WABA');
    }
    return data;
  } catch (error) {
    console.error('Erro ao inscrever app no WABA:', error);
    throw error;
  }
}

// Função para verificar informações do WABA
async function getWABAInfo(wabaId: string, token: string) {
  try {
    const response = await fetch(`https://graph.facebook.com/v22.0/${wabaId}?fields=id,name,status,phone_numbers{id,display_phone_number,verified_name,status}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao buscar informações do WABA');
    }
    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar WABA:', error);
    throw error;
  }
}

// Função para registrar o número na API do WhatsApp Cloud
async function registerPhoneNumber(phoneNumberId: string, token: string) {
  try {
    const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "messaging_product": "whatsapp",
        "pin": "152563"
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Erro ao registrar número');
    }
    return data;
  } catch (error) {
    console.error('Erro ao registrar número:', error);
    throw error;
  }
}

// Função para verificar se o número está registrado
async function verifyPhoneNumber(phoneNumberId: string, token: string) {
  try {
    const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}?fields=verified_name,quality_rating,code_verification_status,display_phone_number,status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro ao verificar número');
    }
    return await response.json();
  } catch (error) {
    console.error('Erro na verificação do número:', error);
    throw error;
  }
}

// Função para configurar webhook no WABA
async function configureWABAWebhook(wabaId: string, token: string, callbackUrl: string) {
  try {
    // Verificar se já há webhook configurado
    const getResponse = await fetch(`https://graph.facebook.com/v22.0/${wabaId}/subscribed_apps`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const subscriptions = await getResponse.json();
    
    // Webhook é configurado no nível do app, não do WABA individual
    // Retornamos sucesso se o app já está inscrito
    if (subscriptions.data && subscriptions.data.length > 0) {
      return {
        success: true,
        message: 'Webhook já configurado via subscription do app'
      };
    }
    
    return {
      success: true,
      message: 'App inscrito no WABA - webhook será recebido'
    };
  } catch (error) {
    console.error('Erro na configuração do webhook:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Método não permitido'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const { restaurantId, credential } = await req.json();
    
    if (!restaurantId || !credential) {
      return new Response(JSON.stringify({
        error: 'Dados incompletos'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const phoneNumberId = credential.phone_number_id;
    const wabaId = credential.waba_id;
    const accessToken = credential.access_token;
    const callbackUrl = "https://hook.2be.com.br/webhook/wpp-metha-ai";

    console.log(`Configurando WABA: ${wabaId}, Phone: ${phoneNumberId}`);

    // 1. PRIMEIRO: Inscrever o app no WABA
    let subscriptionResult;
    try {
      subscriptionResult = await subscribeAppToWABA(wabaId, accessToken);
      console.log('Subscription resultado:', subscriptionResult);
    } catch (err: any) {
      return new Response(JSON.stringify({
        error: 'Erro ao inscrever app no WABA: ' + err.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 2. Buscar informações do WABA
    const wabaInfo = await getWABAInfo(wabaId, accessToken);
    console.log('WABA Info:', wabaInfo);

    // 3. Registrar o número específico
    let registrationResult;
    try {
      registrationResult = await registerPhoneNumber(phoneNumberId, accessToken);
      console.log('Registration resultado:', registrationResult);
    } catch (err: any) {
      console.warn('Aviso no registro do número:', err.message);
      registrationResult = {
        warning: err.message
      };
    }

    // 4. Verificar status do número
    const phoneStatus = await verifyPhoneNumber(phoneNumberId, accessToken);
    console.log('Phone status:', phoneStatus);

    // 5. Configurar webhook (nível WABA)
    const webhookStatus = await configureWABAWebhook(wabaId, accessToken, callbackUrl);

    // 6. Atualizar no Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const phoneNumberFormated = phoneStatus.display_phone_number.replace(/\D/g, '');

    // Atualizar com estrutura correta usando waba_id
    const { error: dbError } = await supabaseAdmin.from('whatsapp_credentials').upsert({
      restaurant_id: restaurantId,
      whatsapp_business_account_id: wabaId,
      phone_number_id: phoneNumberId,
      access_token: accessToken,
      phone_number: phoneNumberFormated,
      status: phoneStatus.status || 'CONNECTED',
      business_name: phoneStatus.verified_name || wabaInfo.name,
      webhook_status: 'configured',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'restaurant_id'
    });

    if (dbError) {
      throw new Error(`Erro ao atualizar banco: ${dbError.message}`);
    }

    // Atualizar outras tabelas
    await supabaseAdmin.from('whatsapp_integrations').update({
      status: phoneStatus.status || 'CONNECTED',
      last_connected: new Date().toISOString()
    }).eq('restaurant_id', restaurantId);

    await supabaseAdmin.from('restaurants').update({
      phone: phoneNumberFormated
    }).eq('id', restaurantId);

    return new Response(JSON.stringify({
      success: true,
      data: {
        waba_subscription: subscriptionResult,
        waba_info: wabaInfo,
        registration: registrationResult,
        phone_status: phoneStatus,
        webhook_status: webhookStatus
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('Erro detalhado:', error);
    return new Response(JSON.stringify({
      error: 'Erro ao configurar WhatsApp: ' + error.message,
      details: error
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}); 