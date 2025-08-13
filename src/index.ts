import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
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
import whatsappRoutes from './routes/whatsappRoutes';
import uploadRoutes from './routes/uploadRoutes';
import aiRoutes from './routes/aiRoutes';
import crmRoutes from './routes/crmRoutes';
import userRoutes from './routes/userRoutes';

// Import middleware
import { errorHandler, notFound } from './middleware/errorHandler';

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
        url: process.env.BACKEND_URL || `http://localhost:${PORT}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      },
      {
        url: 'https://api.cheffguio.com',
        description: 'Production server'
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Permitir requisições sem origin (como mobile apps ou Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',') 
      : ['http://localhost:5173', 'http://localhost:3000', 'https://cheffguio.com'];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS: Origin ${origin} não permitida`);
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    app: 'Angu API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Cheff Guio API Documentation'
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/areas', areaRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/waiting-lists', waitingListRoutes);
app.use('/api/experience', experienceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation available at ${process.env.BACKEND_URL || `http://localhost:${PORT}`}/api-docs`);
  console.log(`🏥 Health check available at ${process.env.BACKEND_URL || `http://localhost:${PORT}`}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app; 