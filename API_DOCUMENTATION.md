# Cheff Guio API Documentation

## Visão Geral

A API do Cheff Guio é um sistema completo de gerenciamento de restaurantes que oferece funcionalidades para reservas, gestão de mesas, menu, clientes, IA conversacional, WhatsApp e muito mais.

## Base URL

- **Produção**: `https://angubackend-production.up.railway.app`
- **Desenvolvimento**: `http://localhost:3001`

## Autenticação

A API utiliza JWT (JSON Web Tokens) para autenticação. Inclua o token no header `Authorization`:

```
Authorization: Bearer <seu_token_jwt>
```

## Endpoints Principais

### 1. Autenticação

#### POST `/api/auth/login`
Fazer login no sistema.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "restaurant_id": "restaurant_id"
    }
  }
}
```

#### POST `/api/auth/register`
Registrar novo usuário.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Nome do Usuário"
}
```

### 2. Restaurantes

#### GET `/api/restaurants/settings`
Obter configurações completas do restaurante (incluindo IA, notificações, WhatsApp e usuários).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "restaurant": {
      "id": "restaurant_id",
      "name": "Nome do Restaurante",
      "description": "Descrição",
      "address": "Endereço",
      "city": "Cidade",
      "state": "Estado",
      "postal_code": "CEP",
      "phone": "Telefone",
      "email": "Email",
      "website": "Website",
      "opening_hours": {},
      "max_capacity": 120,
      "logo_url": "URL do logo"
    },
    "ai_settings": {
      "id": "ai_settings_id",
      "personality": "friendly",
      "settings": {
        "welcome_message": "Mensagem personalizada",
        "menu_suggestions": true,
        "language": "pt_BR"
      }
    },
    "notification_settings": {
      "id": "notification_settings_id",
      "settings": {
        "email_notifications": true,
        "whatsapp_notifications": true,
        "reservation_confirmation": true
      }
    },
    "whatsapp_account_info": {
      "id": "whatsapp_info_id",
      "description": "Descrição do negócio",
      "about": "Sobre o restaurante",
      "address": "Endereço"
    },
    "users": [
      {
        "id": "user_id",
        "name": "Nome do Usuário",
        "role": "Operador",
        "is_active": true
      }
    ]
  }
}
```

#### PUT `/api/restaurants/settings`
Atualizar configurações do restaurante.

**Request Body:**
```json
{
  "restaurant": {
    "name": "Novo Nome",
    "description": "Nova Descrição"
  },
  "ai_settings": {
    "personality": "formal"
  },
  "notification_settings": {
    "email_notifications": false
  }
}
```

#### POST `/api/restaurants/logo`
Fazer upload do logo do restaurante.

**Headers:** `Authorization: Bearer <token>`
**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: Arquivo de imagem (JPG, PNG ou WebP, máximo 2MB)

### 3. Configurações de IA

#### GET `/api/ai/settings`
Obter configurações de IA do restaurante.

#### POST `/api/ai/settings`
Criar/atualizar configurações de IA.

**Request Body:**
```json
{
  "personality": "friendly",
  "settings": {
    "welcome_message": "Olá! Como posso ajudá-lo?",
    "menu_suggestions": true,
    "language": "pt_BR"
  }
}
```

#### PUT `/api/ai/settings/personality`
Atualizar personalidade da IA.

**Request Body:**
```json
{
  "personality": "formal"
}
```

**Personalities disponíveis:**
- `formal`: Formal e Profissional
- `friendly`: Amigável e Casual  
- `enthusiastic`: Entusiasta e Expressivo

#### PUT `/api/ai/settings/custom`
Atualizar configurações customizadas da IA.

#### POST `/api/ai/settings/reset`
Resetar configurações de IA para padrão.

### 4. Configurações de Notificação

#### GET `/api/notifications/settings`
Obter configurações de notificação.

#### PUT `/api/notifications/settings`
Atualizar configurações de notificação.

**Request Body:**
```json
{
  "email_notifications": true,
  "whatsapp_notifications": true,
  "reservation_confirmation": true,
  "reservation_reminder": true,
  "waiting_list_notification": true,
  "table_ready_notification": true,
  "marketing_notifications": false,
  "notification_timing": {
    "reservation_reminder_hours": 24,
    "table_ready_delay": 5
  }
}
```

#### POST `/api/notifications/settings/default`
Criar configurações de notificação padrão.

#### PUT `/api/notifications/settings/toggle/{type}`
Alternar tipo de notificação específico.

**Path Parameters:**
- `type`: Tipo de notificação (email_notifications, sms_notifications, etc.)

**Request Body:**
```json
{
  "enabled": true
}
```

#### PUT `/api/notifications/settings/timing`
Atualizar configurações de timing das notificações.

### 5. Usuários

#### GET `/api/users`
Listar usuários do restaurante.

**Query Parameters:**
- `page`: Número da página (padrão: 1)
- `limit`: Limite de usuários por página (padrão: 10)

#### POST `/api/users`
Criar novo usuário.

**Request Body:**
```json
{
  "name": "Nome do Usuário",
  "role": "Operador",
  "email": "email@example.com",
  "phone": "Telefone",
  "permissions": ["reservations", "tables"]
}
```

#### GET `/api/users/{id}`
Obter usuário por ID.

#### PUT `/api/users/{id}`
Atualizar usuário.

#### DELETE `/api/users/{id}`
Excluir usuário (soft delete).

#### PUT `/api/users/{id}/status`
Atualizar status do usuário.

**Request Body:**
```json
{
  "isActive": false
}
```

#### PUT `/api/users/{id}/permissions`
Atualizar permissões do usuário.

**Request Body:**
```json
{
  "permissions": ["reservations", "tables", "menu"]
}
```

### 6. WhatsApp

#### GET `/api/whatsapp/status`
Verificar status da integração WhatsApp.

#### POST `/api/whatsapp/profile`
Atualizar perfil do WhatsApp Business.

#### POST `/api/whatsapp/profile/photo`
Enviar foto de perfil do WhatsApp Business.

#### GET `/api/whatsapp/oauth/initiate`
Iniciar fluxo OAuth do WhatsApp.

#### GET `/api/whatsapp/oauth/callback`
Callback OAuth do WhatsApp.

#### POST `/api/whatsapp/disconnect`
Desvincular WhatsApp do restaurante.

### 7. Outros Endpoints

#### GET `/api/health`
Health check básico.

#### GET `/api/health/detailed`
Health check detalhado.

## Schemas

### Restaurant
```json
{
  "id": "string (uuid)",
  "name": "string",
  "description": "string (opcional)",
  "logo_url": "string (opcional)",
  "address": "string (opcional)",
  "city": "string (opcional)",
  "state": "string (opcional)",
  "postal_code": "string (opcional)",
  "phone": "string (opcional)",
  "email": "string (opcional)",
  "website": "string (opcional)",
  "opening_hours": "object (opcional)",
  "max_capacity": "number (opcional)",
  "onboarding_completed": "boolean",
  "onboarding_step": "number",
  "user_id": "string (uuid)",
  "created_at": "string (date-time)",
  "updated_at": "string (date-time)"
}
```

### AISettings
```json
{
  "id": "string (uuid)",
  "restaurant_id": "string (uuid)",
  "personality": "string (enum: formal, friendly, enthusiastic)",
  "settings": {
    "welcome_message": "string (opcional)",
    "reservation_flow": "string (opcional)",
    "menu_suggestions": "boolean (opcional)",
    "customer_service_tone": "string (opcional)",
    "language": "string (opcional)",
    "max_response_length": "number (opcional)",
    "auto_suggestions": "boolean (opcional)"
  },
  "created_at": "string (date-time)",
  "updated_at": "string (date-time)"
}
```

### NotificationSettings
```json
{
  "id": "string (uuid)",
  "restaurant_id": "string (uuid)",
  "settings": {
    "email_notifications": "boolean",
    "sms_notifications": "boolean",
    "whatsapp_notifications": "boolean",
    "push_notifications": "boolean",
    "reservation_confirmation": "boolean",
    "reservation_reminder": "boolean",
    "waiting_list_notification": "boolean",
    "table_ready_notification": "boolean",
    "marketing_notifications": "boolean",
    "notification_timing": {
      "reservation_reminder_hours": "number",
      "table_ready_delay": "number"
    }
  },
  "created_at": "string (date-time)",
  "updated_at": "string (date-time)"
}
```

### UserProfileExtended
```json
{
  "id": "string (uuid)",
  "name": "string (opcional)",
  "role": "string (opcional)",
  "restaurant_id": "string (uuid) (opcional)",
  "user_id": "string (uuid)",
  "created_by": "string (uuid) (opcional)",
  "email": "string (opcional)",
  "phone": "string (opcional)",
  "avatar_url": "string (opcional)",
  "permissions": "array of strings (opcional)",
  "is_active": "boolean (opcional)",
  "last_login": "string (date-time) (opcional)",
  "created_at": "string (date-time)",
  "updated_at": "string (date-time)"
}
```

## Códigos de Status HTTP

- `200`: Sucesso
- `201`: Criado com sucesso
- `400`: Dados inválidos
- `401`: Não autorizado
- `403`: Proibido
- `404`: Não encontrado
- `500`: Erro interno do servidor

## Rate Limiting

⚠️ **Rate limiting está temporariamente desabilitado** - será reativado antes da produção.

## CORS

A API está configurada para aceitar requisições dos seguintes domínios:
- `localhost:5173`
- `localhost:3000`
- `cheffguio.com`
- `angubackend-production.up.railway.app`

## Documentação Swagger

A documentação interativa está disponível em:
- **Produção**: `https://angubackend-production.up.railway.app/api-docs`
- **Desenvolvimento**: `http://localhost:3001/api-docs`

## Suporte

Para suporte técnico, entre em contato:
- **Email**: support@cheffguio.com
- **Documentação**: `/api-docs`

---

**Versão da API**: 1.0.0  
**Última atualização**: Janeiro 2025 