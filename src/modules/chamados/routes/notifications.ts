import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authenticate } from '../middleware/auth';
import { validateParams } from '../middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import Joi from 'joi';

const router = Router();

// Todas as rotas de notificações requerem autenticação
router.use(authenticate);

// Schema de validação para parâmetros
const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// GET /api/notifications - Listar notificações do usuário
router.get('/', requirePermission('notifications.view'), NotificationController.getNotifications);

// GET /api/notifications/unread-count - Contar notificações não lidas
router.get('/unread-count', requirePermission('notifications.view'), NotificationController.getUnreadCount);

// PUT /api/notifications/:id/read - Marcar notificação como lida
router.put('/:id/read', requirePermission('notifications.manage'), validateParams(paramsSchema), NotificationController.markAsRead);

// PUT /api/notifications/mark-all-read - Marcar todas como lidas
router.put('/mark-all-read', requirePermission('notifications.manage'), NotificationController.markAllAsRead);

// DELETE /api/notifications/:id - Excluir notificação
router.delete('/:id', requirePermission('notifications.manage'), validateParams(paramsSchema), NotificationController.delete);

// POST /api/notifications/register-device - Registrar token de push do dispositivo
router.post('/register-device', NotificationController.registerDevice);

// POST /api/notifications/unregister-device - Remover token de push do dispositivo
router.post('/unregister-device', NotificationController.unregisterDevice);

export default router;
