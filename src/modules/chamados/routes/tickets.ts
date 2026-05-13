import { Router } from 'express';
import { TicketController } from '../controllers/TicketController';
import { FinanceApprovalController } from '../controllers/FinanceApprovalController';
import { authenticate, authorize } from '../../../core/auth/middleware';
import { validate, validateQuery, validateParams } from '../../../shared/middleware/validation';
import {
  createTicketSchema,
  updateTicketSchema,
  assignTicketSchema,
  addMessageSchema,
  ticketQuerySchema,
  completeCardSubscriptionSchema
} from '../schemas/ticket';
import { UserRole } from '../../../shared/types';
import { requirePermission, adminOrPermission } from '../../../core/permissions/middleware';
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

// Lista de abertos — antes de /:id; apenas atendente/admin (como antes)
router.get(
  '/open/list',
  authorize(UserRole.ATTENDANT, UserRole.ADMIN),
  requirePermission('tickets.view'),
  TicketController.getOpenTickets
);

/** Antes de /:id — pendentes de aprovação financeira (aprovadores ou admin). */
router.get(
  '/pending-finance-approval',
  adminOrPermission('chamados.finance_approval.approve'),
  FinanceApprovalController.listPending
);

router.get('/:id', requirePermission('tickets.view'), validateParams(paramsSchema), TicketController.findById);
router.post('/:id/messages', requirePermission('tickets.messages.create'), validateParams(paramsSchema), validate(addMessageSchema), TicketController.addMessage);
router.get('/:id/history', requirePermission('tickets.history.view'), validateParams(paramsSchema), TicketController.getHistory);
router.post('/:id/reopen', requirePermission('tickets.reopen'), validateParams(paramsSchema), TicketController.reopen);

// Rotas para aprovação de chamados (solicitantes)
router.post('/:id/approve', validateParams(paramsSchema), TicketController.approveTicket);
router.post('/:id/reject', validateParams(paramsSchema), TicketController.rejectTicket);

/** Aprovação / rejeição financeira (aprovador designado ou admin) — antes do gate de atendente. */
router.post(
  '/:id/finance-approve',
  adminOrPermission('chamados.finance_approval.approve'),
  validateParams(paramsSchema),
  FinanceApprovalController.approve
);
router.post(
  '/:id/finance-reject',
  adminOrPermission('chamados.finance_approval.approve'),
  validateParams(paramsSchema),
  FinanceApprovalController.reject
);

// Rotas apenas para atendentes e administradores
router.use(authorize(UserRole.ATTENDANT, UserRole.ADMIN));

router.put('/:id', requirePermission('tickets.edit'), validateParams(paramsSchema), validate(updateTicketSchema), TicketController.update);
router.post('/:id/assign', requirePermission('tickets.assign'), validateParams(paramsSchema), validate(assignTicketSchema), TicketController.assign);
router.post('/:id/claim', requirePermission('tickets.assign'), validateParams(paramsSchema), TicketController.claimTicket);
router.post('/:id/close', requirePermission('tickets.close'), validateParams(paramsSchema), TicketController.close);
router.post(
  '/:id/complete-card-subscription',
  requirePermission('tickets.edit'),
  validateParams(paramsSchema),
  validate(completeCardSubscriptionSchema),
  TicketController.completeCardSubscription
);
router.post('/:id/request-approval', requirePermission('tickets.edit'), validateParams(paramsSchema), TicketController.requestApproval);

// Rotas apenas para administradores
router.use(authorize(UserRole.ADMIN));

router.delete('/:id', requirePermission('tickets.delete'), validateParams(paramsSchema), TicketController.delete);
router.get('/sla/violations', requirePermission('tickets.sla.view'), TicketController.getSlaViolations);

export default router;
