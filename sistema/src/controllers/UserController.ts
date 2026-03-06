import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { CreateUserRequest, UpdateUserRequest, UserRole } from '../types';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthService } from '../services/AuthService';
import { createUserSchema, updateUserSchema, entraListQuerySchema, entraImportSchema } from '../schemas/user';
import { fetchUserPhotoFromGraph, listUsersFromEntra, markAlreadyImported } from '../services/MicrosoftAuthService';
import { config } from '../config/database';
import Joi from 'joi';


const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(255),
  role: Joi.string().valid('user', 'attendant', 'admin')
});

export class UserController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    console.log('🔍 DEBUG CREATE USER - Body recebido:', req.body);
    console.log('🔍 DEBUG CREATE USER - Headers:', req.headers);
    
    // A validação já foi feita pelo middleware, então usamos req.body diretamente
    const userData = req.body as CreateUserRequest;
    
    // Validar senha (obrigatória no cadastro manual)
    if (!userData.password || typeof userData.password !== 'string') {
      res.status(400).json({ error: 'Senha é obrigatória' });
      return;
    }
    const passwordValidation = AuthService.validatePassword(userData.password);
    if (!passwordValidation.isValid) {
      res.status(400).json({ 
        error: 'Senha inválida', 
        details: passwordValidation.errors 
      });
      return;
    }

    // Verificar se email já existe (apenas usuários ativos)
    // Permite reutilizar email de usuários que foram excluídos (soft delete)
    const existingUser = await UserModel.findByEmailActive(userData.email);
    if (existingUser) {
      res.status(409).json({ error: 'Email já cadastrado' });
      return;
    }

    // Se existe um usuário inativo com esse email, vamos reativá-lo ao invés de criar novo
    const inactiveUser = await UserModel.findByEmail(userData.email);
    if (inactiveUser && !inactiveUser.is_active) {
      // Reativa o usuário existente com os novos dados
      await UserModel.update(inactiveUser.id, {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        is_active: true
      });
      
      await UserModel.updatePassword(inactiveUser.id, userData.password!);
      
      const updatedUser = await UserModel.findById(inactiveUser.id);
      if (!updatedUser) {
        res.status(500).json({ error: 'Erro ao reativar usuário' });
        return;
      }
      
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json({
        message: 'Usuário reativado com sucesso',
        data: { user: userWithoutPassword }
      });
      return;
    }

    const user = await UserModel.create(userData);
    const { password, ...userWithoutPassword } = user;
    
    res.status(201).json({
      message: 'Usuário criado com sucesso',
      data: { user: userWithoutPassword }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = querySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const { page, limit, search, role } = value;
    const offset = (page - 1) * limit;

    let users;
    let total;

    if (search) {
      users = await UserModel.search(search, limit, offset);
      total = await UserModel.count(); // Simplificado para busca
    } else if (role) {
      users = await UserModel.findByRole(role as UserRole, limit, offset);
      total = await UserModel.count(); // Simplificado para filtro por role
    } else {
      users = await UserModel.findAll(limit, offset);
      total = await UserModel.count();
    }

    // Remover senhas dos usuários
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.json({
      message: 'Usuários obtidos com sucesso',
      data: {
        data: usersWithoutPasswords,
        total_pages: Math.ceil(total / limit),
        page: page,
        total: total
      }
    });
  });

  static getAvatar = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }
    const user = await UserModel.findById(userId);
    if (!user || !user.microsoft_id) {
      res.status(404).json({ error: 'Avatar não disponível' });
      return;
    }
    const photo = await fetchUserPhotoFromGraph(user.microsoft_id);
    if (!photo) {
      res.status(404).json({ error: 'Foto não encontrada' });
      return;
    }
    res.set('Content-Type', photo.contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(photo.body);
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    const { password, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Usuário obtido com sucesso',
      data: { user: userWithoutPassword }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    // Verificar permissões: apenas admin pode atualizar outros usuários
    const isAdmin = req.user?.role === UserRole.ADMIN;
    const isUpdatingOwnProfile = req.user?.id === userId;
    
    if (!isAdmin && !isUpdatingOwnProfile) {
      res.status(403).json({ error: 'Você só pode atualizar seu próprio perfil' });
      return;
    }

    // A validação já foi feita pelo middleware, então usamos req.body diretamente
    const bodyData = req.body as any;
    
    // Separar dados de senha dos dados de usuário
    const { currentPassword, newPassword, ...userData } = bodyData;
    
    // Usuários comuns não podem alterar role ou is_active
    if (!isAdmin && (userData.role !== undefined || userData.is_active !== undefined)) {
      res.status(403).json({ error: 'Você não tem permissão para alterar role ou status do usuário' });
      return;
    }
    
    // Normalizar is_active para boolean se vier como número
    if (userData.is_active !== undefined) {
      userData.is_active = Boolean(userData.is_active);
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
      // Se o usuário está atualizando seu próprio perfil, precisa da senha atual
      if (isUpdatingOwnProfile) {
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
      } else {
        // Admin alterando senha de outro usuário - não precisa da senha atual
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
    }

    // Atualizar outros campos do usuário (se houver)
    let user;
    if (Object.keys(userData).length > 0) {
      user = await UserModel.update(userId, userData as UpdateUserRequest);
    } else {
      user = await UserModel.findById(userId);
    }

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    const { password, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Usuário atualizado com sucesso',
      data: { user: userWithoutPassword }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    // Verificar se é o próprio usuário
    if (req.user?.id === userId) {
      res.status(400).json({ error: 'Não é possível excluir seu próprio usuário' });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    await UserModel.delete(userId);
    
    res.json({
      message: 'Usuário excluído com sucesso'
    });
  });

  static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { newPassword } = req.body;
    
    if (!newPassword) {
      res.status(400).json({ error: 'Nova senha é obrigatória' });
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

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    await UserModel.updatePassword(userId, newPassword);
    
    res.json({
      message: 'Senha redefinida com sucesso'
    });
  });

  static generatePassword = asyncHandler(async (req: Request, res: Response) => {
    const password = AuthService.generateRandomPassword();
    
    res.json({
      message: 'Senha gerada com sucesso',
      data: { password }
    });
  });

  static listEntraUsers = asyncHandler(async (req: Request, res: Response) => {
    // Sempre retornar JSON com estrutura { data: { users, nextLink } } para o frontend não confundir com HTML
    if (!config.microsoft.enabled) {
      res.status(200).json({
        message: 'Integração Microsoft não configurada. Configure AZURE_CLIENT_ID, AZURE_CLIENT_SECRET e AZURE_TENANT_ID no .env do backend.',
        data: { users: [], nextLink: undefined }
      });
      return;
    }
    const { error, value } = entraListQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }
    const { page, limit, search } = value;
    const { users, nextLink } = await listUsersFromEntra(search, page, limit);
    const importedIds = await UserModel.getAllMicrosoftIds();
    markAlreadyImported(users, importedIds);
    res.json({
      message: 'Usuários do Entra ID obtidos',
      data: { users, nextLink: nextLink || undefined }
    });
  });

  static importEntraUser = asyncHandler(async (req: Request, res: Response) => {
    if (!config.microsoft.enabled) {
      res.status(503).json({ error: 'Integração Microsoft não configurada.' });
      return;
    }
    const { error, value } = entraImportSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }
    const { microsoft_id, role, name, email, job_title } = value;
    const existingByMicrosoftId = await UserModel.findByMicrosoftId(microsoft_id);
    if (existingByMicrosoftId) {
      res.status(409).json({ error: 'Usuário já importado com este Microsoft ID.' });
      return;
    }
    const existingByEmail = await UserModel.findByEmailActive(email);
    if (existingByEmail) {
      res.status(409).json({ error: 'Já existe um usuário ativo com este e-mail.' });
      return;
    }
    const displayName = name || email?.split('@')[0] || 'Usuário Entra ID';
    const userData: CreateUserRequest = {
      name: displayName,
      email,
      role: role as UserRole,
      is_active: true,
      microsoft_id,
      job_title: job_title || null
    };
    const user = await UserModel.create(userData);
    const { password, ...userWithoutPassword } = user;
    res.status(201).json({
      message: 'Usuário importado do Entra ID com sucesso',
      data: { user: userWithoutPassword }
    });
  });

  static getStats = asyncHandler(async (req: Request, res: Response) => {
    const totalUsers = await UserModel.count();
    
    // Contar por role
    const usersByRole = {
      user: (await UserModel.findByRole('user' as UserRole, 1000, 0)).length,
      attendant: (await UserModel.findByRole('attendant' as UserRole, 1000, 0)).length,
      admin: (await UserModel.findByRole('admin' as UserRole, 1000, 0)).length
    };

    res.json({
      message: 'Estatísticas obtidas com sucesso',
      data: {
        totalUsers,
        usersByRole
      }
    });
  });
}
