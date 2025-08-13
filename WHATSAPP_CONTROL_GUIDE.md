# WhatsApp Control Guide - Controle Total de Mensagens

Este guia explica como usar o sistema completo de controle de mensagens WhatsApp implementado no backend.

## Estrutura do Banco

### Tabelas Principais

1. **whatsapp_credentials** - Credenciais OAuth e tokens
2. **whatsapp_integrations** - Integrações com WhatsApp Business
3. **whatsapp_messages** - Todas as mensagens enviadas/recebidas
4. **whatsapp_contacts** - Contatos dos clientes
5. **whatsapp_media** - Arquivos de mídia
6. **whatsapp_conversations** - Conversas organizadas
7. **whatsapp_templates** - Templates de mensagens
8. **whatsapp_webhooks** - Configuração de webhooks

## Fluxo de Integração

### 1. Conectar WhatsApp (OAuth)

```typescript
// Frontend: Iniciar OAuth
const connectWhatsApp = async (restaurantId: string) => {
  const redirectUrl = window.location.href;
  const response = await fetch(
    `/api/whatsapp/oauth/initiate?restaurantId=${restaurantId}&redirectUrl=${encodeURIComponent(redirectUrl)}`
  );
  const { authUrl } = await response.json();
  window.location.href = authUrl;
};
```

### 2. Callback Automático

O backend processa automaticamente:
- Troca código por token curto
- Troca token curto por long-lived (60 dias)
- Salva credenciais no banco
- Redireciona de volta ao frontend

### 3. Verificar Status

```typescript
const checkStatus = async (restaurantId: string) => {
  const response = await fetch(`/api/whatsapp/status?restaurantId=${restaurantId}`);
  const { data } = await response.json();
  
  if (data.isConnected) {
    console.log('WhatsApp conectado!');
    console.log('Business Account:', data.integration.business_account_id);
    console.log('Phone Number ID:', data.integration.phone_number_id);
  }
};
```

## Controle de Mensagens

### 1. Enviar Mensagem de Texto

```typescript
const sendTextMessage = async (to: string, message: string) => {
  const response = await fetch('/api/whatsapp/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurantId: 'your-restaurant-id',
      to,
      message
    })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Mensagem enviada:', result.data.message_id);
  }
};
```

### 2. Enviar Template

```typescript
const sendTemplate = async (to: string, templateName: string, components: any[]) => {
  const response = await fetch('/api/whatsapp/send-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      restaurantId: 'your-restaurant-id',
      to,
      templateName,
      language: 'pt_BR',
      components
    })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Template enviado:', result.data.message_id);
  }
};
```

### 3. Enviar Mídia

```typescript
const sendMedia = async (to: string, file: File, caption?: string) => {
  const formData = new FormData();
  formData.append('restaurantId', 'your-restaurant-id');
  formData.append('to', to);
  formData.append('file', file);
  if (caption) formData.append('caption', caption);
  
  const response = await fetch('/api/whatsapp/media', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Mídia enviada:', result.data.message_id);
  }
};
```

## Gerenciamento de Contatos

### 1. Criar/Atualizar Contato

```typescript
const saveContact = async (contactData: {
  restaurantId: string;
  phoneNumber: string;
  name?: string;
  email?: string;
  notes?: string;
  tags?: string[];
}) => {
  const response = await fetch('/api/whatsapp/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contactData)
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Contato salvo:', result.data.id);
  }
};
```

### 2. Listar Contatos

```typescript
const getContacts = async (restaurantId: string) => {
  const response = await fetch(`/api/whatsapp/contacts/${restaurantId}`);
  const { data } = await response.json();
  
  data.forEach(contact => {
    console.log(`${contact.name} (${contact.phone_number})`);
    console.log('Tags:', contact.tags);
    console.log('Última mensagem:', contact.last_message_at);
  });
};
```

### 3. Buscar Contato

```typescript
const getContact = async (restaurantId: string, phoneNumber: string) => {
  const response = await fetch(`/api/whatsapp/contacts/${restaurantId}/${phoneNumber}`);
  const { data } = await response.json();
  
  if (data) {
    console.log('Contato encontrado:', data);
  } else {
    console.log('Contato não encontrado');
  }
};
```

## Histórico de Mensagens

### 1. Listar Mensagens

```typescript
const getMessages = async (restaurantId: string, limit = 50) => {
  const response = await fetch(`/api/whatsapp/messages/${restaurantId}?limit=${limit}`);
  const { data } = await response.json();
  
  data.forEach(message => {
    console.log(`${message.direction}: ${message.content.text || 'Mídia'}`);
    console.log(`Status: ${message.status}`);
    console.log(`Data: ${message.created_at}`);
  });
};
```

### 2. Buscar Mensagem por ID

```typescript
const getMessageStatus = async (messageId: string, restaurantId: string) => {
  const response = await fetch(`/api/whatsapp/messages/${messageId}/status?restaurantId=${restaurantId}`);
  const { data } = await response.json();
  
  console.log('Status da mensagem:', data.status);
  console.log('Detalhes:', data);
};
```

## Desvincular WhatsApp

### 1. Desconectar Completamente

```typescript
const disconnectWhatsApp = async (restaurantId: string) => {
  const response = await fetch('/api/whatsapp/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId })
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('WhatsApp desconectado com sucesso');
    console.log('Todos os dados foram removidos');
  }
};
```

### 2. O que acontece ao desconectar:

- ✅ Token OAuth é removido
- ✅ Integração é marcada como desconectada
- ✅ Todas as mensagens são removidas
- ✅ Todos os contatos são removidos
- ✅ Toda a mídia é removida
- ✅ Todas as conversas são removidas
- ✅ Log de desconexão é criado

## Webhooks e Notificações

### 1. Configurar Webhook

```typescript
const setupWebhook = async (webhookData: {
  restaurantId: string;
  webhookUrl: string;
  verifyToken: string;
  events?: string[];
}) => {
  const response = await fetch('/api/whatsapp/webhook/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookData)
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Webhook configurado:', result.data);
  }
};
```

### 2. Eventos Disponíveis

- `message` - Mensagens recebidas
- `message_status` - Mudanças de status
- `contact` - Novos contatos
- `media` - Mídia recebida

## Templates de Mensagens

### 1. Criar Template

```typescript
const createTemplate = async (templateData: {
  restaurantId: string;
  templateName: string;
  category: string;
  language: string;
  content: any;
}) => {
  const response = await fetch('/api/whatsapp/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(templateData)
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('Template criado:', result.data);
  }
};
```

### 2. Exemplo de Template

```typescript
const welcomeTemplate = {
  restaurantId: 'your-restaurant-id',
  templateName: 'welcome_message',
  category: 'marketing',
  language: 'pt_BR',
  content: {
    name: 'welcome_message',
    language: 'pt_BR',
    category: 'marketing',
    components: [
      {
        type: 'header',
        format: 'text',
        text: 'Bem-vindo ao {{restaurant_name}}!'
      },
      {
        type: 'body',
        text: 'Olá {{customer_name}}, obrigado por escolher nosso restaurante!'
      },
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: 0,
        parameters: [
          {
            type: 'text',
            text: 'Ver cardápio'
          }
        ]
      }
    ]
  }
};
```

## Monitoramento e Analytics

### 1. Status da Integração

```typescript
const getIntegrationStatus = async (restaurantId: string) => {
  const response = await fetch(`/api/whatsapp/status?restaurantId=${restaurantId}`);
  const { data } = await response.json();
  
  console.log('Status da integração:', {
    isConnected: data.isConnected,
    lastConnected: data.lastConnected,
    businessAccount: data.integration?.business_account_id,
    phoneNumber: data.integration?.phone_number_id,
    message: data.message
  });
};
```

### 2. Estatísticas de Mensagens

```typescript
const getMessageStats = async (restaurantId: string) => {
  // Implementar endpoint para estatísticas
  const response = await fetch(`/api/whatsapp/stats/${restaurantId}`);
  const { data } = await response.json();
  
  console.log('Estatísticas:', {
    totalMessages: data.totalMessages,
    sentMessages: data.sentMessages,
    receivedMessages: data.receivedMessages,
    deliveryRate: data.deliveryRate,
    readRate: data.readRate
  });
};
```

## Segurança e Permissões

### 1. Autenticação

Todas as rotas requerem JWT token válido:
```typescript
const headers = {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
};
```

### 2. Row Level Security (RLS)

- Cada usuário só acessa dados do seu restaurante
- Políticas automáticas baseadas em `restaurant_id`
- Separação completa entre restaurantes

### 3. Validação de Dados

- Validação de entrada em todas as rotas
- Sanitização de dados
- Verificação de permissões

## Troubleshooting

### Erro: "Token expirado"
```typescript
// Token expira em 60 dias, reconectar:
await connectWhatsApp(restaurantId);
```

### Erro: "Contato não encontrado"
```typescript
// Criar contato primeiro:
await saveContact({
  restaurantId,
  phoneNumber: '5511999999999',
  name: 'Nome do Cliente'
});
```

### Erro: "Mídia não suportada"
- Verificar tipos de arquivo suportados
- Tamanho máximo: 16MB
- Formatos: imagem, áudio, vídeo, documento

## Limitações Conhecidas

1. **Tokens**: Expiram em 60 dias (limitação do Facebook)
2. **Rate Limits**: 1000 mensagens por segundo por número
3. **Mídia**: Máximo 16MB por arquivo
4. **Templates**: Aprovação manual pelo WhatsApp
5. **Webhooks**: Requer HTTPS em produção

## Próximos Passos

1. ✅ Implementar fluxo OAuth
2. ✅ Controle total de mensagens
3. ✅ Gerenciamento de contatos
4. ✅ Sistema de templates
5. 🔄 Analytics avançados
6. 🔄 Automação de respostas
7. 🔄 Integração com CRM
8. 🔄 Relatórios detalhados 