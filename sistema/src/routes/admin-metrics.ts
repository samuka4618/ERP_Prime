import { Router } from 'express';
import { AdminMetricsController } from '../controllers/AdminMetricsController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Rastreamento de atividade - disponível para todos os usuários autenticados
router.post('/track-activity', AdminMetricsController.trackActivity);

// Middleware para exigir role de admin para as demais rotas
router.use(requireRole(UserRole.ADMIN));

// Visão geral do sistema
router.get('/overview', AdminMetricsController.getSystemOverview);

// Métricas de usuários
router.get('/users', AdminMetricsController.getUserMetrics);
router.get('/users/:userId/stats', AdminMetricsController.getUserDetailedStats);

// Métricas de atendentes
router.get('/attendants', AdminMetricsController.getAttendantMetrics);

// Relatórios
router.get('/reports/attendant-performance', AdminMetricsController.getAttendantPerformanceReport);
router.get('/reports/user-activity', AdminMetricsController.getUserActivityReport);

export default router;
