import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Função para verificar e validar o token de autorização
const verifyAuth = (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    console.log("Cabeçalho de Authorization ausente");
    return false;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log("Formato inválido do cabeçalho Authorization:", authHeader);
    return false;
  }
  
  const token = parts[1];
  const validToken = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonToken = Deno.env.get("SUPABASE_ANON_KEY");
  
  if (token !== validToken && token !== anonToken) {
    console.log("Token inválido fornecido");
    return false;
  }
  
  return true;
};

// Função para verificar permissões do Facebook
const verifyFacebookPermissions = async (accessToken: string) => {
  try {
    // Se for o token permanente, vamos verificar de outra forma
    if (accessToken === Deno.env.get("WHATSAPP_TOKEN_PERMANENT")) {
      // Fazer uma chamada de teste para a API do WhatsApp
      const testResponse = await fetch(`https://graph.facebook.com/v22.0/debug_token?input_token=${accessToken}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!testResponse.ok) {
        throw new Error('Token permanente inválido ou expirado');
      }
      
      const tokenInfo = await testResponse.json();
      
      // Verificar se o token tem os escopos necessários
      const scopes = tokenInfo.data?.scopes || [];
      const requiredScopes = [
        'whatsapp_business_management',
        'business_management'
      ];
      
      const hasAllScopes = requiredScopes.every((scope) => scopes.includes(scope));
      if (!hasAllScopes) {
        throw new Error('Token permanente não possui todas as permissões necessárias');
      }
      
      return true;
    } else {
      // Para tokens normais, manter a verificação original
      const permissionsResponse = await fetch(`https://graph.facebook.com/v22.0/me/permissions?access_token=${accessToken}`);
      
      if (!permissionsResponse.ok) {
        throw new Error('Falha ao verificar permissões');
      }
      
      const permissions = await permissionsResponse.json();
      const requiredPermissions = [
        'whatsapp_business_management',
        'business_management'
      ];
      
      const hasAllPermissions = requiredPermissions.every((perm) => 
        permissions.data.some((p: any) => p.permission === perm && p.status === 'granted')
      );
      
      if (!hasAllPermissions) {
        throw new Error('Permissões necessárias do Facebook não concedidas');
      }
      
      return true;
    }
  } catch (error: any) {
    console.error("Erro na verificação de permissões:", error);
    throw new Error(`Falha na verificação de permissões: ${error.message}`);
  }
};

// Função para validar credenciais
const validateCredential = (credential: any) => {
  const required = [
    'phone_number_id',
    'waba_id',
    'business_id'
  ];
  
  const missing = required.filter((field) => !credential[field]);
  if (missing.length > 0) {
    throw new Error(`Campos obrigatórios ausentes: ${missing.join(', ')}`);
  }
};

// Função para salvar dados no Supabase
const saveWhatsAppData = async (supabaseClient: any, data: any) => {
  const { restaurantId, credential, accessToken, phone_number } = data;
  const currentTime = new Date().toISOString();
  
  // Dados base para ambas as tabelas
  const credentialData = {
    restaurant_id: restaurantId,
    phone_number: phone_number || credential.phone_number || '',
    phone_number_id: credential.phone_number_id,
    whatsapp_business_account_id: credential.waba_id,
    business_name: credential.business_name || '',
    status: 'connected',
    updated_at: currentTime,
    access_token: accessToken
  };
  
  const integrationData = {
    restaurant_id: restaurantId,
    status: "connected",
    connection_token: accessToken,
    phone_number: credential.phone_number || phone_number || "",
    instance_name: "WhatsApp Business",
    phone_number_id: credential.phone_number_id,
    whatsapp_business_account_id: credential.waba_id,
    updated_at: currentTime
  };
  
  try {
    // Verificar e atualizar/inserir em whatsapp_credentials
    const { data: existingCredential } = await supabaseClient
      .from('whatsapp_credentials')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    
    if (existingCredential) {
      // Atualizar registro existente
      const { error: updateCredError } = await supabaseClient
        .from('whatsapp_credentials')
        .update(credentialData)
        .eq('restaurant_id', restaurantId);
      
      if (updateCredError) throw updateCredError;
    } else {
      // Inserir novo registro
      const { error: insertCredError } = await supabaseClient
        .from('whatsapp_credentials')
        .insert({
          ...credentialData,
          created_at: currentTime
        });
      
      if (insertCredError) throw insertCredError;
    }
    
    // Verificar e atualizar/inserir em whatsapp_integrations
    const { data: existingIntegration } = await supabaseClient
      .from('whatsapp_integrations')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    
    if (existingIntegration) {
      // Atualizar registro existente
      const { error: updateIntError } = await supabaseClient
        .from('whatsapp_integrations')
        .update(integrationData)
        .eq('restaurant_id', restaurantId);
      
      if (updateIntError) throw updateIntError;
    } else {
      // Inserir novo registro
      const { error: insertIntError } = await supabaseClient
        .from('whatsapp_integrations')
        .insert({
          ...integrationData,
          created_at: currentTime
        });
      
      if (insertIntError) throw insertIntError;
    }
    
    return true;
  } catch (error: any) {
    console.error("Erro ao salvar dados:", error);
    throw new Error(`Falha ao salvar dados: ${error.message}`);
  }
};

// Função principal de processamento
const processWhatsAppIntegration = async (requestData: any) => {
  const { accessToken, restaurantId, credential, phone_number } = requestData;
  
  // Validar dados recebidos
  validateCredential(credential);
  
  // Verificar permissões do Facebook
  await verifyFacebookPermissions(accessToken);
  
  // Criar cliente Supabase
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") || "", 
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
  
  // Salvar dados
  await saveWhatsAppData(supabaseClient, {
    restaurantId,
    credential,
    accessToken,
    phone_number
  });
  
  return {
    success: true,
    credential: {
      phoneNumber: phone_number || credential.phone_number,
      phoneNumberId: credential.phone_number_id,
      businessName: credential.business_name,
      status: "connected",
      businessId: credential.business_id,
      whatsappBusinessAccountId: credential.waba_id
    }
  };
};

// Handler principal
Deno.serve(async (req: Request) => {
  // Lidar com solicitações OPTIONS (preflight CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  
  try {
    // Verificar autenticação
    if (!verifyAuth(req)) {
      throw new Error("Não autorizado");
    }
    
    // Processar requisição
    const requestData = await req.json();
    const result = await processWhatsAppIntegration(requestData);
    
    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
    
  } catch (error: any) {
    console.error("Erro no processamento:", error);
    
    const errorResponse = {
      success: false,
      error: error.message || "Erro interno do servidor",
      details: error.stack
    };
    
    return new Response(JSON.stringify(errorResponse), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: error.message === "Não autorizado" ? 401 : 500
    });
  }
}); 