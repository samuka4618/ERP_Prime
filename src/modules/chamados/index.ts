import { Router } from 'express';
import ticketRoutes from './routes/tickets';
import categoryRoutes from './routes/categories';
import categoryAssignmentRoutes from './routes/categoryAssignments';
import attachmentRoutes from './routes/attachments';
import notificationRoutes from './routes/notifications';
import dashboardRoutes from './routes/dashboard';
import reportRoutes from './routes/reports';
import adminMetricsRoutes from './routes/admin-metrics';
import realtimeRoutes from './routes/realtime';

/**
 * Módulo de Chamados
 * Módulo de Chamados do ERP PRIME - Gerencia tickets, categorias, notificações e relatórios
 */
export function registerChamadosRoutes(router: Router, uploadLimiter: any) {
  router.use('/tickets', ticketRoutes);
  router.use('/categories', categoryRoutes);
  router.use('/category-assignments', categoryAssignmentRoutes);
  router.use('/attachments', uploadLimiter, attachmentRoutes);
  router.use('/notifications', notificationRoutes);
  router.use('/dashboard', dashboardRoutes);
  router.use('/reports', reportRoutes);
  router.use('/admin-metrics', adminMetricsRoutes);
  router.use('/realtime', realtimeRoutes);
}

export * from './services/StatusUpdateService';
export * from './services/WebSocketService';

