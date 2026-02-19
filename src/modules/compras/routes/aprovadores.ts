import { Router } from 'express';
import { AprovadorController } from '../controllers/AprovadorController';
import { authenticate, authorize } from '../../../core/auth/middleware';
import { validate, validateParams } from '../../../shared/middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import { UserRole } from '../../../shared/types';
import { createAprovadorSchema, updateAprovadorSchema } from '../schemas/aprovador';
import Joi from 'joi';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN)); // Apenas admins podem gerenciar aprovadores

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

router.post('/', requirePermission('compras.aprovadores.manage'), validate(createAprovadorSchema), AprovadorController.create);
router.get('/', requirePermission('compras.aprovadores.view'), AprovadorController.findAll);
router.get('/:id', requirePermission('compras.aprovadores.view'), validateParams(paramsSchema), AprovadorController.findById);
router.put('/:id', requirePermission('compras.aprovadores.manage'), validateParams(paramsSchema), validate(updateAprovadorSchema), AprovadorController.update);
router.delete('/:id', requirePermission('compras.aprovadores.manage'), validateParams(paramsSchema), AprovadorController.delete);

export default router;

