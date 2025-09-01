# WhatsApp Business Cloud API - Sistema Completo de Integração

## 🎯 Visão Geral

Este sistema implementa o fluxo completo de integração com WhatsApp Business Cloud API da Meta, seguindo exatamente o diagrama especificado. O sistema é robusto, com tratamento de erro completo, logs detalhados e múltiplas estratégias de criação de WABA.

## 🔄 Fluxo Completo Implementado

### 1. OAuth Dialog Meta ✅
- **Endpoint**: `GET /api/whatsapp/signup/start`
- **Funcionalidade**: Gera URL de autorização OAuth com escopos necessários
- **Escopos**: `whatsapp_business_management`, `whatsapp_business_messaging`, `pages_show_list`, `pages_read_engagement`

### 2. Callback com code ✅
- **Endpoint**: `GET /api/whatsapp/oauth/callback-v2`
- **Funcionalidade**: Processa callback OAuth e salva tokens

### 3. Troca code → User Access Token ✅
- **Endpoint**: `POST /api/whatsapp/auth/exchange-token`
- **Funcionalidade**: Troca authorization code por access token válido
- **Input**: `{ code: string, state: string }`
- **Output**: `{ access_token: string, user_id: string, expires_in: number }`

### 4. Descoberta/Criação de WABA com 5 Estratégias ✅
- **Endpoint**: `POST /api/whatsapp/waba/create-strategies`
- **Funcionalidade**: Implementa todas as estratégias de criação automática

#### Estratégias Implementadas:

#### 🚀 ESTRATÉGIA 1: client_whatsapp_applications
```typescript
POST /{BSP_BUSINESS_ID}/client_whatsapp_applications
{
  "name": "WhatsApp Business - {timestamp}",
  "business_id": "{USER_BUSINESS_ID}",
  "category": "BUSINESS_TO_CUSTOMER"
}
```

#### 🚀 ESTRATÉGIA 2: whatsapp_business_accounts direto
```typescript
POST /{USER_BUSINESS_ID}/whatsapp_business_accounts
{
  "name": "WhatsApp Business - {timestamp}",
  "category": "BUSINESS_TO_CUSTOMER"
}
```

#### 🚀 ESTRATÉGIA 3: applications
```typescript
POST /{BSP_BUSINESS_ID}/applications
{
  "name": "WhatsApp Business App - {timestamp}",
  "namespace": "whatsapp_{timestamp}",
  "category": "BUSINESS",
  "business_id": "{USER_BUSINESS_ID}"
}
```

#### 🚀 ESTRATÉGIA 4: Fluxo oficial Meta
```typescript
POST /whatsapp_business_accounts
{
  "business_manager_id": "{USER_BUSINESS_ID}",
  "name": "WhatsApp Business - {timestamp}",
  "category": "BUSINESS_TO_CUSTOMER"
}
```

#### 🚀 ESTRATÉGIA 5: Endpoint global
```typescript
POST /whatsapp_business_accounts
{
  "name": "WhatsApp Business Global - {timestamp}",
  "category": "BUSINESS_TO_CUSTOMER"
}
```

### 5. Sistema de Polling ✅
- **Endpoint**: `POST /api/whatsapp/waba/polling-system`
- **Funcionalidade**: Verifica se WABA foi criada com sucesso
- **Características**:
  - 10 tentativas máximas
  - 3 segundos de intervalo
  - Verificação via múltiplos endpoints
  - Logs detalhados de cada tentativa

### 6. Registro de número ✅
- **Endpoint**: `POST /api/whatsapp/signup/register-phone`
- **Funcionalidade**: Registra número de telefone na WABA

### 7. Configuração final ✅
- **Endpoint**: `POST /api/whatsapp/waba/complete-flow`
- **Funcionalidade**: Orquestra todo o fluxo de integração

## 🛠️ Endpoints Disponíveis

### Autenticação e Tokens
- `POST /api/whatsapp/auth/exchange-token` - Troca code por access token

### Descoberta e Criação de WABA
- `POST /api/whatsapp/waba/discover-or-create` - Descobre WABA existente ou inicia criação
- `POST /api/whatsapp/waba/create-strategies` - Executa todas as estratégias de criação
- `POST /api/whatsapp/waba/polling-system` - Sistema de polling para verificação

### Fluxo Completo
- `POST /api/whatsapp/waba/complete-flow` - Endpoint principal que orquestra tudo

### Endpoints Existentes (mantidos)
- `GET /api/whatsapp/signup/start` - Inicia processo de signup
- `GET /api/whatsapp/signup/status` - Verifica status do processo
- `POST /api/whatsapp/signup/register-phone` - Registra número de telefone
- `POST /api/whatsapp/signup/verify-code` - Verifica código de verificação

## 🔧 Configuração

### Variáveis de Ambiente Necessárias
```bash
# Facebook App
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# API URLs
API_BASE_URL=https://api.angu.ai
FRONTEND_URL=https://angu.ai

# WhatsApp BSP (Business Solution Provider)
WHATSAPP_BSP_TOKEN=your_bsp_token
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token
WEBHOOK_URL=https://hook.2be.com.br/webhook/wpp-metha-ai
```

### Configuração BSP (Business Solution Provider)
```typescript
// src/config/meta.ts
export const BSP_CONFIG = {
  BSP_BUSINESS_ID: '100442081662109',
  SYSTEM_USER_ACCESS_TOKEN: 'your_system_user_token',
  PERMANENT_TOKEN: 'your_permanent_token'
} as const;
```

## 📊 Estrutura do Banco de Dados

### Tabelas Principais
1. **whatsapp_business_integrations** - Integrações ativas
2. **whatsapp_signup_states** - Estados do processo de signup
3. **meta_tokens** - Tokens OAuth dos usuários
4. **whatsapp_integration_logs** - Logs detalhados de todas as operações
5. **whatsapp_connection_logs** - Auditoria de mudanças de status

### Colunas Adicionadas
- `user_access_token` - Token de acesso do usuário
- `business_id` - ID do Business Manager
- `discovery_attempts` - Tentativas de descoberta
- `creation_strategy` - Estratégia utilizada
- `polling_status` - Status do polling
- `polling_attempts` - Tentativas de polling
- `last_polling_at` - Última tentativa de polling

## 🔍 Sistema de Logs e Auditoria

### Logs de Integração
Cada operação é registrada com:
- **step**: Etapa do processo (oauth, token_exchange, waba_discovery, etc.)
- **strategy**: Estratégia utilizada
- **success**: Se foi bem-sucedida
- **error_message**: Mensagem de erro (se houver)
- **details**: Detalhes adicionais em JSON

### View de Status Consolidado
```sql
SELECT * FROM whatsapp_integration_status;
```
Fornece visão completa do status de cada restaurante.

## 🚀 Como Usar

### 1. Iniciar Processo
```typescript
// Frontend chama
GET /api/whatsapp/signup/start
// Redireciona para Facebook OAuth
```

### 2. Processar Callback
```typescript
// Facebook redireciona para
GET /api/whatsapp/oauth/callback-v2?code=...&state=...
// Sistema processa automaticamente
```

### 3. Fluxo Completo (Recomendado)
```typescript
// Frontend chama diretamente
POST /api/whatsapp/waba/complete-flow
{
  "code": "oauth_code",
  "state": "encoded_state",
  "restaurant_id": "uuid"
}
```

### 4. Verificar Status
```typescript
// Verificar status atual
GET /api/whatsapp/signup/status?restaurant_id=uuid
```

## 🔒 Segurança

### Validação de State
- State é criptografado e contém user_id e restaurant_id
- Validação CSRF em todas as operações
- Verificação de permissões por restaurante

### Tokens
- User Access Token (OAuth) para operações do usuário
- System User Token (BSP) para criação automática
- Tokens são salvos criptografados no banco

### Auditoria
- Todas as operações são logadas
- Histórico de mudanças de status
- Rastreamento de tentativas e falhas

## 📈 Monitoramento e Debug

### Logs em Tempo Real
```typescript
// Ver logs de um restaurante específico
SELECT * FROM whatsapp_integration_logs 
WHERE restaurant_id = 'uuid' 
ORDER BY created_at DESC;
```

### Status de Integração
```typescript
// Ver status consolidado
SELECT * FROM whatsapp_integration_status 
WHERE restaurant_id = 'uuid';
```

### Métricas de Performance
- Tempo de resposta de cada estratégia
- Taxa de sucesso por estratégia
- Tentativas de polling necessárias
- Falhas e seus códigos de erro

## 🚨 Tratamento de Erros

### Códigos de Erro Facebook
- **100**: Campo não existe (esperado quando página não tem WABA)
- **2018001**: App já inscrito na WABA
- **190**: Token expirado ou inválido
- **4**: Rate limit atingido

### Estratégias de Fallback
1. **WABA existente**: Busca em businesses e páginas
2. **Criação automática**: 5 estratégias diferentes
3. **Polling robusto**: 10 tentativas com intervalo
4. **Logs detalhados**: Para debug e análise

### Retry Automático
- Sistema tenta cada estratégia por 30 segundos
- Polling com 10 tentativas e 3 segundos de intervalo
- Fallback para criação manual se todas falharem

## 🔄 Fluxo de Retry

### Quando WABA Falha
1. **Estratégias 1-5**: Tentativas de criação automática
2. **Polling robusto**: 10 tentativas com intervalo

### Sistema de Polling
```typescript
// Polling automático após criação
for (let attempt = 1; attempt <= 10; attempt++) {
  // Verificar se WABA foi criada
  await checkWABACreated(businessId, userToken);
  
  if (wabaFound) break;
  
  // Aguardar 3 segundos
  await delay(3000);
}
```

## 📱 Integração com Frontend

### Estados do Processo
```typescript
type SignupStatus = 
  | 'pending'
  | 'oauth_completed'
  | 'token_exchanged'
  | 'waba_detected'
  | 'waba_created'
  | 'awaiting_number_verification'
  | 'completed'
  | 'failed'
  | 'awaiting_waba_creation';
```

### Callbacks de Progresso
```typescript
// Frontend pode implementar
onStatusChange: (status: SignupStatus, data: any) => void
onError: (error: string, step: string) => void
onSuccess: (wabaId: string, strategy: string) => void
```

## 🧪 Testes

### Testes Unitários
- Cada estratégia testada individualmente
- Mock de respostas da API Facebook
- Validação de timeouts e retries

### Testes de Integração
- Fluxo completo end-to-end
- Teste de todas as estratégias
- Validação de logs e auditoria

### Testes de Performance
- Tempo de resposta de cada estratégia
- Uso de memória durante polling
- Performance do sistema de logs

## 📚 Documentação da API

### Swagger/OpenAPI
Todos os endpoints estão documentados com Swagger:
- Descrições detalhadas
- Schemas de request/response
- Exemplos de uso
- Códigos de erro

### Postman Collection
Collection completa para testes:
- Todos os endpoints
- Exemplos de payload
- Variáveis de ambiente
- Testes automatizados

## 🔮 Melhorias Futuras

### Funcionalidades Planejadas
1. **Webhook assíncrono**: Notificações em tempo real
2. **Retry inteligente**: Baseado em códigos de erro
3. **Métricas avançadas**: Dashboard de performance
4. **Integração com CRM**: Sincronização automática
5. **Multi-tenant**: Suporte a múltiplos BSPs

### Otimizações
1. **Cache de tokens**: Reduzir chamadas à API
2. **Batch operations**: Múltiplas WABAs simultâneas
3. **Queue system**: Processamento assíncrono
4. **Rate limiting**: Controle de chamadas à API

## 📞 Suporte

### Logs de Debug
```typescript
// Habilitar logs detalhados
console.log('🔍 Debug:', { step, strategy, details });
console.log('🚀 Estratégia:', strategyName);
console.log('⏳ Polling:', { attempt, maxAttempts });
```

### Monitoramento
- Logs em tempo real
- Métricas de performance
- Alertas de falha
- Dashboard de status

### Contato
Para suporte técnico ou dúvidas sobre a implementação, consulte a documentação da API ou entre em contato com a equipe de desenvolvimento.

---

## ✅ Checklist de Implementação

- [x] OAuth Dialog Meta
- [x] Callback com code
- [x] Troca code → User Access Token
- [x] Descoberta/Criação de WABA com 5 estratégias
- [x] Sistema de polling robusto
- [x] Registro de número
- [x] Configuração final
- [x] Logs detalhados e auditoria
- [x] Tratamento de erro completo
- [x] Sistema de retry automático
- [x] Documentação Swagger
- [x] Migrações de banco
- [x] Testes e validação

**Status**: ✅ IMPLEMENTAÇÃO COMPLETA 