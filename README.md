# Cheff Guio Backend API

Uma API RESTful completa para gerenciamento de restaurantes, desenvolvida com Node.js, Express, TypeScript e Supabase.

## 🚀 Funcionalidades

### Restaurantes
- ✅ CRUD completo de restaurantes
- ✅ Gerenciamento de informações básicas
- ✅ Configurações de horário de funcionamento
- ✅ Estatísticas e relatórios

### Áreas e Ambientes
- ✅ CRUD completo de áreas do restaurante
- ✅ Configuração de capacidade máxima
- ✅ Ordenação de áreas
- ✅ Estatísticas por área
- ✅ Relacionamento com mesas

### Mesas
- ✅ CRUD completo de mesas
- ✅ Configuração de capacidade e formato
- ✅ Posicionamento visual (x, y)
- ✅ Gerenciamento de status (disponível, ocupada, reservada, bloqueada)
- ✅ Histórico de mudanças de status
- ✅ Relacionamento com áreas
- ✅ Estatísticas de ocupação

### Cardápio
- ✅ CRUD completo de categorias do cardápio
- ✅ CRUD completo de itens do cardápio
- ✅ Ordenação de categorias
- ✅ Busca de itens
- ✅ Menu completo com estrutura hierárquica
- ✅ Estatísticas do cardápio

### Reservas
- ✅ CRUD completo de reservas
- ✅ Verificação de conflitos de horário
- ✅ Gerenciamento de status
- ✅ Relacionamento com mesas e áreas
- ✅ Notificações automáticas

### Lista de Espera
- ✅ Gerenciamento de lista de espera
- ✅ Priorização de clientes
- ✅ Estimativa de tempo de espera
- ✅ Notificações automáticas

### Autenticação e Segurança
- ✅ Autenticação JWT com Supabase
- ✅ Middleware de autorização
- ✅ Validação de dados com Joi
- ✅ Rate limiting
- ✅ CORS configurado
- ✅ Helmet para segurança

### Documentação
- ✅ Swagger/OpenAPI completa
- ✅ Documentação de todos os endpoints
- ✅ Schemas de validação
- ✅ Exemplos de uso

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Supabase
- Banco de dados PostgreSQL (via Supabase)

## 🛠️ Instalação

1. **Clone o repositório**
```bash
git clone <repository-url>
cd backend
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Server Configuration
PORT=3000
NODE_ENV=development

# WhatsApp Configuration (opcional)
WHATSAPP_API_URL=your_whatsapp_api_url
WHATSAPP_API_KEY=your_whatsapp_api_key
```

4. **Configure o banco de dados**
- Crie um projeto no Supabase
- Execute as migrações do banco de dados
- Configure as políticas de segurança (RLS)

5. **Execute as migrações**
```bash
# Se você tiver o Supabase CLI configurado
supabase db push
```

## 🚀 Executando o Projeto

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm run build
npm start
```

### Testes
```bash
npm test
```

## 📚 Documentação da API

Acesse a documentação Swagger em: `http://localhost:3000/api-docs`

### Endpoints Principais

#### Restaurantes
- `GET /api/restaurants` - Listar restaurantes
- `POST /api/restaurants` - Criar restaurante
- `GET /api/restaurants/:id` - Obter restaurante
- `PUT /api/restaurants/:id` - Atualizar restaurante
- `DELETE /api/restaurants/:id` - Deletar restaurante

#### Áreas
- `GET /api/areas?restaurantId=:id` - Listar áreas do restaurante
- `POST /api/areas` - Criar área
- `GET /api/areas/:id` - Obter área
- `PUT /api/areas/:id` - Atualizar área
- `DELETE /api/areas/:id` - Deletar área
- `POST /api/areas/reorder` - Reordenar áreas
- `GET /api/areas/stats?restaurantId=:id` - Estatísticas das áreas

#### Mesas
- `GET /api/tables?restaurantId=:id` - Listar mesas do restaurante
- `GET /api/tables?areaId=:id` - Listar mesas por área
- `POST /api/tables` - Criar mesa
- `GET /api/tables/:id` - Obter mesa
- `PUT /api/tables/:id` - Atualizar mesa
- `DELETE /api/tables/:id` - Deletar mesa
- `PATCH /api/tables/:id/status` - Alterar status da mesa
- `PATCH /api/tables/:id/position` - Atualizar posição da mesa
- `GET /api/tables/stats?restaurantId=:id` - Estatísticas das mesas
- `GET /api/tables/:id/history` - Histórico de status da mesa

#### Cardápio
- `GET /api/menu/categories?restaurantId=:id` - Listar categorias
- `POST /api/menu/categories` - Criar categoria
- `GET /api/menu/categories/:id` - Obter categoria
- `PUT /api/menu/categories/:id` - Atualizar categoria
- `DELETE /api/menu/categories/:id` - Deletar categoria
- `POST /api/menu/categories/reorder` - Reordenar categorias
- `GET /api/menu/items?restaurantId=:id` - Listar itens
- `GET /api/menu/items?categoryId=:id` - Listar itens por categoria
- `GET /api/menu/items?search=:term` - Buscar itens
- `POST /api/menu/items` - Criar item
- `GET /api/menu/items/:id` - Obter item
- `PUT /api/menu/items/:id` - Atualizar item
- `DELETE /api/menu/items/:id` - Deletar item
- `GET /api/menu/complete?restaurantId=:id` - Menu completo
- `GET /api/menu/stats?restaurantId=:id` - Estatísticas do cardápio

#### Reservas
- `GET /api/reservations?restaurantId=:id` - Listar reservas
- `POST /api/reservations` - Criar reserva
- `GET /api/reservations/:id` - Obter reserva
- `PUT /api/reservations/:id` - Atualizar reserva
- `DELETE /api/reservations/:id` - Cancelar reserva
- `PATCH /api/reservations/:id/status` - Alterar status da reserva

## 🔐 Autenticação

A API utiliza autenticação JWT via Supabase. Para acessar endpoints protegidos:

1. Faça login no Supabase Auth
2. Obtenha o token JWT
3. Inclua no header: `Authorization: Bearer <token>`

## 📊 Estrutura do Projeto

```
src/
├── config/
│   └── database.ts          # Configuração do Supabase
├── controllers/
│   ├── restaurantController.ts
│   ├── areaController.ts
│   ├── tableController.ts
│   ├── menuController.ts
│   └── reservationController.ts
├── middleware/
│   ├── auth.ts              # Autenticação JWT
│   ├── validation.ts        # Validação de dados
│   └── errorHandler.ts      # Tratamento de erros
├── routes/
│   ├── restaurantRoutes.ts
│   ├── areaRoutes.ts
│   ├── tableRoutes.ts
│   ├── menuRoutes.ts
│   └── reservationRoutes.ts
├── services/
│   ├── restaurantService.ts
│   ├── areaService.ts
│   ├── tableService.ts
│   ├── menuService.ts
│   └── reservationService.ts
├── types/
│   └── index.ts             # Tipos TypeScript
└── index.ts                 # Servidor principal
```

## 🗄️ Banco de Dados

### Tabelas Principais

- `restaurants` - Informações dos restaurantes
- `restaurant_areas` - Áreas dos restaurantes
- `tables` - Mesas dos restaurantes
- `table_status_history` - Histórico de status das mesas
- `menu_categories` - Categorias do cardápio
- `menu_items` - Itens do cardápio
- `reservations` - Reservas
- `waiting_lists` - Lista de espera

### Relacionamentos

- Restaurante → Áreas (1:N)
- Área → Mesas (1:N)
- Mesa → Reservas (1:N)
- Restaurante → Categorias do Cardápio (1:N)
- Categoria → Itens do Cardápio (1:N)

## 🔧 Scripts Disponíveis

```bash
npm run dev          # Executa em modo desenvolvimento
npm run build        # Compila o projeto
npm start            # Executa em modo produção
npm test             # Executa os testes
npm run lint         # Executa o linter
npm run lint:fix     # Corrige problemas do linter
```

## 🚀 Deploy

### Vercel
```bash
npm run build
vercel --prod
```

### Railway
```bash
railway login
railway init
railway up
```

### Docker
```bash
docker build -t cheff-guio-backend .
docker run -p 3000:3000 cheff-guio-backend
```

## 🔒 Segurança

- ✅ Autenticação JWT
- ✅ Validação de entrada
- ✅ Rate limiting
- ✅ CORS configurado
- ✅ Helmet para headers de segurança
- ✅ Sanitização de dados
- ✅ Logs de auditoria

## 📈 Monitoramento

- ✅ Logs estruturados
- ✅ Tratamento de erros centralizado
- ✅ Health check endpoint
- ✅ Métricas de performance

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

Para suporte, envie um email para suporte@cheffguio.com ou abra uma issue no GitHub.

## 🔄 Changelog

### v1.0.0
- ✅ CRUD completo de restaurantes
- ✅ CRUD completo de áreas
- ✅ CRUD completo de mesas
- ✅ CRUD completo de cardápio
- ✅ Sistema de reservas
- ✅ Autenticação JWT
- ✅ Documentação Swagger
- ✅ Validação de dados
- ✅ Tratamento de erros
- ✅ Rate limiting e segurança

---

Desenvolvido com ❤️ para o Cheff Guio # angubackend
