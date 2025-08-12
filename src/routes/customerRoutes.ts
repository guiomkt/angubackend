import { Router } from 'express';
import { authenticateToken, requireRestaurant, AuthenticatedRequest } from '../middleware/auth';
import { CustomerController } from '../controllers/customerController';

const router = Router();

// Rota para buscar todos os clientes com paginação e filtros
router.get('/', authenticateToken, requireRestaurant, CustomerController.getCustomers);

// Rota para buscar estatísticas dos clientes
router.get('/stats/overview', authenticateToken, requireRestaurant, CustomerController.getCustomerStats);

// Rota para buscar clientes de hoje (mantida para compatibilidade)
router.get('/today', authenticateToken, requireRestaurant, CustomerController.getTodayCustomers);

// Rota para buscar clientes de ontem (mantida para compatibilidade)
router.get('/yesterday', authenticateToken, requireRestaurant, CustomerController.getYesterdayCustomers);

// Rota para buscar cliente por ID (deve vir depois das rotas específicas)
router.get('/:id', authenticateToken, requireRestaurant, CustomerController.getCustomerById);

// Rota para criar novo cliente
router.post('/', authenticateToken, requireRestaurant, CustomerController.createCustomer);

// Rota para atualizar cliente
router.put('/:id', authenticateToken, requireRestaurant, CustomerController.updateCustomer);

// Rota para deletar cliente
router.delete('/:id', authenticateToken, requireRestaurant, CustomerController.deleteCustomer);

// Rota para atualizar status do cliente
router.patch('/:id/status', authenticateToken, requireRestaurant, CustomerController.updateCustomerStatus);

export default router; 