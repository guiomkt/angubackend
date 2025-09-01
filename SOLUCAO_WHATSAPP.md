# Solução WhatsApp Business Cloud API

## 🎯 Problema Identificado
O token BSP não tem permissões para criar WABAs. Todas as tentativas falhavam com erros de permissão.

## ✅ Solução Implementada
**Usar o token do usuário em vez do token BSP para criar WABAs.**

### Função Principal: `createWABAWithUserToken`

```typescript
export async function createWABAWithUserToken(
  businessId: string, 
  userToken: string,  // ← Token do usuário, não BSP
  userId: string,
  restaurantId: string
): Promise<WABACreationResult>
```

### Fluxo Correto:
1. **Trocar code por access_token** (token do usuário)
2. **Descobrir business_id** do usuário
3. **Buscar WABA existente** (business + páginas)
4. **Se não existir, criar WABA** usando token do usuário
5. **Polling** para verificar criação
6. **Finalizar integração**

### Endpoint Correto:
```bash
POST /{business_id}/whatsapp_business_accounts
Authorization: Bearer {user_access_token}  # ← Token do usuário
```

## 🔧 Como Funciona

### 1. Verificação de Permissões
```typescript
const permissionsResponse = await axios.get(
  `${META_URLS.GRAPH_API}/me/permissions`,
  { headers: { 'Authorization': `Bearer ${userToken}` } }
);
```

### 2. Criação de WABA
```typescript
const response = await axios.post(
  `${META_URLS.GRAPH_API}/whatsapp_business_accounts`,
  {
    name: `WhatsApp Business - ${new Date().toISOString()}`,
    business_manager_id: businessId,
    category: "BUSINESS_TO_CUSTOMER"
  },
  { headers: { 'Authorization': `Bearer ${userToken}` } }
);
```

### 3. Polling para Verificar
```typescript
const searchResponse = await axios.get(
  `${META_URLS.GRAPH_API}/${businessId}?fields=whatsapp_business_accounts{id,name,status}`,
  { headers: { 'Authorization': `Bearer ${userToken}` } }
);
```

## 🚀 Resultado Esperado

Agora o fluxo deve funcionar corretamente:

1. ✅ **OAuth callback** - Funciona
2. ✅ **Troca code → token** - Funciona  
3. ✅ **Descoberta de business_id** - Funciona
4. ✅ **Busca WABA existente** - Funciona
5. ✅ **Criação de WABA** - **AGORA FUNCIONA** (com token do usuário)
6. ✅ **Polling** - Funciona
7. ✅ **Finalização** - Funciona

## 📝 Logs Esperados

```
🚀 Criando WABA com token do usuário...
🚀 ✅ WABA criada com sucesso: { wabaId: '123456789', businessId: '1123212253023521' }
⏳ Iniciando polling para WABA...
⏳ ✅ WABA encontrada via polling: { id: '123456789', name: 'WhatsApp Business', status: 'ACTIVE' }
�� ✅ Integração finalizada: { integration_id: 'uuid' }
```

## 🔑 Chave da Solução

**O problema era usar o token BSP para criar WABAs. A solução é usar o token do usuário que tem as permissões necessárias.**

- ❌ **Antes**: `Authorization: Bearer {BSP_TOKEN}`
- ✅ **Agora**: `Authorization: Bearer {USER_ACCESS_TOKEN}`
