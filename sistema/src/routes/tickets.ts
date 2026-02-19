import { Router } from 'express';
import { TicketController } from '../controllers/TicketController';
import { authenticate, authorize } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validation';
import { createTicketSchema, updateTicketSchema, assignTicketSchema, addMessageSchema, ticketQuerySchema } from '../schemas/ticket';
import { UserRole } from '../types';
import Joi from 'joi';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// Rotas para todos os usuários autenticados
router.post('/', validate(createTicketSchema), TicketController.create);
router.get('/', validateQuery(ticketQuerySchema), TicketController.findAll);
router.get('/:id', validateParams(paramsSchema), TicketController.findById);
router.post('/:id/messages', validateParams(paramsSchema), validate(addMessageSchema), TicketController.addMessage);
router.get('/:id/history', validateParams(paramsSchema), TicketController.getHistory);
router.post('/:id/reopen', validateParams(paramsSchema), TicketController.reopen);

// Rotas para aprovação de chamados (solicitantes)
router.post('/:id/approve', validateParams(paramsSchema), TicketController.approveTicket);
router.post('/:id/reject', validateParams(paramsSchema), TicketController.rejectTicket);

// Rotas apenas para atendentes e administradores
router.use(authorize(UserRole.ATTENDANT, UserRole.ADMIN));

router.put('/:id', validateParams(paramsSchema), validate(updateTicketSchema), TicketController.update);
router.post('/:id/assign', validateParams(paramsSchema), validate(assignTicketSchema), TicketController.assign);
router.post('/:id/claim', validateParams(paramsSchema), TicketController.claimTicket);
router.post('/:id/close', validateParams(paramsSchema), TicketController.close);
router.post('/:id/request-approval', validateParams(paramsSchema), TicketController.requestApproval);
router.get('/open/list', TicketController.getOpenTickets);

// Rotas apenas para administradores
router.use(authorize(UserRole.ADMIN));

router.delete('/:id', validateParams(paramsSchema), TicketController.delete);
router.get('/sla/violations', TicketController.getSlaViolations);

export default router;
