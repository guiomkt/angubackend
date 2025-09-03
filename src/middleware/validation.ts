import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: error.details.map(detail => detail.message)
      });
      return;
    }
    next();
  };
};

// Validation schemas
export const restaurantSchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().optional().max(500),
  address: Joi.string().optional().max(200),
  city: Joi.string().optional().max(100),
  state: Joi.string().optional().max(50),
  postal_code: Joi.string().optional().max(10),
  phone: Joi.string().optional().max(20),
  email: Joi.string().email().optional(),
  website: Joi.string().uri().optional(),
  opening_hours: Joi.object().optional(),
  max_capacity: Joi.number().integer().min(1).optional()
});

export const areaSchema = Joi.object({
  restaurant_id: Joi.string().uuid().required(),
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().optional().max(500),
  max_capacity: Joi.number().integer().min(1).optional(),
  max_tables: Joi.number().integer().min(1).required(),
  is_active: Joi.boolean().default(true),
  order: Joi.number().integer().min(0).optional()
});

export const areaUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  max_capacity: Joi.number().integer().min(1).optional(),
  max_tables: Joi.number().integer().min(1).optional(),
  is_active: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional()
});

export const tableSchema = Joi.object({
  restaurant_id: Joi.string().uuid().required(),
  area_id: Joi.string().uuid().required(),
  name: Joi.string().optional().max(100),
  number: Joi.number().integer().min(1).optional(),
  capacity: Joi.number().integer().min(1).required(),
  shape: Joi.string().valid('round', 'square', 'rectangle').default('round'),
  width: Joi.number().positive().default(100),
  height: Joi.number().positive().default(100),
  position_x: Joi.number().default(0),
  position_y: Joi.number().default(0),
  status: Joi.string().valid('available', 'occupied', 'reserved', 'blocked').default('available'),
  is_active: Joi.boolean().default(true)
});

export const tableUpdateSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  capacity: Joi.number().integer().min(1).optional(),
  shape: Joi.string().valid('round', 'square', 'rectangle').optional(),
  width: Joi.number().positive().optional(),
  height: Joi.number().positive().optional(),
  position_x: Joi.number().optional(),
  position_y: Joi.number().optional(),
  status: Joi.string().valid('available', 'occupied', 'reserved', 'blocked').optional(),
  is_active: Joi.boolean().optional()
});

export const tableStatusSchema = Joi.object({
  status: Joi.string().valid('available', 'occupied', 'reserved', 'blocked').required(),
  notes: Joi.string().optional().allow('').max(500),
  changedBy: Joi.string().optional()
});

export const tablePositionSchema = Joi.object({
  positionX: Joi.number().required(),
  positionY: Joi.number().required()
});

export const reservationSchema = Joi.object({
  customer_name: Joi.string().required().min(2).max(100),
  phone: Joi.string().optional().max(20),
  number_of_people: Joi.number().integer().min(1).required(),
  reservation_date: Joi.string().required(),
  start_time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  table_id: Joi.string().uuid().optional(),
  area_id: Joi.string().uuid().optional(),
  status: Joi.string().valid('pending', 'confirmed', 'canceled', 'completed', 'seated').default('pending'),
  notes: Joi.string().optional().allow('').max(500),
  // Campos opcionais que podem vir do frontend
  reservation_experience_id: Joi.string().optional(),
  reservation_experience_data: Joi.object().optional(),
  restaurant_id: Joi.string().uuid().optional()
}).unknown(true); // Permite campos adicionais

export const waitingListSchema = Joi.object({
  customer_name: Joi.string().required().min(2).max(100),
  phone_number: Joi.string().required().max(20),
  party_size: Joi.number().integer().min(1).default(1),
  priority: Joi.string().valid('low', 'medium', 'high').default('low'),
  area_preference: Joi.string().uuid().optional(),
  estimated_wait_time: Joi.number().integer().min(1).optional(),
  notes: Joi.string().optional().max(500)
});

// Menu validation schemas
export const menuCategorySchema = Joi.object({
  restaurant_id: Joi.string().uuid().required(),
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().optional().allow('').max(500),
  order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().default(true)
});

export const menuCategoryUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().optional().allow('').max(500),
  order: Joi.number().integer().min(0).optional(),
  is_active: Joi.boolean().optional()
});

export const menuItemSchema = Joi.object({
  restaurant_id: Joi.string().uuid().required(),
  category_id: Joi.string().uuid().required(),
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().optional().allow('').max(500),
  price: Joi.number().positive().required(),
  image_url: Joi.string().uri().optional().allow(''),
  is_active: Joi.boolean().default(true)
});

export const menuItemUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().optional().allow('').max(500),
  price: Joi.number().positive().optional(),
  image_url: Joi.string().uri().optional().allow(''),
  is_active: Joi.boolean().optional(),
  category_id: Joi.string().uuid().optional()
});

// Celebration validation schemas
export const categoriaComemoracaoSchema = Joi.object({
  nome: Joi.string().required().min(2).max(100),
  tipo_recorrencia: Joi.string().valid('unica', 'dias_semana', 'periodo').required(),
  dias_semana: Joi.array().items(Joi.number().min(0).max(6)).optional(),
  data_inicio: Joi.date().iso().required(),
  data_fim: Joi.date().iso().required(),
  descricao: Joi.string().optional().max(500),
  qtd_min: Joi.number().integer().min(1).required(),
  cor: Joi.string().optional().max(7),
  status: Joi.boolean().default(true)
});

// Schemas de validação para restaurantes
export const restaurantSchemas = {
  create: Joi.object({
    name: Joi.string().required().min(2).max(100),
    description: Joi.string().optional().max(500).allow(''),
    logo_url: Joi.string().uri().optional().allow('', null),
    address: Joi.string().optional().max(200).allow(''),
    city: Joi.string().optional().max(100).allow(''),
    state: Joi.string().optional().max(50).allow(''),
    postal_code: Joi.string().optional().max(20).allow(''),
    phone: Joi.string().optional().max(20).allow(''),
    email: Joi.string().email().required(),
    website: Joi.string().uri().optional().allow(''),
    opening_hours: Joi.object().optional().unknown(true),
    max_capacity: Joi.number().integer().min(0).optional()
  }),

  update: Joi.object({
    name: Joi.string().optional().min(2).max(100),
    description: Joi.string().optional().max(500).allow(''),
    logo_url: Joi.string().uri().optional().allow('', null),
    address: Joi.string().optional().max(200).allow(''),
    city: Joi.string().optional().max(100).allow(''),
    state: Joi.string().optional().max(50).allow(''),
    postal_code: Joi.string().optional().max(20).allow(''),
    phone: Joi.string().optional().max(20).allow(''),
    email: Joi.string().email().optional().allow(''),
    website: Joi.string().uri().optional().allow(''),
    opening_hours: Joi.object().optional().unknown(true),
    max_capacity: Joi.number().integer().min(0).optional(),
    onboarding_step: Joi.number().integer().min(0).max(10).optional(),
    onboarding_completed: Joi.boolean().optional()
  })
};

// Schemas de validação para reservas
export const reservationSchemas = {
  create: Joi.object({
    customer_name: Joi.string().required().min(2).max(100),
    phone: Joi.string().required().max(20),
    number_of_people: Joi.number().integer().min(1).max(50).required(),
    reservation_date: Joi.date().iso().required(),
    start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    table_id: Joi.string().uuid().required(),
    area_id: Joi.string().uuid().required(),
    status: Joi.string().valid('pending', 'confirmed', 'canceled', 'completed').default('pending'),
    notes: Joi.string().optional().max(500),
    categoria_comemoracao_id: Joi.string().uuid().optional(),
    people_list: Joi.array().items(Joi.string()).optional()
  }),

  update: Joi.object({
    customer_name: Joi.string().optional().min(2).max(100),
    phone: Joi.string().optional().max(20),
    number_of_people: Joi.number().integer().min(1).max(50).optional(),
    reservation_date: Joi.date().iso().optional(),
    start_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    end_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    table_id: Joi.string().uuid().optional(),
    area_id: Joi.string().uuid().optional(),
    status: Joi.string().valid('pending', 'confirmed', 'canceled', 'completed').optional(),
    notes: Joi.string().optional().max(500),
    categoria_comemoracao_id: Joi.string().uuid().optional(),
    people_list: Joi.array().items(Joi.string()).optional()
  })
};

// Schemas de validação para áreas
export const areaSchemas = {
  create: Joi.object({
    name: Joi.string().required().min(2).max(100),
    description: Joi.string().optional().max(500),
    max_capacity: Joi.number().integer().min(1).required(),
    max_tables: Joi.number().integer().min(1).required(),
    is_active: Joi.boolean().default(true),
    order: Joi.number().integer().min(0).default(0)
  }),

  update: Joi.object({
    name: Joi.string().optional().min(2).max(100),
    description: Joi.string().optional().max(500),
    max_capacity: Joi.number().integer().min(1).optional(),
    max_tables: Joi.number().integer().min(1).optional(),
    is_active: Joi.boolean().optional(),
    order: Joi.number().integer().min(0).optional()
  })
};

// Schemas de validação para mesas
export const tableSchemas = {
  create: Joi.object({
    number: Joi.number().integer().min(1).required(),
    name: Joi.string().optional().max(100),
    capacity: Joi.number().integer().min(1).required(),
    shape: Joi.string().valid('round', 'square', 'rectangle').default('round'),
    width: Joi.number().positive().default(100),
    height: Joi.number().positive().default(100),
    position_x: Joi.number().default(0),
    position_y: Joi.number().default(0),
    status: Joi.string().valid('available', 'occupied', 'reserved', 'blocked').default('available'),
    is_active: Joi.boolean().default(true),
    area_id: Joi.string().uuid().required()
  }),

  update: Joi.object({
    number: Joi.number().integer().min(1).optional(),
    name: Joi.string().optional().max(100),
    capacity: Joi.number().integer().min(1).optional(),
    shape: Joi.string().valid('round', 'square', 'rectangle').optional(),
    width: Joi.number().positive().optional(),
    height: Joi.number().positive().optional(),
    position_x: Joi.number().optional(),
    position_y: Joi.number().optional(),
    status: Joi.string().valid('available', 'occupied', 'reserved', 'blocked').optional(),
    is_active: Joi.boolean().optional(),
    area_id: Joi.string().uuid().optional()
  })
};

// Schemas de validação para menu
export const menuSchemas = {
  category: {
    create: Joi.object({
      name: Joi.string().required().min(2).max(100),
      description: Joi.string().optional().max(500),
      order: Joi.number().integer().min(0).default(0),
      is_active: Joi.boolean().default(true)
    }),

    update: Joi.object({
      name: Joi.string().optional().min(2).max(100),
      description: Joi.string().optional().max(500),
      order: Joi.number().integer().min(0).optional(),
      is_active: Joi.boolean().optional()
    })
  },

  item: {
    create: Joi.object({
      name: Joi.string().required().min(2).max(100),
      description: Joi.string().optional().max(500),
      price: Joi.number().positive().required(),
      image_url: Joi.string().uri().optional(),
      is_active: Joi.boolean().default(true),
      category_id: Joi.string().uuid().required()
    }),

    update: Joi.object({
      name: Joi.string().optional().min(2).max(100),
      description: Joi.string().optional().max(500),
      price: Joi.number().positive().optional(),
      image_url: Joi.string().uri().optional(),
      is_active: Joi.boolean().optional(),
      category_id: Joi.string().uuid().optional()
    })
  }
};

// Schemas de validação para autenticação
export const authSchemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().required().min(2).max(100),
    restaurantName: Joi.string().required().min(2).max(100),
    phone: Joi.string().optional().max(20)
  })
};



export const registerTemplateSchema = Joi.object({
  restaurantId: Joi.string().uuid().required(),
  template: Joi.object().required(),
  language: Joi.string().optional()
}); 