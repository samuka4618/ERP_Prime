import { Router } from 'express';
import { AttachmentController } from '../controllers/AttachmentController';
import { authenticate, authorize } from '../middleware/auth';
import { validateParams } from '../middleware/validation';
import { uploadMultiple } from '../middleware/upload';
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

// Upload de anexos (todos os usuários autenticados)
router.post('/upload', uploadMultiple, AttachmentController.upload);

// Obter anexos de um ticket
router.get('/ticket/:ticketId', validateParams(ticketParamsSchema), AttachmentController.getByTicket);

// Obter anexos de uma mensagem
router.get('/message/:messageId', validateParams(messageParamsSchema), AttachmentController.getByMessage);

// Download de anexo
router.get('/:attachmentId/download', validateParams(paramsSchema), AttachmentController.download);

// Estatísticas de anexos de um ticket
router.get('/ticket/:ticketId/stats', validateParams(ticketParamsSchema), AttachmentController.getStats);

// Deletar anexo (apenas o usuário que anexou ou admin)
router.delete('/:attachmentId', validateParams(paramsSchema), AttachmentController.delete);

export default router;
