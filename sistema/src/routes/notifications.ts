import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authenticate } from '../middleware/auth';
import { validateParams } from '../middleware/validation';
import Joi from 'joi';

const router = Router();

// Todas as rotas de notificações requerem autenticação
router.use(authenticate);

// Schema de validação para parâmetros
const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// GET /api/notifications - Listar notificações do usuário
router.get('/', NotificationController.getNotifications);

// GET /api/notifications/unread-count - Contar notificações não lidas
router.get('/unread-count', NotificationController.getUnreadCount);

// PUT /api/notifications/:id/read - Marcar notificação como lida
router.put('/:id/read', validateParams(paramsSchema), NotificationController.markAsRead);

// PUT /api/notifications/mark-all-read - Marcar todas como lidas
router.put('/mark-all-read', NotificationController.markAllAsRead);

// DELETE /api/notifications/:id - Excluir notificação
router.delete('/:id', validateParams(paramsSchema), NotificationController.delete);

export default router;
