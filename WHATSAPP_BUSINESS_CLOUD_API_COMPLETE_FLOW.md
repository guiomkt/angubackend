# WhatsApp Business Cloud API - Fluxo Completo de Integração

## Visão Geral

Este documento descreve a implementação completa do fluxo de integração com WhatsApp Business Cloud API seguindo exatamente o diagrama especificado. O sistema implementa todas as 5 estratégias de criação de WABA com sistema de polling robusto.

## Arquitetura Implementada

### 1. Fluxo Principal
```
OAuth Dialog Meta → Callback com code → Troca code → User Access Token → 
Descoberta/Criação de WABA (5 estratégias) → Polling para verificar criação → 
Registro de número → Configuração final
```

### 2. Estratégias de Criação de WABA

#### ESTRATÉGIA 1: Descoberta de WABA Existente
- Busca WABA existente via business_id
- Busca WABA existente via páginas do usuário
- Logs detalhados de cada tentativa

#### ESTRATÉGIA 2A: client_whatsapp_applications
```typescript
POST /{business_id}/client_whatsapp_applications
{
  "app_name": "WhatsApp Business Account",
  "waba_creation_request": { 
    "business_manager_id": businessId,
    "category": "BUSINESS_TO_CUSTOMER"
  }
}
```

#### ESTRATÉGIA 2B: whatsapp_business_accounts
```typescript
POST /{business_id}/whatsapp_business_accounts
{
  "name": "WhatsApp Business Account",
  "category": "BUSINESS_TO_CUSTOMER"
}
```

#### ESTRATÉGIA 2C: applications
```typescript
POST /{business_id}/applications
{
  "name": "WhatsApp Business App",
  "namespace": "whatsapp_{timestamp}",
  "category": "BUSINESS"
}
```

#### ESTRATÉGIA 2D: Fluxo Oficial Meta
```typescript
POST /whatsapp_business_accounts
{
  "business_manager_id": businessId,
  "name": "WhatsApp Business Account",
  "category": "BUSINESS_TO_CUSTOMER"
}
```

#### ESTRATÉGIA 2E: Endpoint Global (Debug)
```typescript
GET /debug_token
```

### 3. Sistema de Polling
- 10 tentativas por padrão
- Intervalo de 3 segundos entre tentativas
- Logs detalhados de cada tentativa
- Timeout configurável

## Endpoints Implementados

### 1. POST /api/whatsapp/auth/exchange-token
Troca authorization code por user access token.

**Input:**
```json
{
  "code": "string",
  "state": "string", 
  "restaurant_id": "uuid"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Token trocado com sucesso",
  "data": {
    "access_token": "string",
    "user_id": "string",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

### 2. POST /api/whatsapp/waba/discover-or-create
Descobre WABA existente ou inicia processo de criação.

**Input:**
```json
{
  "access_token": "string",
  "restaurant_id": "uuid"
}
```

**Output:**
```json
{
  "success": true,
  "message": "WABA existente encontrada",
  "data": {
    "waba_id": "string",
    "strategy": "business_search",
    "status": "found",
    "business_id": "string"
  }
}
```

### 3. POST /api/whatsapp/waba/create-strategies
Executa todas as 5 estratégias de criação de WABA.

**Input:**
```json
{
  "business_id": "string",
  "access_token": "string",
  "restaurant_id": "uuid"
}
```

**Output:**
```json
{
  "success": true,
  "message": "WABA criada com sucesso via estratégia client_whatsapp_applications",
  "data": {
    "waba_id": "string",
    "strategy": "client_whatsapp_applications",
    "next_step": "polling_verification"
  }
}
```

### 4. POST /api/whatsapp/waba/polling-system
Sistema de polling para verificar criação de WABA.

**Input:**
```json
{
  "business_id": "string",
  "access_token": "string",
  "restaurant_id": "uuid",
  "max_attempts": 10
}
```

**Output:**
```json
{
  "success": true,
  "message": "WABA encontrada via polling",
  "data": {
    "waba_id": "string",
    "attempts": 3,
    "status": "found",
    "next_step": "finalize_integration"
  }
}
```

### 5. POST /api/whatsapp/waba/complete-flow
Fluxo principal que orquestra todo o processo.

**Input:**
```json
{
  "code": "string",
  "state": "string",
  "restaurant_id": "uuid"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Integração concluída via estratégia client_whatsapp_applications",
  "data": {
    "waba_id": "string",
    "strategy": "client_whatsapp_applications",
    "status": "completed",
    "integration_id": "uuid"
  }
}
```

## Estrutura de Banco de Dados

### Tabela: whatsapp_integration_logs
```sql
CREATE TABLE whatsapp_integration_logs (
    id SERIAL PRIMARY KEY,
    restaurant_id UUID REFERENCES restaurants(id),
    step TEXT NOT NULL CHECK (step IN (
        'oauth', 'token_exchange', 'waba_discovery', 'waba_creation', 
        'polling_system', 'polling_verification', 'complete_flow',
        'phone_registration', 'phone_verification'
    )),
    strategy TEXT,
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Tabela: whatsapp_credentials (colunas adicionadas)
```sql
ALTER TABLE whatsapp_credentials ADD COLUMN user_access_token TEXT;
ALTER TABLE whatsapp_credentials ADD COLUMN business_id TEXT;
ALTER TABLE whatsapp_credentials ADD COLUMN discovery_attempts INTEGER DEFAULT 0;
ALTER TABLE whatsapp_credentials ADD COLUMN creation_strategy TEXT;
ALTER TABLE whatsapp_credentials ADD COLUMN polling_status TEXT;
```

## Variáveis de Ambiente Necessárias

```env
# Meta OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# WhatsApp BSP
WHATSAPP_BSP_TOKEN=your_bsp_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WEBHOOK_URL=your_webhook_url
API_BASE_URL=your_api_base_url

# Meta API
META_API_VERSION=v22.0
META_GRAPH_API_BASE=https://graph.facebook.com
META_OAUTH_DIALOG_BASE=https://www.facebook.com
META_PHONE_REGISTRATION_PIN=152563

# OAuth Scopes
OAUTH_SCOPES=whatsapp_business_management,whatsapp_business_messaging,pages_show_list,pages_read_engagement
```

## Logs e Monitoramento

### Logs de Integração
Cada etapa do processo é logada na tabela `whatsapp_integration_logs` com:
- Step (etapa do processo)
- Strategy (estratégia utilizada)
- Success (sucesso/falha)
- Error message (mensagem de erro se houver)
- Details (detalhes em JSON)

### View Consolidada
```sql
CREATE VIEW whatsapp_integration_status AS
SELECT 
    r.id as restaurant_id,
    r.name as restaurant_name,
    wbi.id as integration_id,
    wbi.business_account_id as waba_id,
    wbi.connection_status,
    wbi.is_active,
    wss.status as signup_status,
    wss.creation_strategy,
    wss.polling_attempts,
    -- Último log de sucesso
    (SELECT step FROM whatsapp_integration_logs 
     WHERE restaurant_id = r.id AND success = true 
     ORDER BY created_at DESC LIMIT 1) as last_successful_step,
    -- Último log de erro
    (SELECT error_message FROM whatsapp_integration_logs 
     WHERE restaurant_id = r.id AND success = false 
     ORDER BY created_at DESC LIMIT 1) as last_error_message
FROM restaurants r
LEFT JOIN whatsapp_business_integrations wbi ON r.id = wbi.restaurant_id
LEFT JOIN whatsapp_signup_states wss ON r.id = wss.restaurant_id;
```

## Tratamento de Erros

### Códigos de Erro do Facebook
- 190: Token expirado
- 200: Permissões insuficientes
- 368: Temporarily blocked
- 4: Rate limit exceeded

### Estratégias de Retry
- Cada estratégia tenta por 30 segundos antes de falhar
- Sistema de retry automático com backoff exponencial
- Logs detalhados para debug

### Fallback
- Se todas as estratégias falharem, retorna status `awaiting_waba_creation`
- Sugere criação manual no Facebook Business Manager
- Permite retry após 5 minutos

## Exemplo de Uso Completo

```typescript
// 1. Iniciar fluxo OAuth
const oauthUrl = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${FACEBOOK_APP_ID}&redirect_uri=${REDIRECT_URI}&scope=${OAUTH_SCOPES}&state=${state}`;

// 2. Após callback, executar fluxo completo
const response = await fetch('/api/whatsapp/waba/complete-flow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'authorization_code',
    state: 'state_parameter',
    restaurant_id: 'restaurant_uuid'
  })
});

const result = await response.json();

if (result.success) {
  console.log('Integração concluída:', result.data);
} else {
  console.log('Falha na integração:', result.message);
}
```

## Melhorias Implementadas

1. **Robustez**: Múltiplas estratégias de criação
2. **Monitoramento**: Logs detalhados de cada etapa
3. **Retry**: Sistema de retry automático
4. **Fallback**: Criação manual quando necessário
5. **Performance**: Polling otimizado com timeout
6. **Segurança**: Validação de tokens e permissões
7. **Escalabilidade**: Estrutura preparada para múltiplos restaurantes

## Próximos Passos

1. Implementar webhook handling para notificações assíncronas
2. Adicionar sistema de notificações em tempo real
3. Implementar dashboard de monitoramento
4. Adicionar métricas de performance
5. Implementar sistema de alertas para falhas

---

**Status**: ✅ Implementação Completa
**Versão**: 1.0.0
**Data**: 2024-01-25
