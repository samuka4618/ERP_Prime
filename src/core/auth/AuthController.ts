import { Request, Response } from 'express';
import { AuthService } from './AuthService';
import { UserModel } from '../users/User';
import { LoginRequest, CreateUserRequest, User } from '../../shared/types';
import { asyncHandler, type AppError } from '../../shared/middleware/errorHandler';
import { tokenCacheService } from './TokenCacheService';
import { config } from '../../config/database';
import { logger } from '../../shared/utils/logger';
import { log as auditLog } from '../audit/AuditService';
import AuthSessionModel from './AuthSessionModel';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { loginSchema, updateUiPreferencesSchema } from './schemas';
import { mergeUiPreferences, parseUiPreferences } from './uiPreferencesService';
import { PermissionModel } from '../permissions/PermissionModel';
import { SystemConfigModel } from '../system/SystemConfig';
import { computePasswordChangeRequirement } from './passwordPolicy';

async function withPasswordGateFields(user: Omit<User, 'password'>): Promise<Omit<User, 'password'>> {
  const sys = await SystemConfigModel.getSystemConfig();
  const gate = computePasswordChangeRequirement(
    {
      must_change_password: user.must_change_password,
      password_changed_at: user.password_changed_at
    },
    sys
  );
  return {
    ...user,
    requiresPasswordChange: gate.requiresPasswordChange,
    passwordExpiredReason: gate.passwordExpiredReason
  };
}

const ACCESS_COOKIE_NAME = 'token';
const REFRESH_COOKIE_NAME = 'refresh_token';

function getBaseCookieOptions() {
  const isProduction = config.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
  };
}

function getAccessCookieOptions() {
  const maxAgeMs = AuthSessionModel.parseDurationToMs(config.jwt.accessExpiresIn);
  return { ...getBaseCookieOptions(), maxAge: maxAgeMs };
}

function getRefreshCookieOptions(rememberMe: boolean, maxAgeMs: number) {
  const baseOptions = getBaseCookieOptions();
  // rememberMe=true: cookie persistente; false: cookie de sessão (sem maxAge)
  return rememberMe ? { ...baseOptions, maxAge: maxAgeMs } : baseOptions;
}

function getClientMetadata(req: Request) {
  const rawForwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(rawForwarded)
    ? rawForwarded[0]
    : (rawForwarded?.split(',')[0] || '').trim();

  return {
    userAgent: req.get('user-agent') || 'unknown',
    ipAddress: forwardedIp || req.ip || undefined
  };
}

function issueAccessToken(user: { id: number; role: string; name: string; email: string }, sessionId: string): string {
  const token = (jwt.sign as any)(
    { userId: user.id, role: user.role, sid: sessionId, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  );

  tokenCacheService.addActiveToken(token, {
    userId: user.id,
    userRole: user.role,
    userName: user.name,
    userEmail: user.email
  });

  return token;
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, { path: '/' });
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
}


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
  /** Rota pública: informa se o registro de novos usuários está aberto (nenhum usuário no sistema). */
  static registrationOpen = asyncHandler(async (_req: Request, res: Response) => {
    const total = await UserModel.countAll();
    res.json({ canRegister: total === 0 });
  });

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
    const rememberMe = Boolean(credentials.rememberMe);
    const forceDisconnectOthers = Boolean(credentials.forceDisconnectOthers);
    
    try {
      const user = await AuthService.validateCredentials(credentials);
      await AuthSessionModel.revokeExpiredSessionsForUser(user.id);
      const activeCount = await AuthSessionModel.countActiveSessions(user.id);
      if (activeCount > 0 && !forceDisconnectOthers) {
        res.status(409).json({
          error: 'Este utilizador já tem sessão ativa noutro dispositivo ou separador.',
          code: 'SESSION_CONFLICT',
          activeSessions: activeCount
        });
        return;
      }
      if (activeCount > 0 && forceDisconnectOthers) {
        await AuthSessionModel.revokeAllUserSessions(user.id);
        tokenCacheService.removeUserTokens(user.id);
      }
      const metadata = getClientMetadata(req);
      const session = await AuthSessionModel.createSession(user.id, rememberMe, metadata);
      const accessToken = issueAccessToken(user, session.sessionId);
      const refreshMaxAgeMs = Math.max(1, session.refreshExpiresAt.getTime() - Date.now());
      const userWithGate = await withPasswordGateFields(user);
      const result = {
        user: userWithGate,
        token: accessToken
      };
      
      logger.success('Login realizado com sucesso', { 
        requestId, 
        userId: result.user.id, 
        email: result.user.email, 
        role: result.user.role,
        rememberMe,
        responseTime: Date.now() - startTime
      }, 'AUTH');
      auditLog({
        userId: result.user.id,
        userName: result.user.name,
        action: 'login.success',
        ip: req.ip || (req.headers['x-forwarded-for'] as string) || undefined
      });
      res.cookie(ACCESS_COOKIE_NAME, result.token, getAccessCookieOptions());
      res.cookie(
        REFRESH_COOKIE_NAME,
        session.refreshToken,
        getRefreshCookieOptions(rememberMe, refreshMaxAgeMs)
      );
      res.json({
        message: 'Login realizado com sucesso',
        data: result
      });
    } catch (error) {
      const err = error as AppError;
      const isInvalidCredentials = err?.message === 'Credenciais inválidas' || err?.statusCode === 401;
      auditLog({
        userName: credentials.email,
        action: 'login.failed',
        details: isInvalidCredentials ? 'Credenciais inválidas' : (err?.message || 'Erro desconhecido'),
        ip: req.ip || (req.headers['x-forwarded-for'] as string) || undefined
      });
      if (isInvalidCredentials) {
        logger.warn('Credenciais inválidas', { 
          requestId, 
          email: credentials.email, 
          responseTime: Date.now() - startTime
        }, 'AUTH');
      } else {
        logger.error('Falha no login', { 
          requestId, 
          email: credentials.email, 
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: Date.now() - startTime
        }, 'AUTH');
      }
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

      const regPass = await AuthService.validatePasswordForCurrentPolicy(userData.password);
      if (!regPass.isValid) {
        res.status(400).json({
          error: 'Senha inválida para a política atual do sistema',
          details: regPass.errors
        });
        return;
      }

      try {
        const registerResult = await AuthService.register(userData);
        const metadata = getClientMetadata(req);
        const session = await AuthSessionModel.createSession(registerResult.user.id, true, metadata);
        const accessToken = issueAccessToken(registerResult.user, session.sessionId);
        const refreshMaxAgeMs = Math.max(1, session.refreshExpiresAt.getTime() - Date.now());
        const result = {
          user: registerResult.user,
          token: accessToken
        };
        
        logger.success('Registro realizado com sucesso', { 
          requestId: (req as any).requestId,
          userId: result.user.id,
          email: result.user.email,
          role: result.user.role
        }, 'AUTH');
        
        res.cookie(ACCESS_COOKIE_NAME, result.token, getAccessCookieOptions());
        res.cookie(
          REFRESH_COOKIE_NAME,
          session.refreshToken,
          getRefreshCookieOptions(true, refreshMaxAgeMs)
        );
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
            
            await AuthSessionModel.revokeExpiredSessionsForUser(existingUser.id);
            await AuthSessionModel.revokeAllUserSessions(existingUser.id);
            tokenCacheService.removeUserTokens(existingUser.id);

            const metadata = getClientMetadata(req);
            const session = await AuthSessionModel.createSession(existingUser.id, true, metadata);
            const token = issueAccessToken(existingUser, session.sessionId);
            const refreshMaxAgeMs = Math.max(1, session.refreshExpiresAt.getTime() - Date.now());

            const { password, ui_preferences: _u1, ...userWithoutPassword } = existingUser;

            res.cookie(ACCESS_COOKIE_NAME, token, getAccessCookieOptions());
            res.cookie(
              REFRESH_COOKIE_NAME,
              session.refreshToken,
              getRefreshCookieOptions(true, refreshMaxAgeMs)
            );
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
    const refreshToken = (req as any).cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
      return;
    }

    const metadata = getClientMetadata(req);
    const rotated = await AuthSessionModel.rotateRefreshToken(refreshToken, metadata);
    if (!rotated) {
      clearAuthCookies(res);
      res.status(401).json({ error: 'Refresh token inválido ou expirado' });
      return;
    }

    const user = await UserModel.findById(rotated.userId);
    if (!user || !user.is_active) {
      clearAuthCookies(res);
      res.status(401).json({ error: 'Usuário não encontrado' });
      return;
    }

    const { password, ui_preferences: _u2, ...userWithoutPassword } = user;
    const accessToken = issueAccessToken(userWithoutPassword, rotated.sessionId);
    const refreshMaxAgeMs = Math.max(1, rotated.refreshExpiresAt.getTime() - Date.now());
    res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
    res.cookie(
      REFRESH_COOKIE_NAME,
      rotated.newRefreshToken,
      getRefreshCookieOptions(rotated.rememberMe, refreshMaxAgeMs)
    );
    res.json({
      message: 'Token renovado com sucesso',
      data: {
        token: accessToken,
        user: userWithoutPassword
      }
    });
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    const accessToken = (req as any).cookies?.[ACCESS_COOKIE_NAME] || req.header('Authorization')?.replace('Bearer ', '');
    const refreshToken = (req as any).cookies?.[REFRESH_COOKIE_NAME];
    
    if (accessToken) {
      const tokenInfo = tokenCacheService.getUserByToken(accessToken);
      if (tokenInfo) {
        tokenCacheService.removeToken(accessToken);
        tokenCacheService.invalidateToken(accessToken);
        logger.info(`Logout realizado para usuário ${tokenInfo.userName} (ID: ${tokenInfo.userId})`);
      } else {
        try {
          const decoded = jwt.verify(accessToken, config.jwt.secret) as { userId: number; role?: string };
          tokenCacheService.invalidateToken(accessToken);
          logger.info(`Logout realizado para usuário ID ${decoded.userId} (via JWT)`);
        } catch (error) {
          logger.warn('Token inválido durante logout:', error);
        }
      }
    }

    if (refreshToken) {
      await AuthSessionModel.revokeSessionByRefreshToken(refreshToken);
    }

    clearAuthCookies(res);
    res.json({
      message: 'Logout realizado com sucesso'
    });
  });

  static listSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const sessions = await AuthSessionModel.listUserSessions(userId, req.authSessionId);
    res.json({
      message: 'Sessões obtidas com sucesso',
      data: { sessions }
    });
  });

  static revokeSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const sessionId = req.params.sessionId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId é obrigatório' });
      return;
    }

    const revoked = await AuthSessionModel.revokeSessionById(userId, sessionId);
    if (!revoked) {
      res.status(404).json({ error: 'Sessão não encontrada ou já revogada' });
      return;
    }

    if (sessionId === req.authSessionId) {
      clearAuthCookies(res);
    }

    res.json({ message: 'Sessão revogada com sucesso' });
  });

  static revokeOtherSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const revokedCount = await AuthSessionModel.revokeAllUserSessions(userId, req.authSessionId);
    res.json({
      message: 'Sessões revogadas com sucesso',
      data: { revokedCount }
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
    const passwordValidation = await AuthService.validatePasswordForCurrentPolicy(newPassword);
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
    const uid = req.user?.id;
    if (!uid) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }
    const fresh = await UserModel.findById(uid);
    if (!fresh) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }
    const { password, ui_preferences: _prefs, ...stripped } = fresh;
    const userPayload = await withPasswordGateFields(stripped);

    res.json({
      message: 'Perfil obtido com sucesso',
      data: { user: userPayload }
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
      const passwordValidation = await AuthService.validatePasswordForCurrentPolicy(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json({ 
          error: 'Senha inválida', 
          details: passwordValidation.errors 
        });
        return;
      }

      // Atualizar senha
      await UserModel.updatePassword(userId, newPassword, { clearForcedPasswordChange: true });
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

    const { password, ui_preferences: _prefs, ...userWithoutPassword } = updatedUser;
    
    res.json({
      message: 'Perfil atualizado com sucesso',
      data: { user: userWithoutPassword }
    });
  });

  static getMyPreferences = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }
    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }
    const preferences = parseUiPreferences((user as { ui_preferences?: string }).ui_preferences);
    res.json({ message: 'Preferências obtidas com sucesso', data: { preferences } });
  });

  static updateMyPreferences = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }
    const { error, value } = updateUiPreferencesSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      res.status(400).json({
        error: 'Dados inválidos',
        details: error.details.map((d) => d.message),
      });
      return;
    }
    if (JSON.stringify(value).length > 32000) {
      res.status(400).json({ error: 'Preferências excedem o tamanho máximo permitido' });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    if (value.dashboard != null && Object.prototype.hasOwnProperty.call(value.dashboard, 'layouts')) {
      const layouts = value.dashboard.layouts as Record<string, unknown> | undefined;
      const hasWidgets =
        layouts &&
        typeof layouts === 'object' &&
        Object.values(layouts).some((arr) => Array.isArray(arr) && arr.length > 0);
      if (hasWidgets) {
        const canCustomize = await PermissionModel.hasPermission(userId, user.role, 'dashboard.customize');
        if (!canCustomize) {
          res.status(403).json({
            error: 'Sem permissão para guardar o layout do dashboard',
            requiredPermission: 'dashboard.customize',
          });
          return;
        }
      }
    }

    const merged = mergeUiPreferences((user as { ui_preferences?: string }).ui_preferences, value);
    await UserModel.update(userId, { ui_preferences: JSON.stringify(merged) });
    res.json({ message: 'Preferências atualizadas com sucesso', data: { preferences: merged } });
  });
}
