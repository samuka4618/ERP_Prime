import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { User, UserRole } from '../types';
import { config } from '../config/database';
import { tokenCacheService } from '../services/TokenCacheService';
import { logger } from '../utils/logger';

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
    
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Tentativa de acesso sem token', { requestId, ip: req.ip }, 'AUTH');
      res.status(401).json({ error: 'Token de acesso necessário' });
      return;
    }

    logger.debug('Token recebido', { requestId, tokenPrefix: token.substring(0, 20) + '...' }, 'AUTH');

    // Primeiro verificar se o token foi invalidado
    if (tokenCacheService.isTokenInvalidated(token)) {
      logger.warn('Token invalidado rejeitado', { requestId, tokenPrefix: token.substring(0, 20) + '...' }, 'AUTH');
      res.status(401).json({ error: 'Token inválido' });
      return;
    }

    // Verificar se token está no cache (usuário online)
    const cachedUser = tokenCacheService.getUserByToken(token);
    
    if (cachedUser) {
      logger.debug('Usuário encontrado no cache', { requestId, userId: cachedUser.userId, role: cachedUser.userRole }, 'AUTH');
      
      // Token está no cache e ativo - usuário online
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

    logger.debug('Token não encontrado no cache, verificando JWT', { requestId }, 'AUTH');

    // Token não está no cache - verificar se é válido
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

    // Adicionar token ao cache (usuário ficou online)
    tokenCacheService.addActiveToken(token, {
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      userEmail: user.email
    });

    logger.debug('Token adicionado ao cache', { requestId, userId: user.id }, 'AUTH');

    // Remover senha do objeto user
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
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: number };
      const user = await UserModel.findById(decoded.userId);

      if (user && user.is_active) {
        const { password, ...userWithoutPassword } = user;
        req.user = userWithoutPassword;
      }
    }

    next();
  } catch (error) {
    // Se houver erro no token, continua sem usuário autenticado
    next();
  }
};

// Middleware para exigir role específico (alias para authorize)
export const requireRole = (...roles: UserRole[]) => {
  return authorize(...roles);
};

// Middleware de autenticação básica (alias para authenticate)
export const authMiddleware = authenticate;