import { Router } from 'express';
import { FormularioController } from '../controllers/FormularioController';
import { authenticate, optionalAuth } from '../../../core/auth/middleware';
import { validate, validateParams } from '../../../shared/middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import Joi from 'joi';

const router = Router();

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// Rotas públicas (sem autenticação obrigatória)
router.get('/public/default', optionalAuth, FormularioController.findDefault);
router.get('/public/published', optionalAuth, FormularioController.findPublished);
router.get('/public/:id', optionalAuth, validateParams(paramsSchema), FormularioController.findPublicById);

// Rotas protegidas
router.use(authenticate);

router.get('/', requirePermission('descarregamento.formularios.manage'), FormularioController.findAll);
router.post('/', requirePermission('descarregamento.formularios.manage'), FormularioController.create);
router.get('/default', requirePermission('descarregamento.formularios.manage'), FormularioController.findDefault);
router.get('/:id/regenerate-link', requirePermission('descarregamento.formularios.manage'), validateParams(paramsSchema), FormularioController.regeneratePublicUrl);
router.get('/:id', requirePermission('descarregamento.formularios.manage'), validateParams(paramsSchema), FormularioController.findById);
router.put('/:id', requirePermission('descarregamento.formularios.manage'), validateParams(paramsSchema), FormularioController.update);
router.delete('/:id', requirePermission('descarregamento.formularios.manage'), validateParams(paramsSchema), FormularioController.delete);

export default router;
