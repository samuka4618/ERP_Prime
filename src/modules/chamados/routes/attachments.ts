import { Router } from 'express';
import { AttachmentController } from '../controllers/AttachmentController';
import { authenticate, authorize } from '../middleware/auth';
import { validateParams } from '../middleware/validation';
import { uploadMultiple } from '../middleware/upload';
import { requirePermission } from '../../../core/permissions/middleware';
import Joi from 'joi';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  attachmentId: Joi.number().integer().positive().required()
});

const ticketParamsSchema = Joi.object({
  ticketId: Joi.number().integer().positive().required()
});

const messageParamsSchema = Joi.object({
  messageId: Joi.number().integer().positive().required()
});

// Upload de anexos
router.post('/upload', requirePermission('tickets.attachments.upload'), uploadMultiple, AttachmentController.upload);

// Obter anexos de um ticket
router.get('/ticket/:ticketId', requirePermission('tickets.attachments.view'), validateParams(ticketParamsSchema), AttachmentController.getByTicket);

// Obter anexos de uma mensagem
router.get('/message/:messageId', requirePermission('tickets.attachments.view'), validateParams(messageParamsSchema), AttachmentController.getByMessage);

// Download de anexo
router.get('/:attachmentId/download', requirePermission('tickets.attachments.view'), validateParams(paramsSchema), AttachmentController.download);

// Estatísticas de anexos de um ticket
router.get('/ticket/:ticketId/stats', requirePermission('tickets.attachments.view'), validateParams(ticketParamsSchema), AttachmentController.getStats);

// Deletar anexo
router.delete('/:attachmentId', requirePermission('tickets.attachments.delete'), validateParams(paramsSchema), AttachmentController.delete);

export default router;
