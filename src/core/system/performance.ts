import { Router } from 'express';
import { PerformanceController } from './PerformanceController';
import { authenticate, authorize } from '../auth/middleware';
import { UserRole } from '../../shared/types';

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
