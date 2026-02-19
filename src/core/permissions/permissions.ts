import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../auth/middleware';
import { PermissionModel } from './PermissionModel';
import { UserModel } from '../users/User';
import { UserRole } from '../../shared/types';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * GET /api/permissions
 * Listar todas as permissões (apenas admin)
 */
router.get('/', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const permissions = await PermissionModel.findAll();
    res.json({ data: permissions });
  } catch (error: any) {
    logger.error('Erro ao listar permissões', { error: error.message }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao listar permissões' });
  }
});

/**
 * GET /api/permissions/modules
 * Listar permissões agrupadas por módulo
 */
router.get('/modules', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const permissions = await PermissionModel.findAll();
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {} as Record<string, typeof permissions>);
    res.json({ data: grouped });
  } catch (error: any) {
    logger.error('Erro ao listar permissões por módulo', { error: error.message }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao listar permissões' });
  }
});

/**
 * GET /api/permissions/role/:role
 * Listar permissões de um role
 */
router.get('/role/:role', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const { role } = req.params;
    if (!Object.values(UserRole).includes(role as UserRole)) {
      res.status(400).json({ error: 'Role inválido' });
      return;
    }

    const rolePermissions = await PermissionModel.findByRole(role as 'user' | 'attendant' | 'admin');
    const allPermissions = await PermissionModel.findAll();

    // Combinar todas as permissões com status de granted
    const permissionsWithStatus = allPermissions.map(perm => {
      const rolePerm = rolePermissions.find(rp => rp.permission_id === perm.id);
      const granted = rolePerm ? Boolean(rolePerm.granted) : false;
      return {
        ...perm,
        granted
      };
    });

    res.json({ data: permissionsWithStatus });
  } catch (error: any) {
    logger.error('Erro ao listar permissões do role', { error: error.message }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao listar permissões do role' });
  }
});

/**
 * GET /api/permissions/user/:userId
 * Listar permissões de um usuário
 */
router.get('/user/:userId', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'ID de usuário inválido' });
      return;
    }

    // Buscar usuário para obter o role
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    // Converter role para string se necessário
    const userRole = typeof user.role === 'string' ? user.role : String(user.role);
    
    const permissions = await PermissionModel.findByUser(userId, userRole);
    res.json({ data: permissions });
  } catch (error: any) {
    logger.error('Erro ao listar permissões do usuário', { 
      error: error.message, 
      stack: error.stack,
      userId: req.params.userId 
    }, 'PERMISSIONS');
    res.status(500).json({ 
      error: 'Erro ao listar permissões do usuário',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/permissions/me
 * Listar minhas próprias permissões
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    // Converter role para string se necessário
    const userRole = typeof req.user.role === 'string' ? req.user.role : String(req.user.role);
    
    const permissions = await PermissionModel.findByUser(req.user.id, userRole);
    res.json({ data: permissions });
  } catch (error: any) {
    logger.error('Erro ao listar minhas permissões', { error: error.message, stack: error.stack }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao listar permissões' });
  }
});

/**
 * POST /api/permissions/check
 * Verificar se usuário tem permissão específica
 */
router.post('/check', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const { permissionCode } = req.body;
    if (!permissionCode) {
      res.status(400).json({ error: 'Código de permissão não fornecido' });
      return;
    }

    const hasPermission = await PermissionModel.hasPermission(
      req.user.id,
      req.user.role,
      permissionCode
    );

    res.json({ data: { hasPermission } });
  } catch (error: any) {
    logger.error('Erro ao verificar permissão', { error: error.message }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao verificar permissão' });
  }
});

/**
 * PUT /api/permissions/role/:role
 * Atualizar permissões de um role
 */
router.put('/role/:role', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const { role } = req.params;
    if (!Object.values(UserRole).includes(role as UserRole)) {
      res.status(400).json({ error: 'Role inválido' });
      return;
    }

    const { permissions } = req.body; // Array de { permissionId, granted }
    if (!Array.isArray(permissions)) {
      res.status(400).json({ error: 'Formato inválido. Esperado array de permissões' });
      return;
    }

    // Atualizar cada permissão
    for (const perm of permissions) {
      if (perm.permissionId && typeof perm.granted === 'boolean') {
        await PermissionModel.updateRolePermission(
          role,
          perm.permissionId,
          perm.granted
        );
      }
    }

    logger.info('Permissões do role atualizadas', { role, count: permissions.length }, 'PERMISSIONS');
    res.json({ message: 'Permissões atualizadas com sucesso' });
    return;
  } catch (error: any) {
    logger.error('Erro ao atualizar permissões do role', { error: error.message }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao atualizar permissões' });
    return;
  }
});

/**
 * PUT /api/permissions/user/:userId
 * Atualizar permissões de um usuário
 */
router.put('/user/:userId', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID de usuário inválido' });
    }

    const { permissions } = req.body; // Array de { permissionId, granted } ou null para remover
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Formato inválido. Esperado array de permissões' });
    }

    // Atualizar cada permissão
    for (const perm of permissions) {
      if (perm.permissionId) {
        if (perm.granted === null || perm.granted === undefined) {
          // Remover permissão individual (volta para o padrão do role)
          logger.info('Removendo permissão individual', { 
            userId, 
            permissionId: perm.permissionId,
            granted: perm.granted,
            grantedType: typeof perm.granted
          }, 'PERMISSIONS');
          await PermissionModel.removeUserPermission(userId, perm.permissionId);
          logger.info('Permissão individual removida com sucesso', { userId, permissionId: perm.permissionId }, 'PERMISSIONS');
        } else {
          // Atualizar ou criar permissão individual
          logger.debug('Atualizando permissão individual', { 
            userId, 
            permissionId: perm.permissionId, 
            granted: perm.granted 
          }, 'PERMISSIONS');
          await PermissionModel.updateUserPermission(
            userId,
            perm.permissionId,
            Boolean(perm.granted) // Garantir que é boolean
          );
        }
      }
    }

    logger.info('Permissões do usuário atualizadas', { 
      userId, 
      count: permissions.length,
      permissions: permissions.map(p => ({ 
        permissionId: p.permissionId, 
        granted: p.granted,
        grantedType: typeof p.granted,
        isNull: p.granted === null,
        isUndefined: p.granted === undefined
      }))
    }, 'PERMISSIONS');
    res.json({ message: 'Permissões atualizadas com sucesso' });
    return;
  } catch (error: any) {
    logger.error('Erro ao atualizar permissões do usuário', { error: error.message }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao atualizar permissões' });
    return;
  }
});

/**
 * POST /api/permissions
 * Criar nova permissão (apenas admin)
 */
router.post('/', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const { name, code, module, description } = req.body;

    if (!name || !code || !module) {
      return res.status(400).json({ error: 'Nome, código e módulo são obrigatórios' });
    }

    const permission = await PermissionModel.create({
      name,
      code,
      module,
      description
    });

    logger.info('Nova permissão criada', { permissionId: permission.id, code }, 'PERMISSIONS');
    res.status(201).json({ data: permission });
    return;
  } catch (error: any) {
    if (error.message.includes('UNIQUE constraint')) {
      res.status(409).json({ error: 'Permissão com este código já existe' });
      return;
    }
    logger.error('Erro ao criar permissão', { error: error.message }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao criar permissão' });
    return;
  }
});

/**
 * PUT /api/permissions/:id
 * Atualizar permissão (apenas admin)
 */
router.put('/:id', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { name, code, module, description } = req.body;
    const updates: any = {};

    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (module !== undefined) updates.module = module;
    if (description !== undefined) updates.description = description;

    const permission = await PermissionModel.update(id, updates);
    res.json({ data: permission });
    return;
  } catch (error: any) {
    logger.error('Erro ao atualizar permissão', { error: error.message }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao atualizar permissão' });
    return;
  }
});

/**
 * DELETE /api/permissions/:id
 * Excluir permissão (apenas admin)
 */
router.delete('/:id', authenticate, authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    await PermissionModel.delete(id);
    logger.info('Permissão excluída', { permissionId: id }, 'PERMISSIONS');
    res.json({ message: 'Permissão excluída com sucesso' });
    return;
  } catch (error: any) {
    logger.error('Erro ao excluir permissão', { error: error.message }, 'PERMISSIONS');
    res.status(500).json({ error: 'Erro ao excluir permissão' });
    return;
  }
});

export default router;

