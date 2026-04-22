import { Router } from 'express';
import { PerformanceController } from './PerformanceController';
import { authenticate } from '../auth/middleware';
import { adminOrPermission, requireAnyPermission } from '../permissions/middleware';

const router = Router();

// Todas as rotas de performance requerem autenticação
router.use(authenticate);

// GET /api/performance/metrics — administrador ou permissão de gestão
router.get('/metrics', adminOrPermission('performance.manage'), PerformanceController.getMetrics);

// GET /api/performance/dashboard — leitura para widget (performance.view ou performance.manage)
router.get(
  '/dashboard',
  requireAnyPermission('performance.view', 'performance.manage'),
  PerformanceController.getDashboardMetrics
);

export default router;
