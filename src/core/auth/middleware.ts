import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../users/User';
import { User, UserRole } from '../../shared/types';
import { config } from '../../config/database';
import { tokenCacheService } from './TokenCacheService';
import { logger } from '../../shared/utils/logger';

// Estender o tipo Request para incluir user
declare global {
  namespace Express {
    interface Request {
      user?: Omit<User, 'password'>;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    logger.debug('Iniciando autenticação', { requestId, ip: req.ip, userAgent: req.get('User-Agent') }, 'AUTH');
    
    let token = (req as any).cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
    if (token && (token === 'cookie' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))) {
      token = undefined;
    }
    if (!token) {
      logger.warn('Tentativa de acesso sem token', { requestId, ip: req.ip }, 'AUTH');
      res.status(401).json({ error: 'Token de acesso necessário' });
      return;
    }
    
    logger.debug('Token recebido', { requestId, tokenPrefix: token.substring(0, 20) + '...' }, 'AUTH');
    
    // Verificar se o token foi invalidado
    if (tokenCacheService.isTokenInvalidated(token)) {
      logger.warn('Token invalidado rejeitado', { requestId, tokenPrefix: token.substring(0, 20) + '...' }, 'AUTH');
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    
    // Tentar obter usuário do cache
    const cachedUser = tokenCacheService.getUserByToken(token);
    if (cachedUser) {
      logger.debug('Usuário encontrado no cache', { requestId, userId: cachedUser.userId, role: cachedUser.userRole }, 'AUTH');
      req.user = {
        id: cachedUser.userId,
        name: cachedUser.userName,
        email: cachedUser.userEmail,
        role: cachedUser.userRole as UserRole,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };
      logger.success('Autenticação via cache bem-sucedida', {
        requestId,
        userId: cachedUser.userId,
        responseTime: Date.now() - startTime
      }, 'AUTH');
      next();
      return;
    }
    
    // Se não estiver no cache, verificar JWT
    logger.debug('Token não encontrado no cache, verificando JWT', { requestId }, 'AUTH');
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: number; role?: string };
    logger.debug('JWT decodificado com sucesso', { requestId, userId: decoded.userId }, 'AUTH');
    
    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.is_active) {
      logger.warn('Usuário não encontrado ou inativo', {
        requestId,
        userId: decoded.userId,
        userExists: !!user,
        isActive: user?.is_active
      }, 'AUTH');
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    
    logger.debug('Usuário encontrado no banco', { requestId, userId: user.id, role: user.role }, 'AUTH');
    
    // Adicionar token ao cache
    tokenCacheService.addActiveToken(token, {
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      userEmail: user.email
    });
    logger.debug('Token adicionado ao cache', { requestId, userId: user.id }, 'AUTH');
    
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    
    logger.success('Autenticação bem-sucedida', {
      requestId,
      userId: user.id,
      role: user.role,
      responseTime: Date.now() - startTime
    }, 'AUTH');
    
    next();
  } catch (error) {
    logger.error('Erro na autenticação', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime: Date.now() - startTime
    }, 'AUTH');
    res.status(401).json({ error: 'Token inválido' });
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = Math.random().toString(36).substring(7);
    
    logger.debug('Iniciando verificação de autorização', {
      requestId,
      userId: req.user?.id,
      userRole: req.user?.role,
      requiredRoles: roles
    }, 'AUTH');
    
    if (!req.user) {
      logger.warn('Tentativa de acesso sem usuário autenticado', { requestId }, 'AUTH');
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      logger.warn('Acesso negado - role insuficiente', {
        requestId,
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles
      }, 'AUTH');
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    
    logger.success('Autorização bem-sucedida', {
      requestId,
      userId: req.user.id,
      userRole: req.user.role
    }, 'AUTH');
    
    next();
  };
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  let token = (req as any).cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
  if (token && (token === 'cookie' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))) {
    token = undefined;
  }
  if (!token) {
    next();
    return;
  }
  
  try {
    if (tokenCacheService.isTokenInvalidated(token)) {
      next();
      return;
    }
    
    const cachedUser = tokenCacheService.getUserByToken(token);
    if (cachedUser) {
      req.user = {
        id: cachedUser.userId,
        name: cachedUser.userName,
        email: cachedUser.userEmail,
        role: cachedUser.userRole as UserRole,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };
      next();
      return;
    }
    
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: number; role?: string };
    const user = await UserModel.findById(decoded.userId);
    
    if (user && user.is_active) {
      const { password, ...userWithoutPassword } = user;
      req.user = userWithoutPassword;
    }
    
    next();
  } catch (error) {
    // Em caso de erro, apenas continua sem autenticação
    next();
  }
};

