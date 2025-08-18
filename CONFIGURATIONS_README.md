# Configurações do Restaurante - Cheff Guio

## Visão Geral

Este documento descreve as funcionalidades de configuração implementadas para o sistema de gerenciamento de restaurantes Cheff Guio. As configurações são organizadas em módulos específicos para facilitar a manutenção e escalabilidade.

## Módulos de Configuração

### 1. Configurações Gerais do Restaurante

#### Endpoint Principal
```
GET /api/restaurants/settings
```

#### Funcionalidades
- **Informações Básicas**: Nome, descrição, logo, endereço, contato
- **Horário de Funcionamento**: Configuração flexível por dia da semana
- **Capacidade**: Capacidade máxima de pessoas
- **Upload de Logo**: Suporte para JPG, PNG e WebP (máximo 2MB)

#### Estrutura de Dados
```typescript
interface Restaurant {
  name: string;
  description?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  website?: string;
  opening_hours?: Record<string, { open: string; close: string }>;
  max_capacity?: number;
}
```

### 2. Configurações de IA

#### Endpoints Disponíveis
- `GET /api/ai/settings` - Obter configurações
- `POST /api/ai/settings` - Criar/atualizar configurações
- `PUT /api/ai/settings/personality` - Atualizar personalidade
- `PUT /api/ai/settings/custom` - Configurações customizadas
- `POST /api/ai/settings/reset` - Resetar para padrão

#### Personalidades Disponíveis
1. **Formal e Profissional**
   - Ideal para restaurantes de alta gastronomia
   - Tom respeitoso e elegante
   - Exemplo: "Boa noite, como posso auxiliá-lo com sua reserva hoje?"

2. **Amigável e Casual**
   - Perfeito para restaurantes familiares
   - Tom acolhedor e próximo
   - Exemplo: "Oi! Que bom ter você por aqui! Como posso ajudar com seu pedido hoje? 😊"

3. **Entusiasta e Expressivo**
   - Ideal para bares e casas noturnas
   - Tom energético e divertido
   - Exemplo: "Eai, galera! 🎉 Vamo que vamo! O que vocês tão pensando pra hoje?"

#### Configurações Customizáveis
```typescript
interface AISettings {
  personality: 'formal' | 'friendly' | 'enthusiastic';
  settings: {
    welcome_message?: string;
    reservation_flow?: string;
    menu_suggestions?: boolean;
    customer_service_tone?: string;
    language?: string;
    max_response_length?: number;
    auto_suggestions?: boolean;
  };
}
```

### 3. Configurações de Notificação

#### Endpoints Disponíveis
- `GET /api/notifications/settings` - Obter configurações
- `PUT /api/notifications/settings` - Atualizar configurações
- `POST /api/notifications/settings/default` - Criar padrões
- `PUT /api/notifications/settings/toggle/{type}` - Alternar tipo
- `PUT /api/notifications/settings/timing` - Configurar timing

#### Tipos de Notificação
- **Email**: Notificações por email
- **SMS**: Notificações por SMS
- **WhatsApp**: Notificações via WhatsApp
- **Push**: Notificações push (futuro)

#### Eventos de Notificação
- Confirmação de reserva
- Lembrete de reserva
- Notificação de fila de espera
- Mesa pronta
- Notificações de marketing

#### Configurações de Timing
```typescript
interface NotificationTiming {
  reservation_reminder_hours: number; // Horas antes da reserva
  table_ready_delay: number;         // Delay para notificar mesa pronta
}
```

### 4. Configurações do WhatsApp

#### Funcionalidades
- **Perfil da Conta**: Descrição, sobre, endereço, website
- **Foto de Perfil**: Upload e gerenciamento
- **Integração OAuth**: Conexão segura com WhatsApp Business
- **Status de Conexão**: Monitoramento da integração

#### Estrutura de Dados
```typescript
interface WhatsAppAccountInfo {
  description?: string;      // Máximo 100 caracteres
  about?: string;           // Máximo 500 caracteres
  address?: string;         // Máximo 256 caracteres
  website?: string;         // Máximo 256 caracteres
  email?: string;           // Email do estabelecimento
  photo_url?: string;       // URL da foto de perfil
}
```

### 5. Gerenciamento de Usuários

#### Endpoints Disponíveis
- `GET /api/users` - Listar usuários
- `POST /api/users` - Criar usuário
- `GET /api/users/{id}` - Obter usuário
- `PUT /api/users/{id}` - Atualizar usuário
- `DELETE /api/users/{id}` - Excluir usuário
- `PUT /api/users/{id}/status` - Atualizar status
- `PUT /api/users/{id}/permissions` - Atualizar permissões

#### Funcionalidades
- **CRUD Completo**: Criar, ler, atualizar e excluir usuários
- **Soft Delete**: Usuários são marcados como inativos, não removidos
- **Sistema de Permissões**: Controle granular de acesso
- **Paginação**: Listagem com paginação para grandes volumes
- **Validação de Acesso**: Apenas usuários autorizados podem gerenciar

#### Estrutura de Usuário
```typescript
interface UserProfileExtended {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  permissions?: string[];
  is_active?: boolean;
  last_login?: string;
}
```

## Arquitetura Técnica

### Padrões Utilizados
- **Service Layer**: Lógica de negócio isolada em serviços
- **Repository Pattern**: Acesso a dados através de serviços
- **Middleware de Autenticação**: Validação de tokens JWT
- **Validação de Dados**: Schemas Joi para validação de entrada
- **Tratamento de Erros**: Middleware centralizado para erros
- **Documentação Swagger**: API auto-documentada

### Estrutura de Arquivos
```
src/
├── services/
│   ├── restaurantService.ts      # Configurações gerais
│   ├── userService.ts           # Gerenciamento de usuários
│   └── notificationService.ts   # Configurações de notificação
├── routes/
│   ├── restaurantRoutes.ts      # Rotas de restaurante
│   ├── userRoutes.ts           # Rotas de usuários
│   ├── notificationRoutes.ts   # Rotas de notificação
│   └── aiRoutes.ts             # Rotas de IA
├── types/
│   └── index.ts                # Tipos TypeScript
└── middleware/
    ├── auth.ts                 # Autenticação
    └── validation.ts           # Validação de dados
```

### Segurança
- **Autenticação JWT**: Tokens seguros para acesso
- **Autorização por Restaurante**: Usuários só acessam seu restaurante
- **Validação de Entrada**: Schemas para prevenir dados maliciosos
- **Soft Delete**: Dados não são permanentemente removidos
- **Rate Limiting**: Proteção contra abuso (configurável)

## Uso e Implementação

### Exemplo de Configuração Completa

```typescript
// Obter todas as configurações
const response = await fetch('/api/restaurants/settings', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Atualizar configurações
const updateResponse = await fetch('/api/restaurants/settings', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    restaurant: {
      name: 'Novo Nome do Restaurante',
      max_capacity: 150
    },
    ai_settings: {
      personality: 'formal'
    },
    notification_settings: {
      email_notifications: false,
      whatsapp_notifications: true
    }
  })
});
```

### Exemplo de Upload de Logo

```typescript
const formData = new FormData();
formData.append('file', logoFile);

const logoResponse = await fetch('/api/restaurants/logo', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

## Configurações Padrão

### IA
- **Personalidade**: Amigável e Casual
- **Idioma**: Português Brasileiro (pt_BR)
- **Sugestões de Menu**: Habilitado
- **Sugestões Automáticas**: Habilitado

### Notificações
- **Email**: Habilitado
- **WhatsApp**: Habilitado
- **SMS**: Desabilitado
- **Push**: Desabilitado
- **Confirmação de Reserva**: Habilitado
- **Lembrete de Reserva**: 24 horas antes
- **Delay Mesa Pronta**: 5 minutos

## Monitoramento e Logs

### Logs Disponíveis
- **Acesso**: Todas as requisições são logadas
- **Erros**: Erros são capturados e logados
- **Auditoria**: Alterações em configurações são rastreadas
- **Performance**: Métricas de tempo de resposta

### Métricas
- **Taxa de Sucesso**: Porcentagem de requisições bem-sucedidas
- **Tempo de Resposta**: Latência média das APIs
- **Uso de Recursos**: CPU, memória e banco de dados
- **Erros**: Tipos e frequência de erros

## Manutenção e Escalabilidade

### Boas Práticas
- **Separação de Responsabilidades**: Cada serviço tem uma responsabilidade específica
- **Injeção de Dependências**: Serviços são injetados onde necessário
- **Tratamento de Erros**: Erros são tratados de forma consistente
- **Validação**: Dados de entrada são sempre validados
- **Documentação**: Código é auto-documentado com Swagger

### Escalabilidade
- **Arquitetura Modular**: Fácil adicionar novos módulos
- **Banco de Dados**: Estrutura normalizada para performance
- **Cache**: Preparado para implementação de cache
- **Microserviços**: Arquitetura preparada para divisão futura

## Suporte e Contato

Para suporte técnico ou dúvidas sobre as configurações:

- **Email**: support@cheffguio.com
- **Documentação**: `/api-docs`
- **Issues**: GitHub Issues do projeto

---

**Versão**: 1.0.0  
**Última atualização**: Janeiro 2025  
**Desenvolvido por**: Equipe Cheff Guio 