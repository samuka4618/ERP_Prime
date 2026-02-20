import { Router } from 'express';
import { DocaConfigController } from '../controllers/DocaConfigController';
import { authenticate } from '../../../core/auth/middleware';
import { validate, validateParams } from '../../../shared/middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import Joi from 'joi';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

const createDocaSchema = Joi.object({
  numero: Joi.string().required().min(1).max(10),
  nome: Joi.string().optional().max(255).allow(null, ''),
  is_active: Joi.boolean().optional()
});

const updateDocaSchema = Joi.object({
  numero: Joi.string().optional().min(1).max(10),
  nome: Joi.string().optional().max(255).allow(null, ''),
  is_active: Joi.boolean().optional()
});

router.get('/', requirePermission('descarregamento.formularios.manage'), DocaConfigController.findAll);
router.post('/', requirePermission('descarregamento.formularios.manage'), validate(createDocaSchema), DocaConfigController.create);
router.get('/:id', requirePermission('descarregamento.formularios.manage'), validateParams(paramsSchema), DocaConfigController.findById);
router.put('/:id', requirePermission('descarregamento.formularios.manage'), validateParams(paramsSchema), validate(updateDocaSchema), DocaConfigController.update);
router.delete('/:id', requirePermission('descarregamento.formularios.manage'), validateParams(paramsSchema), DocaConfigController.delete);

export default router;
