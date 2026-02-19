import { Router } from 'express';
import { PerformanceController } from '../controllers/PerformanceController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

// Todas as rotas de performance requerem autenticação
router.use(authenticate);

// Apenas administradores podem acessar métricas detalhadas
router.use(authorize(UserRole.ADMIN));

// GET /api/performance/metrics - Métricas completas de performance
router.get('/metrics', PerformanceController.getMetrics);

// GET /api/performance/dashboard - Métricas formatadas para dashboard
router.get('/dashboard', PerformanceController.getDashboardMetrics);

export default router;
