import { Router } from 'express';
import { authenticate, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import { CustomerController } from '../controllers/customerController';

const router = Router();

// Rota para buscar todos os clientes com paginação e filtros
router.get('/', authenticate, requireRestaurant, CustomerController.getCustomers);

// Rota para buscar estatísticas dos clientes
router.get('/stats/overview', authenticate, requireRestaurant, CustomerController.getCustomerStats);

// Rota para buscar clientes de hoje (mantida para compatibilidade)
router.get('/today', authenticate, requireRestaurant, CustomerController.getTodayCustomers);

// Rota para buscar clientes de ontem (mantida para compatibilidade)
router.get('/yesterday', authenticate, requireRestaurant, CustomerController.getYesterdayCustomers);

// Rota para buscar cliente por ID (deve vir depois das rotas específicas)
router.get('/:id', authenticate, requireRestaurant, CustomerController.getCustomerById);

// Rota para criar novo cliente
router.post('/', authenticate, requireRestaurant, CustomerController.createCustomer);

// Rota para atualizar cliente
router.put('/:id', authenticate, requireRestaurant, CustomerController.updateCustomer);

// Rota para deletar cliente
router.delete('/:id', authenticate, requireRestaurant, CustomerController.deleteCustomer);

// Rota para atualizar status do cliente
router.patch('/:id/status', authenticate, requireRestaurant, CustomerController.updateCustomerStatus);

export default router; 