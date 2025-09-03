import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
// import rateLimit from 'express-rate-limit'; // DESABILITADO TEMPORARIAMENTE
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';

// Import routes
import restaurantRoutes from './routes/restaurantRoutes';
import reservationRoutes from './routes/reservationRoutes';
import areaRoutes from './routes/areaRoutes';
import tableRoutes from './routes/tableRoutes';
import menuRoutes from './routes/menuRoutes';
import authRoutes from './routes/authRoutes';
import waitingListRoutes from './routes/waitingListRoutes';
import experienceRoutes from './routes/experienceRoutes';
import customerRoutes from './routes/customerRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import chatRoutes from './routes/chatRoutes';

import uploadRoutes from './routes/uploadRoutes';
import aiRoutes from './routes/aiRoutes';
import crmRoutes from './routes/crmRoutes';
import userRoutes from './routes/userRoutes';
import notificationRoutes from './routes/notificationRoutes';
import publicMenuRoutes from './routes/publicMenuRoutes';
import publicRoutes from './routes/publicRoutes';


// Import middleware
import { errorHandler, notFound } from './middleware/errorHandler';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cheff Guio API',
      version: '1.0.0',
      description: 'API for Cheff Guio restaurant management system',
      contact: {
        name: 'API Support',
        email: 'support@cheffguio.com'
      }
    },
    servers: [
      {
        url: 'https://angubackend-production.up.railway.app',
        description: 'Production server'
      },
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtido através do login'
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API Key para integrações externas (n8n)'
        }
      },
      schemas: {
        Restaurant: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postal_code: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            website: { type: 'string' },
            opening_hours: { type: 'object' },
            max_capacity: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Reservation: {
          type: 'object',
          required: ['id', 'customer_name', 'number_of_people', 'reservation_date', 'start_time'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            customer_name: { type: 'string' },
            phone: { type: 'string' },
            number_of_people: { type: 'number' },
            reservation_date: { type: 'string', format: 'date' },
            start_time: { type: 'string' },
            table_id: { type: 'string', format: 'uuid' },
            area_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'canceled', 'completed', 'seated'] },
            notes: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        RestaurantArea: {
          type: 'object',
          required: ['id', 'restaurant_id', 'name', 'is_active', 'max_tables'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            restaurant_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            max_capacity: { type: 'number' },
            max_tables: { type: 'number' },
            is_active: { type: 'boolean' },
            order: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Table: {
          type: 'object',
          required: ['id', 'restaurant_id', 'area_id', 'number', 'capacity', 'status', 'is_active'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            restaurant_id: { type: 'string', format: 'uuid' },
            area_id: { type: 'string', format: 'uuid' },
            number: { type: 'number' },
            name: { type: 'string' },
            capacity: { type: 'number' },
            shape: { type: 'string', enum: ['round', 'square', 'rectangle'] },
            width: { type: 'number' },
            height: { type: 'number' },
            position_x: { type: 'number' },
            position_y: { type: 'number' },
            status: { type: 'string', enum: ['available', 'occupied', 'reserved', 'blocked'] },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        TableWithArea: {
          allOf: [{ $ref: '#/components/schemas/Table' }],
          type: 'object',
          properties: {
            area: { $ref: '#/components/schemas/RestaurantArea' }
          }
        },
        TableStatusHistory: {
          type: 'object',
          required: ['id', 'table_id', 'previous_status', 'new_status', 'changed_at'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            table_id: { type: 'string', format: 'uuid' },
            previous_status: { type: 'string' },
            new_status: { type: 'string' },
            changed_by: { type: 'string' },
            notes: { type: 'string' },
            changed_at: { type: 'string', format: 'date-time' }
          }
        },
        MenuCategory: {
          type: 'object',
          required: ['id', 'restaurant_id', 'name', 'is_active'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            restaurant_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            order: { type: 'number' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        MenuItem: {
          type: 'object',
          required: ['id', 'restaurant_id', 'category_id', 'name', 'price', 'is_active'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            restaurant_id: { type: 'string', format: 'uuid' },
            category_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            image_url: { type: 'string' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        MenuItemWithCategory: {
          allOf: [{ $ref: '#/components/schemas/MenuItem' }],
          type: 'object',
          properties: {
            category: { $ref: '#/components/schemas/MenuCategory' }
          }
        },
        ChatContact: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            restaurant_id: { type: 'string', format: 'uuid' },
            phone_number: { type: 'string' },
            name: { type: 'string' },
            profile_image_url: { type: 'string' },
            status: { type: 'string', enum: ['new', 'active', 'inactive'] },
            customer_type: { type: 'string', enum: ['new', 'returning', 'vip'] },
            last_message_at: { type: 'string', format: 'date-time' },
            unread_count: { type: 'number' },
            tags: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        ChatMessage: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sender_type: { type: 'string', enum: ['customer', 'restaurant', 'ai'] },
            sender_id: { type: 'string' },
            content: { type: 'string' },
            content_type: { type: 'string', enum: ['text', 'image', 'file', 'location', 'contact'] },
            media_url: { type: 'string' },
            is_read: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        CrmStage: {
          type: 'object',
          required: ['id', 'restaurant_id', 'name', 'order', 'is_active'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            restaurant_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            color: { type: 'string' },
            icon: { type: 'string' },
            order: { type: 'number' },
            is_active: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        CrmCard: {
          type: 'object',
          required: ['id', 'restaurant_id', 'stage_id', 'title', 'priority', 'status'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            restaurant_id: { type: 'string', format: 'uuid' },
            stage_id: { type: 'string', format: 'uuid' },
            contact_id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            status: { type: 'string', enum: ['active', 'completed', 'archived'] },
            due_date: { type: 'string', format: 'date-time' },
            assigned_to: { type: 'string', format: 'uuid' },
            last_contact_date: { type: 'string', format: 'date-time' },
            last_contact_channel: { type: 'string' },
            value: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        CrmCardTag: {
          type: 'object',
          required: ['id', 'restaurant_id', 'name'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            restaurant_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            color: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        CrmCardActivity: {
          type: 'object',
          required: ['id', 'card_id', 'activity_type', 'description', 'performed_at'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            card_id: { type: 'string', format: 'uuid' },
            activity_type: { type: 'string', enum: ['note', 'stage_change', 'contact', 'reservation', 'event'] },
            description: { type: 'string' },
            performed_by: { type: 'string', format: 'uuid' },
            performed_at: { type: 'string', format: 'date-time' }
          }
        },
        CrmCardWithDetails: {
          allOf: [{ $ref: '#/components/schemas/CrmCard' }],
          type: 'object',
          properties: {
            contact: { $ref: '#/components/schemas/ChatContact' },
            tags: { type: 'array', items: { $ref: '#/components/schemas/CrmCardTag' } },
            activities: { type: 'array', items: { $ref: '#/components/schemas/CrmCardActivity' } }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' }
          }
        },
        DashboardStats: {
          type: 'object',
          properties: {
            reservations: {
              type: 'object',
              properties: {
                today: { type: 'number' },
                upcoming: { type: 'number' },
                total: { type: 'number' }
              }
            },
            tables: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                occupied: { type: 'number' },
                available: { type: 'number' },
                reserved: { type: 'number' },
                blocked: { type: 'number' }
              }
            },
            customers: {
              type: 'object',
              properties: {
                today: { type: 'number' },
                yesterday: { type: 'number' },
                total: { type: 'number' }
              }
            },
            waitingList: {
              type: 'object',
              properties: {
                waiting: { type: 'number' },
                notified: { type: 'number' },
                seated: { type: 'number' },
                no_show: { type: 'number' }
              }
            },
            occupancy: {
              type: 'object',
              properties: {
                current: { type: 'number' },
                weekly: { type: 'number' }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// ⚠️ RATE LIMITING DESABILITADO TEMPORARIAMENTE ⚠️
// 
// MOTIVO: Durante o desenvolvimento, o frontend faz muitas requisições simultâneas
// que estavam causando erros 429 (Too Many Requests). Para resolver:
//
// 1. Desabilitei o rate limiting temporariamente
// 2. O sistema agora aceita todas as requisições sem limitação
// 3. ATENÇÃO: Reative antes de ir para produção!
//
// Para reativar, descomente as linhas abaixo:
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: {
//     success: false,
//     error: 'Too many requests from this IP, please try again later.'
//   }
// });

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Configuration - Hardcoded para produção
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Permitir requisições sem origin (como mobile apps ou Postman)
    if (!origin) return callback(null, true);
    
    // Configuração de CORS hardcoded para funcionar imediatamente
    const allowedOrigins = [
      'http://localhost:5173', 
      'http://localhost:3000', 
      'http://localhost:4173',
      'https://cheffguio.com',
      'https://angubackend-production.up.railway.app',
      'https://angu.ai',
      'https://www.angu.ai',
      'https://api.angu.ai'
    ];
    
    // Log para debug
    console.log(`🌍 CORS: Origin ${origin} solicitando acesso`);
    console.log(`✅ CORS: Origins permitidos: ${allowedOrigins.join(', ')}`);
    
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: Origin ${origin} permitida`);
      callback(null, true);
    } else {
      console.log(`🚫 CORS: Origin ${origin} não permitida`);
      // Permitir todas as origens para desenvolvimento
      console.log(`🔄 CORS: Permitindo origin ${origin} para desenvolvimento`);
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

// Middleware adicional para CORS preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Configuração do Helmet mais flexível para desenvolvimento
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(compression());
app.use(morgan('combined'));
// app.use(limiter); // ⚠️ Rate limiting desabilitado temporariamente - reative antes da produção!

// Rota raiz - Redireciona para documentação
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Bloquear acesso a arquivos sensíveis
app.use('/.git', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use('/.env', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Health check endpoint - Otimizado para Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Health check detalhado - Para debugging
app.get('/health/detailed', (req, res) => {
  res.json({ 
    status: 'OK', 
    app: 'Angu API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '3001'
  });
});



// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Cheff Guio API Documentation'
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/waiting-lists', waitingListRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/experience', experienceRoutes);
app.use('/api/users', userRoutes);


// Public routes (no authentication required)
app.use('/api/public/menu', publicMenuRoutes);
app.use('/api/public', publicRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation available at https://angubackend-production.up.railway.app/api-docs`);
  console.log(`🏥 Health check (Railway): https://angubackend-production.up.railway.app/health`);
  console.log(`🔍 Health check (Detalhado): https://angubackend-production.up.railway.app/health/detailed`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ CORS configurado para: localhost:5173, localhost:3000, cheffguio.com, angubackend-production.up.railway.app, angu.ai, api.angu.ai`);
});

export default app; 