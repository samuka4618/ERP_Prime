import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { authMiddleware, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { reportSchema, reportExecutionSchema, reportScheduleSchema } from '../schemas/report';
import { UserRole } from '../types';
import { requirePermission } from '../../../core/permissions/middleware';

const router = Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

// Rotas para Reports
router.post('/', 
  requirePermission('reports.create'),
  validateRequest(reportSchema.create),
  ReportController.createReport
);

router.get('/', requirePermission('reports.view'), ReportController.getReports);

router.get('/:id', requirePermission('reports.view'), ReportController.getReportById);

router.put('/:id', 
  requirePermission('reports.edit'),
  validateRequest(reportSchema.update),
  ReportController.updateReport
);

router.delete('/:id', requirePermission('reports.delete'), authorize(UserRole.ADMIN), ReportController.deleteReport);

// Rotas para execução de relatórios
router.post('/:id/execute', 
  requirePermission('reports.execute'),
  validateRequest(reportExecutionSchema),
  ReportController.executeReport
);

router.get('/:id/executions', requirePermission('reports.execute'), ReportController.getExecutionStatus);

router.get('/executions/:executionId/result', requirePermission('reports.execute'), ReportController.getExecutionResult);

router.get('/executions/:executionId/export', requirePermission('reports.export'), ReportController.exportReport);

router.delete('/executions/:executionId', requirePermission('reports.execute'), ReportController.deleteExecution);

// Rotas para relatórios personalizados
router.get('/custom/fields', ReportController.getAvailableFields);
router.post('/custom/validate', requirePermission('reports.view'), ReportController.validateCustomReportFields);
router.post('/custom', ReportController.createCustomReport);
router.post('/:id/execute-custom', ReportController.executeCustomReport);

// Rotas para agendamentos
router.post('/schedules', 
  requirePermission('reports.schedule.manage'),
  validateRequest(reportScheduleSchema),
  ReportController.createSchedule
);

router.get('/:reportId/schedules', requirePermission('reports.schedule.manage'), ReportController.getSchedules);

router.delete('/schedules/:scheduleId', requirePermission('reports.schedule.manage'), ReportController.deleteSchedule);

export default router;
