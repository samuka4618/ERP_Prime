/**
 * Entrega de ficheiros em storage com autenticação e autorização por tipo de recurso.
 * Substitui express.static aberto para /storage/* e aliases (/imgCadastros, /uploads).
 */
import path from 'path';
import fs from 'fs';
import type { Express, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../core/auth/middleware';
import { UserModel } from '../../core/users/User';
import { PermissionModel } from '../../core/permissions/PermissionModel';
import { dbGet } from '../../core/database/connection';
import { logger } from '../utils/logger';
import { User, UserRole } from '../types';

function normalizeFsPath(p: string): string {
  return path.normalize(p).replace(/\\/g, '/');
}

function safeJoinUnderRoot(rootDir: string, unsafeRel: string): string | null {
  const decoded = decodeURIComponent((unsafeRel || '').split('?')[0] || '');
  const trimmed = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(rootDir, trimmed || '.');
  const root = path.resolve(rootDir);
  if (!candidate.startsWith(root)) {
    return null;
  }
  return candidate;
}

function canAccessTicketRow(user: Omit<User, 'password'>, ticket: { user_id: number; attendant_id: number | null }): boolean {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.USER) return ticket.user_id === user.id;
  if (user.role === UserRole.ATTENDANT) {
    return ticket.attendant_id === null || ticket.attendant_id === user.id;
  }
  return false;
}

async function canServeUploadFile(user: Omit<User, 'password'>, absolutePath: string): Promise<boolean> {
  const normFile = normalizeFsPath(absolutePath);
  const basename = path.basename(normFile);

  const row = await dbGet(
    `SELECT t.user_id, t.attendant_id
     FROM attachments a
     JOIN tickets t ON t.id = a.ticket_id
     WHERE a.file_name = ? OR REPLACE(a.file_path, '\\', '/') LIKE ?`,
    [basename, `%/${basename}`]
  ) as { user_id: number; attendant_id: number | null } | undefined;

  if (row) {
    if (!canAccessTicketRow(user, row)) return false;
    return PermissionModel.hasPermission(user.id, user.role, 'tickets.attachments.view');
  }

  const legacy = await dbGet(
    `SELECT t.user_id, t.attendant_id
     FROM ticket_attachments ta
     JOIN tickets t ON t.id = ta.ticket_id
     WHERE ta.filename = ? OR REPLACE(ta.path, '\\', '/') LIKE ?`,
    [basename, `%${basename}`]
  ) as { user_id: number; attendant_id: number | null } | undefined;

  if (legacy) {
    if (!canAccessTicketRow(user, legacy)) return false;
    return PermissionModel.hasPermission(user.id, user.role, 'tickets.attachments.view');
  }

  const anexo = await dbGet(
    `SELECT solicitacao_id, orcamento_id FROM compras_anexos
     WHERE nome_arquivo = ? OR REPLACE(caminho, '\\', '/') LIKE ? OR REPLACE(caminho, '\\', '/') = ?`,
    [basename, `%${basename}`, normalizeFsPath(`storage/uploads/${basename}`)]
  ) as { solicitacao_id: number | null; orcamento_id: number | null } | undefined;

  if (anexo) {
    if (anexo.solicitacao_id) {
      return PermissionModel.hasPermission(user.id, user.role, 'compras.solicitacoes.view');
    }
    if (anexo.orcamento_id) {
      return PermissionModel.hasPermission(user.id, user.role, 'compras.orcamentos.view');
    }
    return (
      (await PermissionModel.hasPermission(user.id, user.role, 'compras.solicitacoes.view')) ||
      (await PermissionModel.hasPermission(user.id, user.role, 'compras.orcamentos.view'))
    );
  }

  const rep = await dbGet(
    `SELECT executed_by FROM report_executions
     WHERE file_path IS NOT NULL AND (REPLACE(file_path, '\\', '/') LIKE ? OR REPLACE(file_path, '\\', '/') = ?)`,
    [`%${basename}`, normFile.replace(/\\/g, '/')]
  ) as { executed_by: number } | undefined;

  if (rep) {
    const canExport =
      (await PermissionModel.hasPermission(user.id, user.role, 'reports.export')) ||
      (await PermissionModel.hasPermission(user.id, user.role, 'reports.execute'));
    if (!canExport) return false;
    return user.role === UserRole.ADMIN || rep.executed_by === user.id;
  }

  logger.warn('Ficheiro em uploads sem referência na BD — acesso negado', { basename }, 'SECURE_STORAGE');
  return false;
}

async function canServeAvatar(user: Omit<User, 'password'>, absolutePath: string): Promise<boolean> {
  const basename = path.basename(absolutePath);
  const full = await UserModel.findById(user.id);
  const myAvatar = full?.avatar ? path.basename(full.avatar.replace(/\\/g, '/')) : null;
  if (myAvatar && myAvatar === basename) return true;
  if (user.role === UserRole.ADMIN) return true;
  return PermissionModel.hasPermission(user.id, user.role, 'users.view');
}

function sendFileOr404(res: Response, absolutePath: string): void {
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    res.status(404).json({ error: 'Ficheiro não encontrado' });
    return;
  }
  res.sendFile(absolutePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'Ficheiro não encontrado' });
    }
  });
}

function createStorageHandler(
  kind: 'images' | 'uploads' | 'avatars',
  rootParts: string[]
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Token de acesso necessário' });
        return;
      }

      const rel = (req.url.split('?')[0] || '/').replace(/^\//, '');
      const rootDir = path.join(process.cwd(), ...rootParts);
      const abs = safeJoinUnderRoot(rootDir, rel);

      if (!abs) {
        res.status(403).json({ error: 'Caminho inválido' });
        return;
      }

      if (kind === 'images') {
        const ok = await PermissionModel.hasPermission(req.user.id, req.user.role, 'registrations.view');
        if (!ok) {
          res.status(403).json({ error: 'Acesso negado', requiredPermission: 'registrations.view' });
          return;
        }
        sendFileOr404(res, abs);
        return;
      }

      if (kind === 'avatars') {
        const ok = await canServeAvatar(req.user, abs);
        if (!ok) {
          res.status(403).json({ error: 'Acesso negado' });
          return;
        }
        sendFileOr404(res, abs);
        return;
      }

      const ok = await canServeUploadFile(req.user, abs);
      if (!ok) {
        res.status(403).json({ error: 'Acesso negado' });
        return;
      }
      sendFileOr404(res, abs);
    } catch (e) {
      logger.error('Erro no secure storage', { err: (e as Error).message }, 'SECURE_STORAGE');
      next(e);
    }
  };
}

/**
 * Monta rotas protegidas para ficheiros estáticos sensíveis.
 */
export function mountSecureStorage(app: Express): void {
  const imagesStack = [authenticate, createStorageHandler('images', ['storage', 'images'])];
  const uploadsStack = [authenticate, createStorageHandler('uploads', ['storage', 'uploads'])];
  const avatarsStack = [authenticate, createStorageHandler('avatars', ['storage', 'avatars'])];

  app.use('/storage/images', ...imagesStack);
  app.use('/imgCadastros', ...imagesStack);
  app.use('/storage/uploads', ...uploadsStack);
  app.use('/uploads', ...uploadsStack);
  app.use('/storage/avatars', ...avatarsStack);
}
