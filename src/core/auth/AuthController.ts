import { Request, Response } from 'express';
import { AuthService } from './AuthService';
import { UserModel } from '../users/User';
import { LoginRequest, CreateUserRequest } from '../../shared/types';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { tokenCacheService } from './TokenCacheService';
import { config } from '../../config/database';
import { logger } from '../../shared/utils/logger';
import jwt from 'jsonwebtoken';
import Joi from 'joi';


const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('user', 'attendant', 'admin').default('user')
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

export class AuthController {
  static login = asyncHandler(async (req: Request, res: Response) => {
    const requestId = (req as any).requestId || Math.random().toString(36).substring(7);
    const startTime = Date.now();
    
    logger.info('Tentativa de login iniciada', { 
      requestId, 
      email: req.body.email, 
      ip: req.ip 
    }, 'AUTH');
    
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      logger.warn('Dados de login inválidos', { 
        requestId, 
        email: req.body.email, 
        errors: error.details.map(d => d.message) 
      }, 'AUTH');
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const credentials = value as LoginRequest;
    
    try {
      const result = await AuthService.login(credentials);
      
      logger.success('Login realizado com sucesso', { 
        requestId, 
        userId: result.user.id, 
        email: result.user.email, 
        role: result.user.role,
        responseTime: Date.now() - startTime
      }, 'AUTH');
      
      res.json({
        message: 'Login realizado com sucesso',
        data: result
      });
    } catch (error) {
      logger.error('Falha no login', { 
        requestId, 
        email: credentials.email, 
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      }, 'AUTH');
      throw error;
    }
  });

  static register = asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('Iniciando processo de registro', { 
        requestId: (req as any).requestId,
        email: req.body.email,
        name: req.body.name,
        role: req.body.role
      }, 'AUTH');

      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        logger.warn('Dados de registro inválidos', { 
          requestId: (req as any).requestId,
          errors: error.details.map(d => d.message) 
        }, 'AUTH');
        res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
        return;
      }

      const userData = value as CreateUserRequest;
      logger.debug('Dados validados para registro', { 
        requestId: (req as any).requestId,
        userData: { ...userData, password: '[HIDDEN]' }
      }, 'AUTH');

      try {
        const result = await AuthService.register(userData);
        
        logger.success('Registro realizado com sucesso', { 
          requestId: (req as any).requestId,
          userId: result.user.id,
          email: result.user.email,
          role: result.user.role
        }, 'AUTH');
        
        res.status(201).json({
          message: 'Usuário criado com sucesso',
          data: result
        });
      } catch (error: any) {
        // Se o erro for "Email já cadastrado", verificar se é o mesmo usuário
        if (error.message === 'Email já cadastrado') {
          logger.warn('Tentativa de registro com email já existente', { 
            requestId: (req as any).requestId,
            email: userData.email 
          }, 'AUTH');
          
          // Verificar se é o mesmo usuário tentando se registrar novamente
          const existingUser = await UserModel.findByEmail(userData.email);
          if (existingUser && existingUser.name === userData.name && existingUser.role === userData.role) {
            logger.info('Usuário já existe com os mesmos dados, retornando sucesso', { 
              requestId: (req as any).requestId,
              userId: existingUser.id 
            }, 'AUTH');
            
            // Gerar token para o usuário existente
            const token = (jwt.sign as any)(
              { userId: existingUser.id, role: existingUser.role },
              config.jwt.secret,
              { expiresIn: config.jwt.expiresIn }
            );

            // Adicionar token ao cache
            tokenCacheService.addActiveToken(token, {
              userId: existingUser.id,
              userRole: existingUser.role,
              userName: existingUser.name,
              userEmail: existingUser.email
            });

            const { password, ...userWithoutPassword } = existingUser;

            res.status(200).json({
              message: 'Usuário já existe, login realizado',
              data: {
                user: userWithoutPassword,
                token
              }
            });
            return;
          } else {
            // Email existe mas com dados diferentes
            res.status(400).json({
              message: 'Email já cadastrado com dados diferentes',
              error: 'Email já cadastrado'
            });
            return;
          }
        }
        
        // Re-lançar outros erros
        throw error;
      }
    } catch (error) {
      logger.error('Erro no processo de registro', { 
        requestId: (req as any).requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'AUTH');
      throw error;
    }
  });

  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const token = await AuthService.refreshToken(userId);
    
    res.json({
      message: 'Token renovado com sucesso',
      data: { token }
    });
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    console.log('=== LOGOUT CHAMADO ===');
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log('Token recebido:', token ? token.substring(0, 20) + '...' : 'Nenhum');
    
    if (token) {
      // Primeiro, obter informações do usuário pelo token
      const tokenInfo = tokenCacheService.getUserByToken(token);
      console.log('Token encontrado no cache:', tokenInfo ? `${tokenInfo.userName} (ID: ${tokenInfo.userId})` : 'Não encontrado');
      
      if (tokenInfo) {
        console.log('Removendo tokens do usuário ID:', tokenInfo.userId);
        // Remover TODOS os tokens do usuário (mais robusto)
        tokenCacheService.removeUserTokens(tokenInfo.userId);
        // Também invalidar o token específico
        tokenCacheService.invalidateToken(token);
        console.log('Logout concluído para:', tokenInfo.userName);
        logger.info(`Logout realizado para usuário ${tokenInfo.userName} (ID: ${tokenInfo.userId})`);
      } else {
        console.log('Token não encontrado no cache, tentando JWT...');
        // Se não encontrar no cache, tentar decodificar o JWT para obter o userId
        try {
          const decoded = jwt.verify(token, config.jwt.secret) as { userId: number; role?: string };
          console.log('JWT decodificado - UserID:', decoded.userId);
          tokenCacheService.removeUserTokens(decoded.userId);
          // Também invalidar o token específico
          tokenCacheService.invalidateToken(token);
          console.log('Logout via JWT concluído para UserID:', decoded.userId);
          logger.info(`Logout realizado para usuário ID ${decoded.userId} (via JWT)`);
        } catch (error) {
          console.log('Erro ao decodificar JWT:', error);
          logger.warn('Token inválido durante logout:', error);
        }
      }
    } else {
      console.log('Nenhum token fornecido');
    }
    
    console.log('=== FIM LOGOUT ===');
    
    res.json({
      message: 'Logout realizado com sucesso'
    });
  });

  static changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const { currentPassword, newPassword } = value;
    
    // Validar nova senha
    const passwordValidation = AuthService.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      res.status(400).json({ 
        error: 'Senha inválida', 
        details: passwordValidation.errors 
      });
      return;
    }

    await AuthService.changePassword(userId, currentPassword, newPassword);
    
    res.json({
      message: 'Senha alterada com sucesso'
    });
  });

  static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    
    if (!email || !AuthService.validateEmail(email)) {
      res.status(400).json({ error: 'Email inválido' });
      return;
    }

    await AuthService.resetPassword(email);
    
    res.json({
      message: 'Instruções para redefinição de senha enviadas por email'
    });
  });

  static getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    res.json({
      message: 'Perfil obtido com sucesso',
      data: { user }
    });
  });

  static updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const bodyData = req.body as any;
    const { currentPassword, newPassword, ...userData } = bodyData;

    // Validar email se fornecido
    if (userData.email && !AuthService.validateEmail(userData.email)) {
      res.status(400).json({ error: 'Email inválido' });
      return;
    }

    // Verificar se email já existe (se estiver sendo alterado)
    if (userData.email) {
      const existingUser = await UserModel.findByEmail(userData.email);
      if (existingUser && existingUser.id !== userId) {
        res.status(409).json({ error: 'Email já cadastrado' });
        return;
      }
    }

    // Processar alteração de senha se fornecida
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Senha atual é obrigatória para alterar a senha' });
        return;
      }

      // Validar senha atual
      const user = await UserModel.findById(userId);
      if (!user) {
        res.status(404).json({ error: 'Usuário não encontrado' });
        return;
      }

      const isValidPassword = await UserModel.verifyPassword(user, currentPassword);
      if (!isValidPassword) {
        res.status(400).json({ error: 'Senha atual incorreta' });
        return;
      }

      // Validar nova senha
      const passwordValidation = AuthService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json({ 
          error: 'Senha inválida', 
          details: passwordValidation.errors 
        });
        return;
      }

      // Atualizar senha
      await UserModel.updatePassword(userId, newPassword);
    }

    // Atualizar outros campos do usuário (se houver)
    let updatedUser;
    if (Object.keys(userData).length > 0) {
      updatedUser = await UserModel.update(userId, userData);
    } else {
      updatedUser = await UserModel.findById(userId);
    }
    
    if (!updatedUser) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    const { password, ...userWithoutPassword } = updatedUser;
    
    res.json({
      message: 'Perfil atualizado com sucesso',
      data: { user: userWithoutPassword }
    });
  });
}
