import { Router } from 'express';
import { CompradorController } from '../controllers/CompradorController';
import { authenticate, authorize } from '../../../core/auth/middleware';
import { validate, validateParams } from '../../../shared/middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import { UserRole } from '../../../shared/types';
import { createCompradorSchema, updateCompradorSchema } from '../schemas/comprador';
import Joi from 'joi';

const router = Router();

router.use(authenticate);
router.use(authorize(UserRole.ADMIN)); // Apenas admins podem gerenciar compradores

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

router.post('/', requirePermission('compras.compradores.manage'), validate(createCompradorSchema), CompradorController.create);
router.get('/', requirePermission('compras.compradores.view'), CompradorController.findAll);
router.get('/:id', requirePermission('compras.compradores.view'), validateParams(paramsSchema), CompradorController.findById);
router.put('/:id', requirePermission('compras.compradores.manage'), validateParams(paramsSchema), validate(updateCompradorSchema), CompradorController.update);
router.delete('/:id', requirePermission('compras.compradores.manage'), validateParams(paramsSchema), CompradorController.delete);

export default router;

