# WhatsApp Business Cloud API - Integração Completa

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura Implementada](#arquitetura-implementada)
3. [Correções Implementadas](#correções-implementadas)
4. [Endpoints Implementados](#endpoints-implementados)
5. [Estrutura de Banco de Dados](#estrutura-de-banco-de-dados)
6. [Configuração](#configuração)
7. [Logs e Monitoramento](#logs-e-monitoramento)
8. [Exemplo de Uso](#exemplo-de-uso)
9. [Testes](#testes)
10. [Status da Implementação](#status-da-implementação)

---

## 🎯 Visão Geral

Este documento descreve a implementação completa do fluxo de integração com WhatsApp Business Cloud API seguindo exatamente as especificações corretas da Meta API. O sistema implementa descoberta de WABA existente e criação via BSP com sistema de polling robusto.

### Fluxo Principal
```
OAuth Dialog Meta → Callback com code → Troca code → User Access Token → 
Descoberta/Criação de WABA → Polling para verificar criação → 
Registro de número → Configuração final
```

---

## 🏗️ Arquitetura Implementada

### 1. Estratégias de Integração

#### ESTRATÉGIA 1: Descoberta de WABA Existente
- ✅ Busca WABA existente via business_id usando edges corretas
- ✅ `/owned_whatsapp_business_accounts` (WABA próprias do business)
- ✅ `/client_whatsapp_business_accounts` (WABA vinculadas ao business)
- ✅ Logs detalhados de cada tentativa

#### ESTRATÉGIA 2: Criação via BSP
- ✅ `POST /{BSP_BUSINESS_ID}/client_whatsapp_business_accounts`
- ✅ Parâmetro `client_business_id` obrigatório
- ✅ Usa `SYSTEM_USER_ACCESS_TOKEN` do BSP
- ✅ Logs detalhados de criação

### 2. Sistema de Polling
- ✅ 10 tentativas por padrão
- ✅ Intervalo de 3 segundos entre tentativas
- ✅ Logs detalhados de cada tentativa
- ✅ Timeout configurável

---

## ✅ Correções Implementadas

### 1. **Escopos/Permissions Faltando no Token do Usuário**
**❌ Problema**: Log mostrava "Requires business_management"
**✅ Solução**: Adicionado `business_management` aos escopos OAuth

```typescript
// ANTES (incorreto)
OAUTH_SCOPES: [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'pages_show_list',
  'pages_read_engagement'
]

// DEPOIS (correto)
OAUTH_SCOPES: [
  'business_management',           // ✅ ADICIONADO: Necessário para /me/businesses
  'whatsapp_business_management',  // Para gerenciar WABA
  'whatsapp_business_messaging',   // Para enviar mensagens
  'pages_show_list',              // Para listar páginas
  'pages_read_engagement'         // Para ler dados das páginas
]
```

### 2. **Campos/Edges Incorretos**
**❌ Problema**: Consultava `whatsapp_business_accounts` como campo de Business e Page
**✅ Solução**: Usa as edges corretas do Business

```typescript
// ANTES (incorreto)
`${META_URLS.GRAPH_API}/${businessId}?fields=whatsapp_business_accounts{id,name,status}`

// DEPOIS (correto)
// Para WABA owned (próprias do business)
`${META_URLS.GRAPH_API}/${businessId}/owned_whatsapp_business_accounts`

// Para WABA client (vinculadas ao business)
`${META_URLS.GRAPH_API}/${businessId}/client_whatsapp_business_accounts`
```

### 3. **Endpoint de Criação Errado + Business Invertido**
**❌ Problema**: Tentava `/{business_id}/client_whatsapp_applications` e POST em `whatsapp_business_accounts` "solto"
**✅ Solução**: Criação correta via BSP

```typescript
// ANTES (incorreto)
POST /{business_id}/client_whatsapp_applications
POST /whatsapp_business_accounts

// DEPOIS (correto)
POST /{BSP_BUSINESS_ID}/client_whatsapp_business_accounts
{
  "name": "Integration for Angu.ai",
  "client_business_id": "{CLIENT_BUSINESS_ID}"  // ✅ Parâmetro obrigatório
}
```

### 4. **Remoção de Verificação em Páginas**
**❌ Problema**: Página não é fonte de WABA
**✅ Solução**: Removida verificação em páginas, foco apenas no Business Manager

---

## 🚀 Endpoints Implementados

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

### 3. POST /api/whatsapp/waba/create-via-bsp
Cria WABA via BSP usando endpoint correto.

**Input:**
```json
{
  "business_id": "string",
  "restaurant_id": "uuid"
}
```

**Output:**
```json
{
  "success": true,
  "message": "WABA criada com sucesso via BSP",
  "data": {
    "waba_id": "string",
    "strategy": "bsp_client_whatsapp_business_accounts",
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
  "message": "Integração concluída via BSP",
  "data": {
    "waba_id": "string",
    "strategy": "bsp_client_whatsapp_business_accounts",
    "status": "completed",
    "integration_id": "uuid"
  }
}
```

---

## 🗄️ Estrutura de Banco de Dados

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

### View: whatsapp_integration_status
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

---

## ⚙️ Configuração

### Variáveis de Ambiente Necessárias
```env
# Meta OAuth (com escopos corretos)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# WhatsApp BSP
WHATSAPP_BSP_TOKEN=your_bsp_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
WEBHOOK_URL=your_webhook_url
API_BASE_URL=your_api_base_url

# OAuth Scopes CORRETOS
OAUTH_SCOPES=business_management,whatsapp_business_management,whatsapp_business_messaging,pages_show_list,pages_read_engagement
```

### App Dashboard - Configurações Necessárias
1. ✅ Adicionar produto WhatsApp Business Management
2. ✅ Garantir `whatsapp_business_management` (Advanced Access)
3. ✅ Vincular o App ao Business Manager do BSP
4. ✅ System User deve ter permissões necessárias

---

## 📊 Logs e Monitoramento

### Logs de Integração
Cada etapa do processo é logada na tabela `whatsapp_integration_logs` com:
- **Step**: Etapa do processo (oauth, token_exchange, waba_discovery, etc.)
- **Strategy**: Estratégia utilizada
- **Success**: Sucesso/falha da operação
- **Error message**: Mensagem de erro se houver
- **Details**: Detalhes em JSON

### Logs Detalhados Implementados
- 🔄 **[TOKEN_EXCHANGE]**: Logs detalhados da troca de token
- 🔍 **[DISCOVERY]**: Logs detalhados da descoberta de WABA
- 🚀 **[BSP_CREATION]**: Logs detalhados da criação via BSP
- ⏳ **[POLLING]**: Logs detalhados do sistema de polling
- 🎯 **[FINALIZATION]**: Logs detalhados da finalização
- 📝 **[LOGGING]**: Logs detalhados do sistema de logs

### Tratamento de Erros
- Códigos de erro do Facebook
- Estratégias de retry
- Fallback para criação manual

---

## 💻 Exemplo de Uso

### Fluxo Completo
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

### Endpoints Individuais
```typescript
// 1. Trocar code por token
const tokenResponse = await fetch('/api/whatsapp/auth/exchange-token', {
  method: 'POST',
  body: JSON.stringify({ code, state, restaurant_id })
});

// 2. Descobrir WABA
const discoverResponse = await fetch('/api/whatsapp/waba/discover-or-create', {
  method: 'POST',
  body: JSON.stringify({ access_token, restaurant_id })
});

// 3. Criar WABA (se necessário)
if (!discoverResponse.data.found) {
  const createResponse = await fetch('/api/whatsapp/waba/create-via-bsp', {
    method: 'POST',
    body: JSON.stringify({ business_id, restaurant_id })
  });
}

// 4. Polling
const pollingResponse = await fetch('/api/whatsapp/waba/polling-system', {
  method: 'POST',
  body: JSON.stringify({ business_id, access_token, restaurant_id })
});
```

---

## 🧪 Testes

### Arquivo de Teste
- **`test-whatsapp-integration.js`** - Testes completos
- Testa fluxo completo
- Testa endpoints individuais
- Verifica status da integração

### Como Executar
```bash
node test-whatsapp-integration.js
```

---

## ✅ Status da Implementação

- [x] **OAuth Dialog Meta** - Implementado
- [x] **Callback com code** - Implementado
- [x] **Troca code → User Access Token** - Implementado
- [x] **Descoberta de WABA existente** - Implementado
- [x] **Criação via BSP** - Implementado
- [x] **Sistema de polling** - Implementado
- [x] **Logs detalhados** - Implementado
- [x] **Tratamento de erros** - Implementado
- [x] **Documentação completa** - Implementado
- [x] **Testes** - Implementado

### Melhorias Implementadas
1. **Robustez**: Múltiplas estratégias com fallback
2. **Monitoramento**: Logs detalhados de cada operação
3. **Escalabilidade**: Estrutura preparada para múltiplos restaurantes
4. **Manutenibilidade**: Código bem documentado e testado
5. **Performance**: Polling otimizado com timeout
6. **Segurança**: Validação de tokens e permissões

---

## 🎉 Resultado Final

**IMPLEMENTAÇÃO 100% COMPLETA** seguindo exatamente as especificações corretas da Meta API. O sistema agora possui:

1. ✅ **Escopos corretos**: `business_management` + `whatsapp_business_management`
2. ✅ **Edges corretas**: `/owned_whatsapp_business_accounts` e `/client_whatsapp_business_accounts`
3. ✅ **Endpoint correto**: `/{BSP_BUSINESS_ID}/client_whatsapp_business_accounts`
4. ✅ **Parâmetros corretos**: `client_business_id` obrigatório
5. ✅ **Token correto**: `SYSTEM_USER_ACCESS_TOKEN` do BSP
6. ✅ **Logs detalhados**: Monitoramento completo de cada processo
7. ✅ **Remoção de páginas**: Foco apenas no Business Manager

O sistema está pronto para produção e pode lidar com todos os cenários de integração WhatsApp Business Cloud API.

---

**Status**: ✅ IMPLEMENTAÇÃO COMPLETA  
**Data**: 2024-01-25  
**Versão**: 2.0.0 (Corrigida e com Logs Detalhados)

---

## 📖 Guia do Usuário - Como Criar uma Conta WhatsApp Business

### ⚠️ Problema Comum
Se você receber a mensagem: *"OAuth concluído, mas nenhuma conta WhatsApp Business foi encontrada"*, significa que você precisa criar uma conta WhatsApp Business no Facebook Business Manager.

### 🔧 Solução Passo a Passo

#### 1. Acesse o Facebook Business Manager
- Vá para [https://business.facebook.com](https://business.facebook.com)
- Faça login com sua conta do Facebook

#### 2. Crie ou Selecione um Business
- Se você não tem um Business Manager, crie um
- Se já tem, selecione o business apropriado

#### 3. Navegue para WhatsApp Business
- No menu lateral, clique em **"Configurações"** (ícone de engrenagem)
- Clique em **"Contas"** → **"Contas do WhatsApp"**

#### 4. Adicione uma Conta WhatsApp Business
- Clique no botão **"Adicionar"** (azul)
- Selecione **"Criar uma nova conta do WhatsApp Business"**
- Siga o assistente de configuração

#### 5. Configure sua Conta
- **Nome da conta**: Use o nome do seu negócio
- **Categoria**: Selecione a categoria apropriada
- **País**: Selecione seu país
- **Moeda**: Selecione a moeda do seu país

#### 6. Adicione um Número de Telefone
- Clique em **"Adicionar número de telefone"**
- Digite seu número de telefone comercial
- Verifique o número via SMS ou chamada
- Configure um PIN de 6 dígitos

#### 7. Complete a Configuração
- Adicione informações do seu negócio
- Configure o perfil comercial
- Revise e confirme todas as informações

#### 8. Volte ao Sistema
- Após criar a conta WhatsApp Business
- Volte ao sistema e clique em **"Conectar WhatsApp Business"** novamente
- O sistema agora deve encontrar sua conta automaticamente

### 🆘 Precisa de Ajuda?
- **Documentação oficial**: [Meta for Developers - WhatsApp Business](https://developers.facebook.com/docs/whatsapp/)
- **Suporte**: Entre em contato com o suporte técnico

