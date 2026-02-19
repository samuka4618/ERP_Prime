import { Request, Response } from 'express';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { NotificationModel } from '../models/Notification';
import { dbRun, dbGet, dbAll } from '../../../core/database/connection';

export class NotificationController {
  static getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const notifications = await NotificationModel.findByUser(userId, { page, limit });
    const total = await NotificationModel.countByUser(userId);

    res.json({
      message: 'Notificações obtidas com sucesso',
      data: {
        data: notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  });

  static markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const notificationId = parseInt(id);

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    if (isNaN(notificationId)) {
      res.status(400).json({ error: 'ID de notificação inválido' });
      return;
    }

    await NotificationModel.markAsRead(notificationId, userId);

    res.json({
      message: 'Notificação marcada como lida',
      data: { success: true }
    });
  });

  static markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    await NotificationModel.markAllAsRead(userId);

    res.json({
      message: 'Todas as notificações foram marcadas como lidas',
      data: { success: true }
    });
  });

  static getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const count = await NotificationModel.getUnreadCount(userId);

    res.json({
      message: 'Contagem de notificações não lidas obtida com sucesso',
      data: { count }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const notificationId = parseInt(id);

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    if (isNaN(notificationId)) {
      res.status(400).json({ error: 'ID de notificação inválido' });
      return;
    }

    // Verificar se a notificação pertence ao usuário
    const notification = await NotificationModel.findById(notificationId);
    if (!notification) {
      res.status(404).json({ error: 'Notificação não encontrada' });
      return;
    }

    if (notification.user_id !== userId) {
      res.status(403).json({ error: 'Acesso negado - você só pode excluir suas próprias notificações' });
      return;
    }

    await NotificationModel.delete(notificationId);

    res.json({
      message: 'Notificação excluída com sucesso',
      data: { success: true }
    });
  });

  static registerDevice = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { push_token, platform } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    if (!push_token) {
      res.status(400).json({ error: 'Token de push é obrigatório' });
      return;
    }

    try {
      // Verificar se já existe um token para este usuário e dispositivo
      const existing = await dbGet(
        'SELECT id FROM device_push_tokens WHERE user_id = ? AND push_token = ?',
        [userId, push_token]
      ) as any;

      if (existing) {
        // Atualizar data de atualização
        await dbRun(
          'UPDATE device_push_tokens SET updated_at = CURRENT_TIMESTAMP, platform = ? WHERE id = ?',
          [platform || 'unknown', existing.id]
        );
        res.json({
          message: 'Token de dispositivo atualizado',
          data: { success: true }
        });
        return;
      }

      // Criar novo registro
      await dbRun(
        'INSERT INTO device_push_tokens (user_id, push_token, platform) VALUES (?, ?, ?)',
        [userId, push_token, platform || 'unknown']
      );

      res.json({
        message: 'Token de dispositivo registrado com sucesso',
        data: { success: true }
      });
    } catch (error: any) {
      console.error('Erro ao registrar token de dispositivo:', error);
      res.status(500).json({ error: 'Erro ao registrar token de dispositivo' });
    }
  });

  static unregisterDevice = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { push_token } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    if (!push_token) {
      res.status(400).json({ error: 'Token de push é obrigatório' });
      return;
    }

    try {
      await dbRun(
        'DELETE FROM device_push_tokens WHERE user_id = ? AND push_token = ?',
        [userId, push_token]
      );

      res.json({
        message: 'Token de dispositivo removido com sucesso',
        data: { success: true }
      });
    } catch (error: any) {
      console.error('Erro ao remover token de dispositivo:', error);
      res.status(500).json({ error: 'Erro ao remover token de dispositivo' });
    }
  });
}
