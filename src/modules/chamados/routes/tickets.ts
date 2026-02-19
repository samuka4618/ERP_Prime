import { Router } from 'express';
import { TicketController } from '../controllers/TicketController';
import { authenticate, authorize } from '../../../core/auth/middleware';
import { validate, validateQuery, validateParams } from '../../../shared/middleware/validation';
import { createTicketSchema, updateTicketSchema, assignTicketSchema, addMessageSchema, ticketQuerySchema } from '../schemas/ticket';
import { UserRole } from '../../../shared/types';
import { requirePermission } from '../../../core/permissions/middleware';
import Joi from 'joi';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// Rotas para todos os usuários autenticados
router.post('/', requirePermission('tickets.create'), validate(createTicketSchema), TicketController.create);
router.get('/', requirePermission('tickets.view'), validateQuery(ticketQuerySchema), TicketController.findAll);
router.get('/:id', requirePermission('tickets.view'), validateParams(paramsSchema), TicketController.findById);
router.post('/:id/messages', requirePermission('tickets.messages.create'), validateParams(paramsSchema), validate(addMessageSchema), TicketController.addMessage);
router.get('/:id/history', requirePermission('tickets.history.view'), validateParams(paramsSchema), TicketController.getHistory);
router.post('/:id/reopen', requirePermission('tickets.reopen'), validateParams(paramsSchema), TicketController.reopen);

// Rotas para aprovação de chamados (solicitantes)
router.post('/:id/approve', validateParams(paramsSchema), TicketController.approveTicket);
router.post('/:id/reject', validateParams(paramsSchema), TicketController.rejectTicket);

// Rotas apenas para atendentes e administradores
router.use(authorize(UserRole.ATTENDANT, UserRole.ADMIN));

router.put('/:id', requirePermission('tickets.edit'), validateParams(paramsSchema), validate(updateTicketSchema), TicketController.update);
router.post('/:id/assign', requirePermission('tickets.assign'), validateParams(paramsSchema), validate(assignTicketSchema), TicketController.assign);
router.post('/:id/claim', requirePermission('tickets.assign'), validateParams(paramsSchema), TicketController.claimTicket);
router.post('/:id/close', requirePermission('tickets.close'), validateParams(paramsSchema), TicketController.close);
router.post('/:id/request-approval', requirePermission('tickets.edit'), validateParams(paramsSchema), TicketController.requestApproval);
router.get('/open/list', requirePermission('tickets.view'), TicketController.getOpenTickets);

// Rotas apenas para administradores
router.use(authorize(UserRole.ADMIN));

router.delete('/:id', requirePermission('tickets.delete'), validateParams(paramsSchema), TicketController.delete);
router.get('/sla/violations', requirePermission('tickets.sla.view'), TicketController.getSlaViolations);

export default router;
