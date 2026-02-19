import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { UserModel } from '../users/User';
import { User, UserRole, LoginRequest, AuthResponse, CreateUserRequest } from '../../shared/types';
import { config } from '../../config/database';
import { tokenCacheService } from './TokenCacheService';
import { logger } from '../../shared/utils/logger';

// Função auxiliar para gerar token JWT
function generateToken(payload: any, secret: string, expiresIn: string): string {
  return (jwt.sign as any)(payload, secret, { expiresIn });
}

export class AuthService {
  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    logger.debug('Buscando usuário por email', { email: credentials.email }, 'AUTH');
    const user = await UserModel.findByEmail(credentials.email);
    
    if (!user) {
      logger.warn('Usuário não encontrado', { email: credentials.email }, 'AUTH');
      throw new Error('Credenciais inválidas');
    }
    
    logger.debug('Usuário encontrado', { 
      userId: user.id, 
      email: user.email, 
      is_active: user.is_active 
    }, 'AUTH');
    
    if (!user.is_active) {
      logger.warn('Tentativa de login com usuário inativo', { 
        userId: user.id, 
        email: user.email 
      }, 'AUTH');
      throw new Error('Credenciais inválidas');
    }

    logger.debug('Verificando senha', { userId: user.id }, 'AUTH');
    const isValidPassword = await UserModel.verifyPassword(user, credentials.password);
    
    if (!isValidPassword) {
      logger.warn('Senha incorreta', { userId: user.id, email: user.email }, 'AUTH');
      throw new Error('Credenciais inválidas');
    }
    
    logger.debug('Senha verificada com sucesso', { userId: user.id }, 'AUTH');

    const token = generateToken(
      { userId: user.id, role: user.role },
      config.jwt.secret,
      config.jwt.expiresIn
    );

    // Adicionar token ao cache (usuário ficou online)
    tokenCacheService.addActiveToken(token, {
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      userEmail: user.email
    });

    const { password, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token
    };
  }

  static async register(userData: CreateUserRequest): Promise<AuthResponse> {
    try {
      logger.info('Iniciando processo de registro no serviço', { 
        email: userData.email,
        name: userData.name,
        role: userData.role
      }, 'AUTH');

      // Verificar se email já existe (apenas usuários ativos)
      // Permite reutilizar email de usuários que foram excluídos (soft delete)
      logger.debug('Verificando se email já existe', { email: userData.email }, 'AUTH');
      const existingUser = await UserModel.findByEmailActive(userData.email);
      if (existingUser) {
        logger.warn('Email já cadastrado', { email: userData.email }, 'AUTH');
        throw new Error('Email já cadastrado');
      }

      // Se existe um usuário inativo com esse email, vamos reativá-lo ao invés de criar novo
      const inactiveUser = await UserModel.findByEmail(userData.email);
      if (inactiveUser && !inactiveUser.is_active) {
        logger.info('Reativando usuário inativo', { 
          userId: inactiveUser.id, 
          email: userData.email 
        }, 'AUTH');
        
        // Reativa o usuário existente com os novos dados
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        await UserModel.update(inactiveUser.id, {
          name: userData.name,
          email: userData.email,
          role: userData.role,
          is_active: true
        });
        
        await UserModel.updatePassword(inactiveUser.id, userData.password);
        
        const reactivatedUser = await UserModel.findById(inactiveUser.id);
        if (!reactivatedUser) {
          throw new Error('Erro ao reativar usuário');
        }
        
        logger.success('Usuário reativado com sucesso', { 
          userId: reactivatedUser.id,
          email: reactivatedUser.email 
        }, 'AUTH');
        
        // Gera token para o usuário reativado
        const token = generateToken(
          { userId: reactivatedUser.id, role: reactivatedUser.role },
          config.jwt.secret,
          config.jwt.expiresIn
        );
        
        tokenCacheService.addActiveToken(token, {
          userId: reactivatedUser.id,
          userRole: reactivatedUser.role,
          userName: reactivatedUser.name,
          userEmail: reactivatedUser.email
        });
        
        const { password, ...userWithoutPassword } = reactivatedUser;
        
        return {
          user: userWithoutPassword,
          token
        };
      }

      // Criar usuário
      logger.debug('Criando usuário no banco de dados', { 
        email: userData.email,
        name: userData.name,
        role: userData.role
      }, 'AUTH');
      const user = await UserModel.create(userData);
      logger.success('Usuário criado no banco de dados', { 
        userId: user.id,
        email: user.email,
        role: user.role
      }, 'AUTH');

      // Gerar token
      logger.debug('Gerando token JWT', { userId: user.id }, 'AUTH');
      const token = generateToken(
        { userId: user.id, role: user.role },
        config.jwt.secret,
        config.jwt.expiresIn
      );

      // Adicionar token ao cache (usuário ficou online)
      logger.debug('Adicionando token ao cache', { userId: user.id }, 'AUTH');
      tokenCacheService.addActiveToken(token, {
        userId: user.id,
        userRole: user.role,
        userName: user.name,
        userEmail: user.email
      });

      const { password, ...userWithoutPassword } = user;

      logger.success('Registro concluído com sucesso', { 
        userId: user.id,
        email: user.email,
        role: user.role
      }, 'AUTH');

      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      logger.error('Erro no serviço de registro', { 
        email: userData.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'AUTH');
      throw error;
    }
  }

  static async refreshToken(userId: number): Promise<string> {
    const user = await UserModel.findById(userId);
    
    if (!user || !user.is_active) {
      throw new Error('Usuário não encontrado');
    }

    return generateToken(
      { userId: user.id, role: user.role },
      config.jwt.secret,
      config.jwt.expiresIn
    );
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const isValidPassword = await UserModel.verifyPassword(user, currentPassword);
    
    if (!isValidPassword) {
      throw new Error('Senha atual incorreta');
    }

    await UserModel.updatePassword(userId, newPassword);
  }

  static async resetPassword(email: string): Promise<void> {
    const user = await UserModel.findByEmail(email);
    
    if (!user || !user.is_active) {
      throw new Error('Email não encontrado');
    }

    // Aqui você implementaria o envio de email com link de reset
    // Por enquanto, apenas logamos
    console.log(`Reset de senha solicitado para: ${email}`);
  }

  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 6) {
      errors.push('Senha deve ter pelo menos 6 caracteres');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra maiúscula');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Senha deve conter pelo menos uma letra minúscula');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Senha deve conter pelo menos um número');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static generateRandomPassword(length: number = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }
}
