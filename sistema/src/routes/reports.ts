import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { authMiddleware, authorize } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { reportSchema, reportExecutionSchema, reportScheduleSchema } from '../schemas/report';
import { UserRole } from '../types';

const router = Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

// Rotas para Reports
router.post('/', 
  validateRequest(reportSchema.create),
  ReportController.createReport
);

router.get('/', ReportController.getReports);

router.get('/:id', ReportController.getReportById);

router.put('/:id', 
  validateRequest(reportSchema.update),
  ReportController.updateReport
);

router.delete('/:id', authorize(UserRole.ADMIN), ReportController.deleteReport);

// Rotas para execução de relatórios
router.post('/:id/execute', 
  validateRequest(reportExecutionSchema),
  ReportController.executeReport
);

router.get('/:id/executions', ReportController.getExecutionStatus);

router.get('/executions/:executionId/result', ReportController.getExecutionResult);

router.get('/executions/:executionId/export', ReportController.exportReport);

router.delete('/executions/:executionId', ReportController.deleteExecution);

// Rotas para relatórios personalizados
router.get('/custom/fields', ReportController.getAvailableFields);
router.post('/custom', ReportController.createCustomReport);
router.post('/:id/execute-custom', ReportController.executeCustomReport);

// Rotas para agendamentos
router.post('/schedules', 
  validateRequest(reportScheduleSchema),
  ReportController.createSchedule
);

router.get('/:reportId/schedules', ReportController.getSchedules);

router.delete('/schedules/:scheduleId', ReportController.deleteSchedule);

export default router;
