import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authenticate, authorize } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validation';
import { createUserSchema, updateUserSchema, changePasswordSchema, userQuerySchema } from '../schemas/user';
import { UserRole } from '../types';
import Joi from 'joi';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.string().pattern(/^\d+$/).required()
});

// Rotas que requerem permissão de admin
router.post('/', authorize(UserRole.ADMIN), validate(createUserSchema), UserController.create);
router.get('/', authorize(UserRole.ADMIN), validateQuery(userQuerySchema), UserController.findAll);
router.get('/stats', authorize(UserRole.ADMIN), UserController.getStats);
router.get('/generate-password', authorize(UserRole.ADMIN), UserController.generatePassword);
router.get('/:id', authorize(UserRole.ADMIN), validateParams(paramsSchema), UserController.findById);
router.delete('/:id', authorize(UserRole.ADMIN), validateParams(paramsSchema), UserController.delete);
router.post('/:id/reset-password', authorize(UserRole.ADMIN), validateParams(paramsSchema), validate(changePasswordSchema), UserController.resetPassword);

// Rota de atualização: permite admin atualizar qualquer usuário OU usuário atualizar seu próprio perfil
router.put('/:id', validateParams(paramsSchema), validate(updateUserSchema), UserController.update);

export default router;
