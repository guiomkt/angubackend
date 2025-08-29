import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export const config = {
  path: "*",
  method: "*"
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  
  // Inicializar variáveis
  let supabaseToken = "";
  let restaurantId = "";
  let randomState = "";
  
  // Inicializar objeto decodedState com valores padrão
  let decodedState = {
    random: "",
    token: "",
    restaurantId: ""
  };
  
  try {
    if (state) {
      // Decodificar o state de base64 para JSON
      const stateJsonStr = atob(state);
      const parsedState = JSON.parse(stateJsonStr);
      
      // Atualizar o objeto decodedState com os valores parsedState
      decodedState = {
        ...decodedState,
        ...parsedState // Sobrescrever com valores do state
      };
      
      // Extrair variáveis para uso no template
      supabaseToken = decodedState.token || "";
      restaurantId = decodedState.restaurantId || "";
      randomState = decodedState.random || "";
      
      console.log("Estado decodificado com sucesso:", decodedState);
    }
  } catch (error) {
    console.error("Erro ao decodificar estado:", error);
  }
  
  // HTML para redirecionamento com token incluído
  const htmlResponse = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Redirecionando...</title>
      <script>
        // Salvar token para uso pelo callback
        try {
          if ("${supabaseToken}") {
            localStorage.setItem("supabase_temp_token", "${supabaseToken}");
            localStorage.setItem("restaurant_id", "${restaurantId}");
            
            // Também salvar o objeto decodedState completo
            const stateObj = ${JSON.stringify(decodedState)};
            localStorage.setItem("whatsapp_decoded_state", JSON.stringify(stateObj));
          }
        } catch (e) {
          console.error("Erro ao salvar token temporário:", e);
        }
        
        // Inicializar escuta para eventos do Facebook em caso de cadastro incorporado
        window.addEventListener('message', function(event) {
          // Verificar se o evento vem do Facebook
          if (event.origin.includes('facebook.com')) {
            console.log('Mensagem recebida do processo de cadastro do Facebook:', event.data);
            
            try {
              // Dados podem vir como string JSON ou objeto direto
              const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
              
              // Se for um evento de cadastro incorporado
              if (data.type === 'WA_EMBEDDED_SIGNUP') {
                console.log('Evento de cadastro embutido do WhatsApp:', data);
                
                // Adicionar ao histórico visual
                const debugDiv = document.getElementById('debug');
                if (debugDiv) {
                  const entry = document.createElement('div');
                  // Escape das template strings para evitar problemas de parse
                  entry.innerHTML = "<p><strong>Evento WhatsApp:</strong> " + data.event + "</p>" +
                                   "<pre>" + JSON.stringify(data.data || {}, null, 2) + "</pre>";
                  debugDiv.appendChild(entry);
                }
              }
            } catch (e) {
              console.error('Erro ao processar mensagem:', e);
            }
          }
        });
        
        // Redirect to your callback page with parameters
        window.location.href = "/whatsapp-callback.html?code=${code}&state=${state}";
      </script>
    </head>
    <body>
      <h1>Redirecionando...</h1>
      <p>Você será redirecionado automaticamente. Se não for redirecionado, <a 
        href="/whatsapp-callback.html?code=${code}&state=${state}">clique aqui</a>.</p>
      
      <div id="debug" style="margin-top: 20px; border: 1px solid #ccc; padding: 10px; font-family: monospace;">
        <p>Código: ${code ? "presente" : "ausente"}</p>
        <p>Estado: ${state ? "presente" : "ausente"}</p>
        <p>Token: ${supabaseToken ? supabaseToken.substring(0, 10) + "..." : "ausente"}</p>
        <p>Restaurant ID: ${restaurantId || "ausente"}</p>
        <p>Random Value: ${randomState || "ausente"}</p>
        <p>Estado completo decodificado:</p>
        <pre>${JSON.stringify(decodedState, null, 2)}</pre>
        <hr>
        <p><strong>Logs de eventos do cadastro WhatsApp:</strong></p>
      </div>
    </body>
    </html>
  `;
  
  return new Response(htmlResponse, {
    headers: {
      "Content-Type": "text/html",
      "Cache-Control": "no-store, max-age=0",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
    },
    status: 200
  });
}); 