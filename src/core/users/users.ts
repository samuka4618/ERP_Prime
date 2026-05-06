import { Router } from 'express';
import { UserController } from './UserController';
import { authenticate, authorize } from '../auth/middleware';
import { validate, validateQuery, validateParams } from '../../shared/middleware/validation';
import { createUserSchema, updateUserSchema, changePasswordSchema, adminResetPasswordSchema, userQuerySchema } from './schemas';
import { UserRole } from '../../shared/types';
import { uploadSingle, uploadUserImport } from '../../shared/middleware/upload';
import { adminOrPermission } from '../permissions/middleware';
import Joi from 'joi';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.string().pattern(/^\d+$/).required()
});

// Exportar/Importar usuários: admin ou permissão específica (admin sempre liberado)
router.get('/export', adminOrPermission('users.export'), UserController.exportUsers);
router.post('/import/preview', adminOrPermission('users.import'), uploadUserImport, UserController.importPreview);
router.post('/import', adminOrPermission('users.import'), uploadUserImport, UserController.importUsers);

// Rotas que requerem permissão de admin
router.post('/', authorize(UserRole.ADMIN), validate(createUserSchema), UserController.create);
router.get('/', authorize(UserRole.ADMIN), validateQuery(userQuerySchema), UserController.findAll);
router.get('/sessions-summary', authorize(UserRole.ADMIN), UserController.sessionsSummary);
router.get('/stats', authorize(UserRole.ADMIN), UserController.getStats);
router.get('/generate-password', authorize(UserRole.ADMIN), UserController.generatePassword);

// Rotas específicas devem vir ANTES das rotas genéricas com :id
// Rota para upload de avatar (deve vir antes de /:id)
router.post('/:id/avatar', validateParams(paramsSchema), uploadSingle, UserController.uploadAvatar);
router.post('/:id/reset-password', adminOrPermission('users.edit'), validateParams(paramsSchema), validate(adminResetPasswordSchema), UserController.resetPassword);

// Rotas genéricas com :id
router.get('/:id', authorize(UserRole.ADMIN), validateParams(paramsSchema), UserController.findById);
router.delete('/:id', authorize(UserRole.ADMIN), validateParams(paramsSchema), UserController.delete);

// Rota de atualização: permite admin atualizar qualquer usuário OU usuário atualizar seu próprio perfil
router.put('/:id', validateParams(paramsSchema), validate(updateUserSchema), UserController.update);

export default router;
