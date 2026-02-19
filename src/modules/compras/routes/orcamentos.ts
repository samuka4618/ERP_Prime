import { Router } from 'express';
import { OrcamentoController } from '../controllers/OrcamentoController';
import { authenticate } from '../../../core/auth/middleware';
import { validate, validateParams } from '../../../shared/middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import {
  createOrcamentoSchema,
  updateOrcamentoSchema,
  aprovarOrcamentoSchema,
  rejeitarOrcamentoSchema,
  devolverOrcamentoSchema,
  orcamentoListQuerySchema,
  updateEntregaSchema
} from '../schemas/orcamento';
import Joi from 'joi';

const router = Router();

router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

const solicitacaoParamsSchema = Joi.object({
  solicitacaoId: Joi.number().integer().positive().required()
});

router.get('/', requirePermission('compras.orcamentos.view'), OrcamentoController.findAll);
router.get('/solicitacao/:solicitacaoId', requirePermission('compras.orcamentos.view'), validateParams(solicitacaoParamsSchema), OrcamentoController.findBySolicitacao);
router.get('/:id', requirePermission('compras.orcamentos.view'), validateParams(paramsSchema), OrcamentoController.findById);
router.post('/', requirePermission('compras.orcamentos.create'), validate(createOrcamentoSchema), OrcamentoController.create);
router.put('/:id', requirePermission('compras.orcamentos.edit'), validateParams(paramsSchema), validate(updateOrcamentoSchema), OrcamentoController.update);
router.patch('/:id/entrega', requirePermission('compras.orcamentos.edit'), validateParams(paramsSchema), validate(updateEntregaSchema), OrcamentoController.updateEntrega);
router.post('/:id/confirmar-entrega-solicitante', requirePermission('compras.orcamentos.view'), validateParams(paramsSchema), OrcamentoController.confirmarEntregaSolicitante);
router.post('/:id/confirmar-entrega-comprador', requirePermission('compras.orcamentos.view'), validateParams(paramsSchema), OrcamentoController.confirmarEntregaComprador);
router.post('/:id/aprovar', requirePermission('compras.orcamentos.approve'), validateParams(paramsSchema), validate(aprovarOrcamentoSchema), OrcamentoController.aprovar);
router.post('/:id/rejeitar', requirePermission('compras.orcamentos.reject'), validateParams(paramsSchema), validate(rejeitarOrcamentoSchema), OrcamentoController.rejeitar);
router.post('/:id/devolver', requirePermission('compras.orcamentos.devolver'), validateParams(paramsSchema), validate(devolverOrcamentoSchema), OrcamentoController.devolver);
router.delete('/:id', requirePermission('compras.orcamentos.delete'), validateParams(paramsSchema), OrcamentoController.delete);

export default router;

