import { Request, Response, NextFunction } from 'express';
import { PermissionModel } from '../../../core/permissions/PermissionModel';
import { UserRole } from '../../../shared/types';
import { CardSubscriptionModel } from '../models/CardSubscription';

const VIEW = 'chamados.subscriptions.view';
const SELF = 'chamados.subscriptions.self';
const REVEAL = 'chamados.subscriptions.reveal_password';

export function getSubscriptionsRestrictedOwnerId(res: Response): number | undefined {
  const v = res.locals.subscriptionsRestrictedOwnerId;
  return typeof v === 'number' ? v : undefined;
}

/**
 * Administrador ou quem tem `subscriptions.view`: catálogo completo (sem escopo por dono).
 * Quem tem apenas `subscriptions.self`: `res.locals.subscriptionsRestrictedOwnerId = req.user.id`.
 */
export const subscriptionsCatalogOrSelfGate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Usuário não autenticado' });
    return;
  }
  delete res.locals.subscriptionsRestrictedOwnerId;

  if (req.user.role === UserRole.ADMIN) {
    next();
    return;
  }

  try {
    const hasView = await PermissionModel.hasPermission(req.user.id, req.user.role, VIEW);
    if (hasView) {
      next();
      return;
    }
    const hasSelf = await PermissionModel.hasPermission(req.user.id, req.user.role, SELF);
    if (hasSelf) {
      res.locals.subscriptionsRestrictedOwnerId = req.user.id;
      next();
      return;
    }

    res.status(403).json({ error: 'Acesso negado', requiredPermissions: [VIEW, SELF] });
  } catch {
    res.status(500).json({ error: 'Erro ao verificar permissão de assinaturas' });
  }
};

/**
 * Operadores com `reveal_password`: revelam qualquer assinatura (auditado).
 * Solicitantes com apenas `subscriptions.self`: revelam só quando são o dono do registro.
 */
export const subscriptionsRevealGate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Usuário não autenticado' });
    return;
  }

  const id = parseInt(String(req.params.id), 10);

  if (req.user.role === UserRole.ADMIN) {
    next();
    return;
  }

  try {
    const hasReveal = await PermissionModel.hasPermission(req.user.id, req.user.role, REVEAL);
    if (hasReveal) {
      next();
      return;
    }

    const hasSelf = await PermissionModel.hasPermission(req.user.id, req.user.role, SELF);
    if (!hasSelf) {
      res.status(403).json({ error: 'Acesso negado', requiredPermission: REVEAL });
      return;
    }

    if (!Number.isFinite(id) || id < 1) {
      next();
      return;
    }

    const ownerId = await CardSubscriptionModel.getOwnerUserId(id);
    if (ownerId == null) {
      next();
      return;
    }

    if (ownerId !== req.user.id) {
      res.status(403).json({ error: 'Só pode revelar credencial das suas próprias assinaturas.' });
      return;
    }

    next();
  } catch {
    res.status(500).json({ error: 'Erro ao verificar permissão' });
  }
};
