import { Request, Response } from 'express';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { CardSubscriptionModel } from '../models/CardSubscription';
import { UserModel } from '../../../core/users/User';
import Joi from 'joi';
import { getSubscriptionsRestrictedOwnerId } from '../middleware/subscriptionsAccess';

export class CardSubscriptionController {
  static list = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const status = req.query.status ? String(req.query.status) : undefined;
    const platform = req.query.platform ? String(req.query.platform) : undefined;
    const ownerSearch = req.query.owner ? String(req.query.owner) : undefined;
    const renewalDays = req.query.renewal_within_days
      ? parseInt(String(req.query.renewal_within_days), 10)
      : undefined;

    const restrictOwner = getSubscriptionsRestrictedOwnerId(res);

    const result = await CardSubscriptionModel.findAll({
      page,
      limit,
      subscriptionStatus: status,
      platform,
      ownerSearch:
        restrictOwner != null ? undefined : ownerSearch?.trim() ? ownerSearch.trim() : undefined,
      renewalWithinDays: Number.isFinite(renewalDays as number) ? renewalDays : undefined,
      restrictOwnerUserId: restrictOwner
    });
    res.json({ message: 'Assinaturas', data: result });
  });

  static summary = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const restrictOwner = getSubscriptionsRestrictedOwnerId(res);
    const summary = await CardSubscriptionModel.sumActiveMonthlyEquivalent(restrictOwner);
    res.json({ message: 'Resumo', data: summary });
  });
  static renewals = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const days = Math.min(365, Math.max(1, parseInt(String(req.query.days || '30'), 10) || 30));
    const restrictOwner = getSubscriptionsRestrictedOwnerId(res);
    const list = await CardSubscriptionModel.listRenewalsWithinDays(days, restrictOwner);
    res.json({ message: 'Renovações no período', data: { days, subscriptions: list } });
  });

  static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const restrictOwner = getSubscriptionsRestrictedOwnerId(res);
    const sub = await CardSubscriptionModel.findById(id);
    if (!sub || (restrictOwner != null && sub.owner_user_id !== restrictOwner)) {
      res.status(404).json({ error: 'Assinatura não encontrada' });
      return;
    }
    res.json({ message: 'Assinatura', data: { subscription: sub } });
  });

  static reveal = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const schema = Joi.object({
      currentPassword: Joi.string().min(1).required()
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Informe a senha atual do ERP (currentPassword)' });
      return;
    }
    const id = parseInt(req.params.id, 10);
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }
    const ok = await UserModel.verifyPassword(user, value.currentPassword);
    if (!ok) {
      res.status(401).json({ error: 'Senha incorreta' });
      return;
    }
    const plain = await CardSubscriptionModel.revealPassword(id, userId, req);
    res.json({ message: 'Credencial revelada (registro de auditoria criado)', data: { password: plain } });
  });

  static cancel = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const schema = Joi.object({
      reason: Joi.string().min(3).max(2000).required()
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Informe o motivo do cancelamento' });
      return;
    }
    const id = parseInt(req.params.id, 10);
    const sub = await CardSubscriptionModel.cancel(id, value.reason);
    if (!sub) {
      res.status(404).json({ error: 'Assinatura não encontrada' });
      return;
    }
    res.json({ message: 'Assinatura cancelada', data: { subscription: sub } });
  });
}
