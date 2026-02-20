import { Router } from 'express';
import { FornecedorController } from '../controllers/FornecedorController';
import { authenticate, optionalAuth } from '../../../core/auth/middleware';
import { validate, validateQuery, validateParams } from '../../../shared/middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import { createFornecedorSchema, fornecedorQuerySchema } from '../schemas/fornecedor';
import Joi from 'joi';

const router = Router();

// Rota pública para listar fornecedores (para formulário público)
router.get('/public', optionalAuth, validateQuery(fornecedorQuerySchema), FornecedorController.findAll);

// Todas as outras rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

router.get('/categories', requirePermission('descarregamento.fornecedores.view'), FornecedorController.getCategories);
router.post('/', requirePermission('descarregamento.fornecedores.create'), validate(createFornecedorSchema), FornecedorController.create);
router.get('/', requirePermission('descarregamento.fornecedores.view'), validateQuery(fornecedorQuerySchema), FornecedorController.findAll);
router.get('/:id', requirePermission('descarregamento.fornecedores.view'), validateParams(paramsSchema), FornecedorController.findById);
router.put('/:id', requirePermission('descarregamento.fornecedores.edit'), validateParams(paramsSchema), FornecedorController.update);
router.delete('/:id', requirePermission('descarregamento.fornecedores.delete'), validateParams(paramsSchema), FornecedorController.delete);

export default router;
