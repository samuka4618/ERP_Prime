import { Router } from 'express';
import { FormResponseController } from '../controllers/FormResponseController';
import { authenticate, optionalAuth } from '../../../core/auth/middleware';
import { validate, validateQuery, validateParams } from '../../../shared/middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import { createFormResponseSchema, formResponseQuerySchema } from '../schemas/formResponse';
import Joi from 'joi';

const router = Router();

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

const trackingParamsSchema = Joi.object({
  trackingCode: Joi.string().required()
});

// Rota pública para registro de chegada (sem autenticação obrigatória)
router.post('/public/chegada', optionalAuth, validate(createFormResponseSchema), FormResponseController.create);

// Rota pública para acompanhamento (sem autenticação obrigatória)
router.get('/public/tracking/:trackingCode', optionalAuth, validateParams(trackingParamsSchema), FormResponseController.findByTrackingCode);

// Rotas protegidas
router.use(authenticate);

router.get('/patio', requirePermission('descarregamento.motoristas.view'), FormResponseController.findInYard);
router.get('/', requirePermission('descarregamento.formularios.view_responses'), validateQuery(formResponseQuerySchema), FormResponseController.findAll);
router.get('/:id', requirePermission('descarregamento.formularios.view_responses'), validateParams(paramsSchema), FormResponseController.findById);
router.post('/:id/checkout', requirePermission('descarregamento.motoristas.liberar'), validateParams(paramsSchema), FormResponseController.checkout);

export default router;
