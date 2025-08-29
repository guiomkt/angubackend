# Edge Functions para WhatsApp Business API

Este diretório contém as Edge Functions do Supabase para integração com WhatsApp Business API.

## 🚀 Funções Disponíveis

### 1. `register-waba`
**Endpoint**: `/functions/v1/register-waba`
**Método**: `POST`

Registra e configura uma WABA (WhatsApp Business Account) automaticamente.

**Payload**:
```json
{
  "restaurantId": "uuid",
  "credential": {
    "phone_number_id": "string",
    "waba_id": "string", 
    "access_token": "string"
  }
}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "waba_subscription": {},
    "waba_info": {},
    "registration": {},
    "phone_status": {},
    "webhook_status": {}
  }
}
```

### 2. `whatsapp-redirect`
**Endpoint**: `/functions/v1/whatsapp-redirect`
**Método**: `GET`

Redireciona usuários após autorização OAuth do Facebook/WhatsApp.

**Parâmetros**:
- `code`: Código de autorização do Facebook
- `state`: Estado codificado em base64

### 3. `super-integration`
**Endpoint**: `/functions/v1/super-integration`
**Método**: `POST`

Integração avançada com validação de permissões e salvamento no Supabase.

**Headers**:
```
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
```

**Payload**:
```json
{
  "accessToken": "string",
  "restaurantId": "uuid",
  "credential": {
    "phone_number_id": "string",
    "waba_id": "string",
    "business_id": "string"
  },
  "phone_number": "string"
}
```

## 🔧 Configuração

### Variáveis de Ambiente Necessárias

```bash
# Supabase
SUPABASE_URL=acf365bedaada1218a9490ec9c2406763dd1e514b1275148630ee18699aeb802
SUPABASE_ANON_KEY=a6e34c47fd717d1ac5c5e77ab2f544cb7925cfe626ed3fa535c6d6901bf42891
SUPABASE_SERVICE_ROLE_KEY=85ca1fa53e450be35b8ef8554f5f398e5dd31998cfe47ae0287ad48386c8865e

# WhatsApp
WHATSAPP_APP_ID=bda054be29d5c0664a798e81ca9419fd240479c4b621eae05803e46446d33739
WHATSAPP_APP_SECRET=2c2aa683ac5c14b7efe5a924a1d2899c4bc817e6bc56960e9bf545df536f5571
WHATSAPP_VERIFY_TOKEN=1a6ce47ba2510cf0655f5a0489c54d085768a72a5a5879d2c4c6d1f762f49dbe
WHATSAPP_SYSTEM_USER_TOKEN=f1509ad9d2ff834f70c04aaef5055e979f3ca72f1d611aeaa0272d396b8f1733
WHATSAPP_TOKEN_PERMANENT=2552c2e8b5957d753135fd4198a43ab0cb2dd1ca2ce093c3506772b6012fd922

# Webhook
WEBHOOK_API_USERNAME=5e8e6cefa7b39fa272587684b789e50a15e07f8f5a44e26ff2b244aa2375e9f8
WEBHOOK_API_PASSWORD=31646421b881f631f75f2cd4cf01d812740bcf83faf4caca2c4c49aae8146a91
```

## 📱 Fluxo de Integração

1. **OAuth Callback** → `whatsapp-redirect`
2. **Registro de WABA** → `register-waba`
3. **Integração Final** → `super-integration`

## 🚀 Deploy

```bash
# Deploy de todas as funções
supabase functions deploy

# Deploy de função específica
supabase functions deploy register-waba
supabase functions deploy whatsapp-redirect
supabase functions deploy super-integration
```

## 🔍 Teste

```bash
# Testar register-waba
curl -X POST https://your-project.supabase.co/functions/v1/register-waba \
  -H "Authorization: Bearer your-service-role-key" \
  -H "Content-Type: application/json" \
  -d '{"restaurantId":"uuid","credential":{"phone_number_id":"123","waba_id":"456","access_token":"token"}}'
```

## 📋 Dependências

- Deno 1.x
- Supabase Edge Functions Runtime
- @supabase/supabase-js@2 