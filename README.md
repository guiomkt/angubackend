# Cheff Guio Backend API

API backend para o sistema de gerenciamento de restaurantes Cheff Guio, incluindo integração completa com WhatsApp Business via Meta OAuth.

## 🚀 Funcionalidades

### ✅ **Sistema Principal**
- Autenticação JWT com Supabase
- Gerenciamento de restaurantes, áreas e mesas
- Sistema de reservas completo
- Gerenciamento de cardápio
- Lista de espera inteligente
- Sistema de experiências e bonificações
- Dashboard com analytics
- CRM integrado
- Sistema de chat com IA

### ✅ **WhatsApp Business Integration**
- **OAuth 2.0 com Meta** para tokens permanentes (60 dias)
- **Controle total de mensagens** (enviar, receber, histórico)
- **Gerenciamento de contatos** completo
- **Sistema de templates** para mensagens
- **Webhooks** para notificações em tempo real
- **Sistema de desconexão** que limpa todos os dados

## 🛠️ Tecnologias

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Auth**: JWT + Supabase Auth
- **Documentation**: Swagger/OpenAPI 3.0
- **Security**: Helmet, CORS, Rate Limiting
- **WhatsApp**: Meta Graph API v20.0

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta Supabase
- Facebook App configurado

## 🔧 Instalação

### 1. **Clone e Instale Dependências**
```bash
git clone <repository>
cd backend
npm install
```

### 2. **Configure Variáveis de Ambiente**
```bash
cp .env.example .env
```

#### **Desenvolvimento (.env)**
```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT
JWT_SECRET=your_jwt_secret_key

# Server
PORT=3001
NODE_ENV=development

# CORS (Desenvolvimento)
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
BASE_URL=http://localhost:5173

# Meta OAuth (Facebook App)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# n8n Integration
N8N_API_KEY=your_n8n_api_key

# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v20.0
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Rate Limiting
RATE_LIMIT_MAX=1000
```

#### **Produção (.env)**
```bash
# CORS (Produção)
FRONTEND_URL=https://cheffguio.com
BACKEND_URL=https://api.cheffguio.com
BASE_URL=https://cheffguio.com
```

### 3. **Configure Facebook App**

#### **A. Crie um App no Facebook Developers**
- Vá para [developers.facebook.com](https://developers.facebook.com)
- Crie um novo app ou use um existente

#### **B. Configure Facebook Login**
- Adicione o produto **"Facebook Login"**
- Em **Configurações > URIs de Redirecionamento OAuth Válidos**:
  ```
  # Desenvolvimento
  http://localhost:3001/api/auth/meta/callback
  
  # Produção
  https://api.cheffguio.com/api/auth/meta/callback
  ```

#### **C. Configure WhatsApp Business**
- Adicione o produto **"WhatsApp"**
- Configure as permissões necessárias

### 4. **Execute as Migrações**
```bash
# No Supabase Dashboard ou via CLI
# Execute o arquivo: supabase/migrations/20250101000006_update_whatsapp_tables.sql
```

### 5. **Inicie o Servidor**
```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

## 🔐 Configuração de Segurança

### **CORS**
- Configurado para aceitar apenas domínios autorizados
- Credenciais habilitadas para autenticação

### **Rate Limiting**
- Limite de 1000 requisições por 15 minutos por IP
- Configurável via variável de ambiente

### **Autenticação**
- JWT com expiração de 7 dias
- Middleware de autenticação em todas as rotas protegidas
- Row Level Security (RLS) no Supabase

### **WhatsApp Integration**
- Tokens OAuth armazenados de forma segura
- Separação de dados por restaurante
- Logs de todas as operações

## 📚 Documentação da API

### **Swagger UI**
- Disponível em: `http://localhost:3001/api-docs`
- Documentação completa de todas as rotas
- Exemplos de requisição e resposta
- Schemas de validação

### **Principais Endpoints**

#### **Autenticação**
- `POST /api/auth/login` - Login de usuário
- `POST /api/auth/register` - Registro de usuário
- `GET /api/auth/me` - Perfil do usuário atual

#### **WhatsApp OAuth**
- `GET /api/auth/meta/login` - Inicia OAuth com Meta
- `GET /api/auth/meta/callback` - Callback OAuth
- `GET /api/auth/meta/token` - Obtém token para integrações

#### **WhatsApp Business**
- `GET /api/whatsapp/status` - Status da integração
- `POST /api/whatsapp/disconnect` - Desconecta WhatsApp
- `POST /api/whatsapp/send-message` - Envia mensagem
- `POST /api/whatsapp/send-template` - Envia template

## 🔄 Fluxo OAuth WhatsApp

### **1. Iniciação**
```
Frontend → /api/auth/meta/login → Gera URL OAuth
```

### **2. Autorização**
```
Usuário → Facebook OAuth → Autoriza permissões
```

### **3. Callback**
```
Facebook → /api/auth/meta/callback → Processa tokens
```

### **4. Redirecionamento**
```
Backend → Frontend → Usuário conectado
```

## 🚀 Deploy em Produção

### **1. Variáveis de Ambiente**
```bash
NODE_ENV=production
FRONTEND_URL=https://cheffguio.com
BACKEND_URL=https://api.cheffguio.com
```

### **2. Facebook App**
- URLs de redirecionamento: `https://api.cheffguio.com/api/auth/meta/callback`
- Domínios do app: `cheffguio.com`

### **3. Supabase**
- Execute as migrações
- Configure RLS policies
- Verifique as permissões

### **4. SSL/HTTPS**
- Certificado SSL obrigatório
- Redirecionamento HTTP → HTTPS

## 🐛 Troubleshooting

### **Erro: "URL bloqueada"**
- Verifique se o Facebook App está em modo "Desenvolvimento"
- Confirme as URLs de redirecionamento OAuth
- Verifique se o Facebook Login está ativo

### **Erro: "Usuário não encontrado"**
- Verifique a estrutura da tabela `users`
- Confirme se o JWT token está sendo decodificado corretamente

### **Erro: "Token expirado"**
- Tokens OAuth expiram em 60 dias
- Implemente renovação automática ou reconexão manual

## 📝 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento com hot reload
npm run build        # Build para produção
npm start            # Inicia servidor de produção
npm run test         # Executa testes
npm run lint         # Verifica código
npm run format       # Formata código
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

- **Email**: support@cheffguio.com
- **Documentação**: `/api-docs` (Swagger UI)
- **Issues**: GitHub Issues

---

**Desenvolvido com ❤️ pela equipe Cheff Guio**
