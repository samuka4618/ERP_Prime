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

export const sseAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    logger.debug('Iniciando autenticação SSE', { requestId, ip: req.ip, userAgent: req.get('User-Agent') }, 'SSE_AUTH');
    
    // Para SSE, o token vem via query parameter
    const token = req.query.token as string;

    if (!token) {
      logger.warn('Tentativa de acesso SSE sem token', { requestId, ip: req.ip }, 'SSE_AUTH');
      res.status(401).json({ error: 'Token de acesso necessário' });
      return;
    }

    logger.debug('Token SSE recebido', { requestId, tokenPrefix: token.substring(0, 20) + '...' }, 'SSE_AUTH');

    // Primeiro verificar se o token foi invalidado
    if (tokenCacheService.isTokenInvalidated(token)) {
      logger.warn('Token SSE invalidado rejeitado', { requestId, tokenPrefix: token.substring(0, 20) + '...' }, 'SSE_AUTH');
      res.status(401).json({ error: 'Token inválido' });
      return;
    }

    // Verificar se token está no cache (usuário online)
    const cachedUser = tokenCacheService.getUserByToken(token);
    
    if (cachedUser) {
      logger.debug('Usuário SSE encontrado no cache', { requestId, userId: cachedUser.userId, role: cachedUser.userRole }, 'SSE_AUTH');
      
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
      
      logger.success('Autenticação SSE via cache bem-sucedida', { 
        requestId, 
        userId: cachedUser.userId, 
        responseTime: Date.now() - startTime 
      }, 'SSE_AUTH');
      
      next();
      return;
    }

    logger.debug('Token SSE não encontrado no cache, verificando JWT', { requestId }, 'SSE_AUTH');

    // Token não está no cache - verificar se é válido
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: number; role?: string };
    logger.debug('JWT SSE decodificado com sucesso', { requestId, userId: decoded.userId }, 'SSE_AUTH');
    
    const user = await UserModel.findById(decoded.userId);

    if (!user || !user.is_active) {
      logger.warn('Usuário SSE não encontrado ou inativo', { 
        requestId, 
        userId: decoded.userId, 
        userExists: !!user, 
        isActive: user?.is_active 
      }, 'SSE_AUTH');
      res.status(401).json({ error: 'Token inválido' });
      return;
    }

    logger.debug('Usuário SSE encontrado no banco', { requestId, userId: user.id, role: user.role }, 'SSE_AUTH');

    // Adicionar token ao cache (usuário ficou online)
    tokenCacheService.addActiveToken(token, {
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      userEmail: user.email
    });

    logger.debug('Token SSE adicionado ao cache', { requestId, userId: user.id }, 'SSE_AUTH');

    // Remover senha do objeto user
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    
    logger.success('Autenticação SSE bem-sucedida', { 
      requestId, 
      userId: user.id, 
      role: user.role, 
      responseTime: Date.now() - startTime 
    }, 'SSE_AUTH');
    
    next();
  } catch (error) {
    logger.error('Erro na autenticação SSE', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime: Date.now() - startTime
    }, 'SSE_AUTH');
    res.status(401).json({ error: 'Token inválido' });
  }
};
