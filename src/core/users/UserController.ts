import { Request, Response } from 'express';
import { UserModel } from './User';
import { CreateUserRequest, UpdateUserRequest, UserRole, User } from '../../shared/types';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import { AuthService } from '../auth/AuthService';
import { log as auditLog } from '../audit/AuditService';
import path from 'path';
import fs from 'fs';
import { createUserSchema, updateUserSchema } from './schemas';
import Joi from 'joi';
import {
  IMPORT_EXPORT,
  parseCsv,
  parseJson,
  validateImportRow,
  toCsv,
  toExportRow,
  InvalidImportRow,
  ValidatedImportRow
} from './userImportExport';
import { dbAll, dbRun } from '../database/connection';
import { config } from '../../config/database';

const getIp = (req: Request) => req.ip || (req.headers['x-forwarded-for'] as string) || undefined;

const useTransaction = !config.database.usePostgres;


const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(255),
  role: Joi.string().valid('user', 'attendant', 'admin')
});

export class UserController {
  static sessionsSummary = asyncHandler(async (req: Request, res: Response) => {
    const rawIds = String(req.query.ids || '').trim();
    const ids = rawIds
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
      res.json({
        message: 'Resumo de sessões obtido com sucesso',
        data: { summary: {} as Record<number, number> }
      });
      return;
    }

    try {
      const placeholders = ids.map(() => '?').join(',');
      const rows = await dbAll(
        `SELECT user_id, COUNT(*) as total
           FROM auth_sessions
          WHERE revoked_at IS NULL
            AND expires_at > CURRENT_TIMESTAMP
            AND user_id IN (${placeholders})
          GROUP BY user_id`,
        ids
      ) as Array<{ user_id: number; total: number }>;

      const summary: Record<number, number> = {};
      rows.forEach((row) => {
        summary[row.user_id] = Number(row.total || 0);
      });

      res.json({
        message: 'Resumo de sessões obtido com sucesso',
        data: { summary }
      });
    } catch (error: any) {
      const message = String(error?.message || '');
      const missingTable =
        message.includes('no such table: auth_sessions') ||
        message.includes('relation "auth_sessions" does not exist');

      if (missingTable) {
        res.json({
          message: 'Resumo de sessões obtido com sucesso',
          data: { summary: {} as Record<number, number> }
        });
        return;
      }

      throw error;
    }
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const userData = req.body as CreateUserRequest;

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
      
      await UserModel.updatePassword(inactiveUser.id, userData.password);
      
      const updatedUser = await UserModel.findById(inactiveUser.id);
      if (!updatedUser) {
        res.status(500).json({ error: 'Erro ao reativar usuário' });
        return;
      }
      
      const { password, ...userWithoutPassword } = updatedUser;
      auditLog({
        userId: req.user?.id,
        userName: req.user?.name,
        action: 'user.reactivate',
        resource: 'administration',
        resourceId: String(inactiveUser.id),
        details: `Usuário ${updatedUser.name} (${updatedUser.email}) reativado`,
        ip: getIp(req)
      });
      res.status(200).json({
        message: 'Usuário reativado com sucesso',
        data: { user: userWithoutPassword }
      });
      return;
    }

    const user = await UserModel.create(userData);
    const { password, ...userWithoutPassword } = user;
    auditLog({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'user.create',
      resource: 'administration',
      resourceId: String(user.id),
      details: `Usuário criado: ${user.name} (${user.email}), role: ${user.role}`,
      ip: getIp(req)
    });
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
    const usersWithoutPasswords = users.map((user: User) => {
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
    auditLog({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'user.update',
      resource: 'administration',
      resourceId: String(userId),
      details: user.email ? `Perfil atualizado: ${user.name} (${user.email})` : `Perfil atualizado: ${user.name}`,
      ip: getIp(req)
    });
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
    auditLog({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'user.delete',
      resource: 'administration',
      resourceId: String(userId),
      details: `Usuário excluído: ${user.name} (${user.email})`,
      ip: getIp(req)
    });
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
    auditLog({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'user.password.reset',
      resource: 'administration',
      resourceId: String(userId),
      details: `Senha redefinida para usuário ${user.name} (${user.email})`,
      ip: getIp(req)
    });
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

  static uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = parseInt(id);

    if (isNaN(userId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    // Verificar permissões: apenas admin pode atualizar outros usuários OU usuário atualizar seu próprio perfil
    const isAdmin = req.user?.role === UserRole.ADMIN;
    const isUpdatingOwnProfile = req.user?.id === userId;
    
    if (!isAdmin && !isUpdatingOwnProfile) {
      res.status(403).json({ error: 'Você só pode atualizar seu próprio perfil' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    // Validar tipo de arquivo (apenas imagens)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      // Remover arquivo inválido
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Tipo de arquivo não permitido. Apenas imagens são aceitas.' });
      return;
    }

    // Validar tamanho (máximo 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (req.file.size > maxSize) {
      // Remover arquivo muito grande
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 2MB' });
      return;
    }

    // Obter avatar atual para remover se existir
    const currentUser = await UserModel.findById(userId);
    if (!currentUser) {
      fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'Usuário não encontrado' });
      return;
    }

    if (currentUser.avatar) {
      const oldAvatarPath = path.join(process.cwd(), currentUser.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        try {
          fs.unlinkSync(oldAvatarPath);
        } catch (error) {
          console.warn('Erro ao remover avatar antigo:', error);
        }
      }
    }

    // Criar diretório de avatares se não existir
    const avatarsDir = path.join(process.cwd(), 'storage', 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    // Mover arquivo para diretório de avatares com nome único
    const fileExt = path.extname(req.file.originalname);
    const fileName = `avatar-${userId}-${Date.now()}${fileExt}`;
    const avatarPath = path.join(avatarsDir, fileName);
    
    // Mover arquivo do uploads temporário para avatares
    fs.renameSync(req.file.path, avatarPath);

    // Salvar caminho relativo do arquivo (garantir que comece com storage/avatars/)
    const relativePath = `storage/avatars/${fileName}`;
    
    console.log('📸 Avatar salvo:', {
      originalPath: req.file.path,
      newPath: avatarPath,
      relativePath: relativePath,
      fileName: fileName
    });
    
    // Atualizar usuário com o novo avatar
    const updatedUser = await UserModel.update(userId, {
      avatar: relativePath
    });

    // Log ANTES de remover a senha
    console.log('📸 Usuário ANTES de remover senha:', {
      id: updatedUser.id,
      avatar: updatedUser.avatar,
      hasAvatar: !!updatedUser.avatar,
      avatarValue: updatedUser.avatar,
      allKeys: Object.keys(updatedUser)
    });

    // Remover senha da resposta
    const { password, ...userWithoutPassword } = updatedUser;

    // Log para debug
    console.log('📸 Avatar atualizado no banco:', {
      userId: userId,
      avatarPath: relativePath,
      avatarUrl: `/${relativePath}`,
      fileExists: fs.existsSync(avatarPath),
      absolutePath: avatarPath,
      staticRoute: '/storage/avatars',
      expectedUrl: `/${relativePath}`
    });

    // Verificar se o usuário retornado tem o avatar correto
    console.log('📸 Usuário retornado (DEPOIS de remover senha):', {
      id: userWithoutPassword.id,
      avatar: userWithoutPassword.avatar,
      hasAvatar: !!userWithoutPassword.avatar,
      avatarValue: userWithoutPassword.avatar,
      allKeys: Object.keys(userWithoutPassword),
      fullUser: JSON.stringify(userWithoutPassword, null, 2)
    });

    res.json({
      message: 'Avatar atualizado com sucesso',
      data: {
        user: userWithoutPassword,
        avatar_url: `/${relativePath}`,
        avatar_path: relativePath
      }
    });
  });

  /** Exportar usuários em CSV ou JSON (somente admin ou users.export). Senha nunca exportada. */
  static exportUsers = asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as string)?.toLowerCase() === 'json' ? 'json' : 'csv';
    const users = await UserModel.findAllForExport(IMPORT_EXPORT.MAX_ROWS);
    const withoutPassword = users.map((u) => {
      const { password: _, ...rest } = u;
      return rest;
    });
    const exportRows = withoutPassword.map((u) => toExportRow(u as any));

    auditLog({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'users.export',
      resource: 'users',
      details: `Exportação de ${exportRows.length} usuário(s), formato: ${format}`,
      ip: getIp(req)
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="usuarios-${new Date().toISOString().slice(0, 10)}.json"`);
      res.json(exportRows);
      return;
    }

    const csv = toCsv(exportRows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="usuarios-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);
  });

  /** Pré-visualizar importação: valida o arquivo e retorna linhas válidas e inválidas (não altera o banco). */
  static importPreview = asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file;
    if (!file || !file.buffer) {
      res.status(400).json({ error: 'Envie um arquivo CSV ou JSON (campo: file)' });
      return;
    }
    if (file.size > IMPORT_EXPORT.MAX_FILE_BYTES) {
      res.status(400).json({
        error: `Arquivo excede o limite de ${IMPORT_EXPORT.MAX_FILE_BYTES / 1024 / 1024} MB`
      });
      return;
    }

    const content = file.buffer.toString('utf-8');
    const isJson = file.mimetype === 'application/json' || file.originalname?.toLowerCase().endsWith('.json');
    const rawRows: Record<string, unknown>[] = isJson ? parseJson(content) : parseCsv(content) as any;

    if (rawRows.length > IMPORT_EXPORT.MAX_ROWS) {
      res.status(400).json({
        error: `Arquivo tem ${rawRows.length} linhas. Máximo permitido: ${IMPORT_EXPORT.MAX_ROWS}`
      });
      return;
    }

    const valid: ValidatedImportRow[] = [];
    const invalid: InvalidImportRow[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const result = validateImportRow(rawRows[i], i + 1);
      if ('valid' in result) valid.push(result.valid);
      else invalid.push(result.invalid);
    }

    res.json({
      message: 'Pré-visualização concluída',
      data: {
        total: rawRows.length,
        valid: valid.length,
        invalid: invalid.length,
        validRows: valid,
        invalidRows: invalid
      }
    });
  });

  /** Importar usuários. Senha nunca alterada; novos usuários usam senha padrão definida pelo admin. */
  static importUsers = asyncHandler(async (req: Request, res: Response) => {
    const file = (req as any).file;
    const defaultPassword = (req.body as any).defaultPassword;
    const updateExisting = String((req.body as any).updateExisting).toLowerCase() === 'true' || (req.body as any).updateExisting === true;

    if (!file || !file.buffer) {
      res.status(400).json({ error: 'Envie um arquivo CSV ou JSON (campo: file)' });
      return;
    }
    if (!defaultPassword || typeof defaultPassword !== 'string' || defaultPassword.length < 6) {
      res.status(400).json({ error: 'Senha padrão é obrigatória e deve ter no mínimo 6 caracteres' });
      return;
    }

    const pv = AuthService.validatePassword(defaultPassword);
    if (!pv.isValid) {
      res.status(400).json({ error: 'Senha padrão inválida', details: pv.errors });
      return;
    }

    if (file.size > IMPORT_EXPORT.MAX_FILE_BYTES) {
      res.status(400).json({
        error: `Arquivo excede o limite de ${IMPORT_EXPORT.MAX_FILE_BYTES / 1024 / 1024} MB`
      });
      return;
    }

    const content = file.buffer.toString('utf-8');
    const isJson = file.mimetype === 'application/json' || file.originalname?.toLowerCase().endsWith('.json');
    const rawRows: Record<string, unknown>[] = isJson ? parseJson(content) : parseCsv(content) as any;

    if (rawRows.length > IMPORT_EXPORT.MAX_ROWS) {
      res.status(400).json({
        error: `Arquivo tem ${rawRows.length} linhas. Máximo permitido: ${IMPORT_EXPORT.MAX_ROWS}`
      });
      return;
    }

    const valid: ValidatedImportRow[] = [];
    const invalid: InvalidImportRow[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const result = validateImportRow(rawRows[i], i + 1);
      if ('valid' in result) valid.push(result.valid);
      else invalid.push(result.invalid);
    }

    let created = 0;
    let updated = 0;

    if (useTransaction) {
      await dbRun('BEGIN');
    }

    try {
      for (const row of valid) {
        const existing = await UserModel.findByEmail(row.data.email);
        if (existing) {
          if (updateExisting) {
            await UserModel.update(existing.id, {
              name: row.data.name,
              role: row.data.role as UserRole,
              is_active: row.data.is_active,
              phone: row.data.phone,
              department: row.data.department,
              position: row.data.position
            });
            updated++;
          }
        } else {
          await UserModel.create({
            name: row.data.name,
            email: row.data.email,
            password: defaultPassword,
            role: row.data.role as UserRole,
            is_active: row.data.is_active,
            phone: row.data.phone,
            department: row.data.department,
            position: row.data.position
          } as CreateUserRequest);
          created++;
        }
      }

      if (useTransaction) {
        await dbRun('COMMIT');
      }
    } catch (err: any) {
      if (useTransaction) {
        await dbRun('ROLLBACK').catch(() => {});
      }
      throw err;
    }

    auditLog({
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'users.import',
      resource: 'users',
      details: `Importação: ${created} criado(s), ${updated} atualizado(s), ${invalid.length} linha(s) inválida(s). updateExisting=${updateExisting}`,
      ip: getIp(req)
    });

    res.status(201).json({
      message: 'Importação concluída',
      data: {
        created,
        updated,
        invalidCount: invalid.length,
        invalidRows: invalid
      }
    });
  });
}
