import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../../../core/permissions/middleware';

const router = Router();

// Todas as rotas do dashboard precisam de autenticação
router.use(authenticate);

// Estatísticas do dashboard
router.get('/stats', requirePermission('dashboard.view'), DashboardController.getStats);

// Atividades recentes
router.get('/recent-activity', requirePermission('dashboard.view'), DashboardController.getRecentActivity);

export default router;