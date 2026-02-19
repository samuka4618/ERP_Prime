import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Todas as rotas do dashboard precisam de autenticação
router.use(authenticate);

// Estatísticas do dashboard
router.get('/stats', DashboardController.getStats);

// Atividades recentes
router.get('/recent-activity', DashboardController.getRecentActivity);

export default router;