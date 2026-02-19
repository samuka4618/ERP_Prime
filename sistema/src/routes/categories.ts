import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController';
import { authenticate, authorize } from '../middleware/auth';
import { validate, validateQuery, validateParams } from '../middleware/validation';
import { createCategorySchema, updateCategorySchema, categoryQuerySchema } from '../schemas/category';
import { UserRole } from '../types';
import Joi from 'joi';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// Rotas públicas (todos os usuários autenticados)
router.get('/active', CategoryController.findActive);

// Apenas administradores podem gerenciar categorias
router.use(authorize(UserRole.ADMIN));

// Rotas para gerenciamento de categorias (apenas admin)
router.post('/', validate(createCategorySchema), CategoryController.create);
router.get('/', validateQuery(categoryQuerySchema), CategoryController.findAll);
router.get('/stats', CategoryController.getStats);
router.get('/:id', validateParams(paramsSchema), CategoryController.findById);
router.put('/:id', validateParams(paramsSchema), validate(updateCategorySchema), CategoryController.update);
router.delete('/:id', validateParams(paramsSchema), CategoryController.delete);

export default router;
