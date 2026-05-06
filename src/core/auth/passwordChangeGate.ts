import type { Request, Response, NextFunction } from 'express';
import { UserModel } from '../users/User';
import { SystemConfigModel } from '../system/SystemConfig';
import { computePasswordChangeRequirement } from './passwordPolicy';

/** Rotas autenticadas que podem ser usadas antes de resolver troca de senha obrigatória. */
const BYPASS_EXACT = new Set([
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/change-password',
  '/api/auth/profile'
]);

const BYPASS_PREFIXES = ['/api/auth/me/preferences'];

export function shouldBypassPasswordChangeGate(req: Request): boolean {
  const fullPath = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+$/, '') || '';
  if (BYPASS_EXACT.has(fullPath)) {
    return true;
  }
  return BYPASS_PREFIXES.some((p) => fullPath === p || fullPath.startsWith(`${p}/`));
}

/**
 * Bloqueia chamadas autenticadas se a política global ou a flag do utilizador exigirem troca de senha.
 */
export async function enforcePasswordChangeGate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user?.id) {
      next();
      return;
    }
    if (shouldBypassPasswordChangeGate(req)) {
      next();
      return;
    }
    const row = await UserModel.getPasswordPolicyColumns(req.user.id);
    if (!row) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    const sys = await SystemConfigModel.getSystemConfig();
    const { requiresPasswordChange } = computePasswordChangeRequirement(
      {
        must_change_password: row.must_change_password,
        password_changed_at: row.password_changed_at
      },
      sys
    );
    if (requiresPasswordChange) {
      res.status(403).json({
        error: 'É necessário alterar a senha antes de continuar.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
      return;
    }
    next();
  } catch (err) {
    next(err as Error);
  }
}
