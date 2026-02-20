import { Router } from 'express';
import { AgendamentoController } from '../controllers/AgendamentoController';
import { authenticate } from '../../../core/auth/middleware';
import { validate, validateQuery, validateParams } from '../../../shared/middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import { createAgendamentoSchema, updateAgendamentoSchema, agendamentoQuerySchema } from '../schemas/agendamento';
import Joi from 'joi';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

router.post('/', requirePermission('descarregamento.agendamentos.create'), validate(createAgendamentoSchema), AgendamentoController.create);
router.get('/date-range', requirePermission('descarregamento.agendamentos.view'), AgendamentoController.getByDateRange);
router.get('/', requirePermission('descarregamento.agendamentos.view'), validateQuery(agendamentoQuerySchema), AgendamentoController.findAll);
router.get('/:id', requirePermission('descarregamento.agendamentos.view'), validateParams(paramsSchema), AgendamentoController.findById);
router.get('/:id/status-history', requirePermission('descarregamento.agendamentos.view'), validateParams(paramsSchema), AgendamentoController.getStatusHistory);
router.put('/:id', requirePermission('descarregamento.agendamentos.edit'), validateParams(paramsSchema), validate(updateAgendamentoSchema), AgendamentoController.update);
router.delete('/:id', requirePermission('descarregamento.agendamentos.delete'), validateParams(paramsSchema), AgendamentoController.delete);

export default router;
