import { Request, Response, NextFunction } from 'express';
import { PermissionModel } from './PermissionModel';
import { logger } from '../../shared/utils/logger';

/**
 * Middleware para verificar se o usuário tem uma permissão específica
 * @param permissionCode Código da permissão a ser verificada
 */
export const requirePermission = (permissionCode: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      if (!req.user) {
        logger.warn('Tentativa de acesso sem usuário autenticado', { requestId, permissionCode }, 'PERMISSIONS');
        res.status(401).json({ error: 'Usuário não autenticado' });
        return;
      }

      logger.debug('Verificando permissão', {
        requestId,
        userId: req.user.id,
        userRole: req.user.role,
        permissionCode
      }, 'PERMISSIONS');

      const hasPermission = await PermissionModel.hasPermission(
        req.user.id,
        req.user.role,
        permissionCode
      );

      if (!hasPermission) {
        logger.warn('Acesso negado - permissão insuficiente', {
          requestId,
          userId: req.user.id,
          userRole: req.user.role,
          permissionCode
        }, 'PERMISSIONS');
        res.status(403).json({ 
          error: 'Acesso negado',
          requiredPermission: permissionCode
        });
        return;
      }

      logger.success('Permissão verificada com sucesso', {
        requestId,
        userId: req.user.id,
        permissionCode
      }, 'PERMISSIONS');

      next();
    } catch (error: any) {
      logger.error('Erro ao verificar permissão', {
        requestId,
        error: error.message,
        permissionCode
      }, 'PERMISSIONS');
      res.status(500).json({ error: 'Erro ao verificar permissão' });
    }
  };
};

/**
 * Middleware para verificar múltiplas permissões (OR - pelo menos uma)
 * @param permissionCodes Array de códigos de permissão
 */
export const requireAnyPermission = (...permissionCodes: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      if (!req.user) {
        logger.warn('Tentativa de acesso sem usuário autenticado', { requestId, permissionCodes }, 'PERMISSIONS');
        res.status(401).json({ error: 'Usuário não autenticado' });
        return;
      }

      logger.debug('Verificando múltiplas permissões (OR)', {
        requestId,
        userId: req.user.id,
        userRole: req.user.role,
        permissionCodes
      }, 'PERMISSIONS');

      // Verificar se o usuário tem pelo menos uma das permissões
      for (const permissionCode of permissionCodes) {
        const hasPermission = await PermissionModel.hasPermission(
          req.user.id,
          req.user.role,
          permissionCode
        );

        if (hasPermission) {
          logger.success('Permissão verificada com sucesso (OR)', {
            requestId,
            userId: req.user.id,
            permissionCode
          }, 'PERMISSIONS');
          next();
          return;
        }
      }

      logger.warn('Acesso negado - nenhuma permissão suficiente', {
        requestId,
        userId: req.user.id,
        userRole: req.user.role,
        permissionCodes
      }, 'PERMISSIONS');
      res.status(403).json({ 
        error: 'Acesso negado',
        requiredPermissions: permissionCodes
      });
    } catch (error: any) {
      logger.error('Erro ao verificar permissões', {
        requestId,
        error: error.message,
        permissionCodes
      }, 'PERMISSIONS');
      res.status(500).json({ error: 'Erro ao verificar permissões' });
    }
  };
};

/**
 * Middleware para verificar múltiplas permissões (AND - todas)
 * @param permissionCodes Array de códigos de permissão
 */
export const requireAllPermissions = (...permissionCodes: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      if (!req.user) {
        logger.warn('Tentativa de acesso sem usuário autenticado', { requestId, permissionCodes }, 'PERMISSIONS');
        res.status(401).json({ error: 'Usuário não autenticado' });
        return;
      }

      logger.debug('Verificando múltiplas permissões (AND)', {
        requestId,
        userId: req.user.id,
        userRole: req.user.role,
        permissionCodes
      }, 'PERMISSIONS');

      // Verificar se o usuário tem todas as permissões
      for (const permissionCode of permissionCodes) {
        const hasPermission = await PermissionModel.hasPermission(
          req.user.id,
          req.user.role,
          permissionCode
        );

        if (!hasPermission) {
          logger.warn('Acesso negado - permissão insuficiente (AND)', {
            requestId,
            userId: req.user.id,
            userRole: req.user.role,
            missingPermission: permissionCode
          }, 'PERMISSIONS');
          res.status(403).json({ 
            error: 'Acesso negado',
            requiredPermissions: permissionCodes,
            missingPermission: permissionCode
          });
          return;
        }
      }

      logger.success('Todas as permissões verificadas com sucesso (AND)', {
        requestId,
        userId: req.user.id,
        permissionCodes
      }, 'PERMISSIONS');

      next();
    } catch (error: any) {
      logger.error('Erro ao verificar permissões', {
        requestId,
        error: error.message,
        permissionCodes
      }, 'PERMISSIONS');
      res.status(500).json({ error: 'Erro ao verificar permissões' });
    }
  };
};

