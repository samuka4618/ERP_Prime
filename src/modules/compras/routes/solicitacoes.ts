import { Router } from 'express';
import { SolicitacaoCompraController } from '../controllers/SolicitacaoCompraController';
import { authenticate, authorize } from '../../../core/auth/middleware';
import { validate, validateQuery, validateParams } from '../../../shared/middleware/validation';
import { requirePermission } from '../../../core/permissions/middleware';
import { UserRole } from '../../../shared/types';
import {
  createSolicitacaoCompraSchema,
  updateSolicitacaoCompraSchema,
  solicitacaoCompraQuerySchema,
  rejeitarSolicitacaoSchema,
  atribuirCompradorSchema,
  cancelarSolicitacaoSchema
} from '../schemas/solicitacaoCompra';
import Joi from 'joi';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

// Rotas para todos os usuários autenticados
router.get('/statistics', requirePermission('compras.solicitacoes.view'), SolicitacaoCompraController.getStatistics);
router.post('/', requirePermission('compras.solicitacoes.create'), validate(createSolicitacaoCompraSchema), SolicitacaoCompraController.create);
router.get('/', requirePermission('compras.solicitacoes.view'), validateQuery(solicitacaoCompraQuerySchema), SolicitacaoCompraController.findAll);
router.get('/minhas', requirePermission('compras.solicitacoes.view'), validateQuery(solicitacaoCompraQuerySchema), SolicitacaoCompraController.findByComprador);
router.get('/pendentes-aprovacao', requirePermission('compras.solicitacoes.view'), validateQuery(solicitacaoCompraQuerySchema), SolicitacaoCompraController.findByAprovador);
router.get('/:id', requirePermission('compras.solicitacoes.view'), validateParams(paramsSchema), SolicitacaoCompraController.findById);
router.get('/:id/historico', requirePermission('compras.solicitacoes.history'), validateParams(paramsSchema), SolicitacaoCompraController.getHistorico);
router.put('/:id', requirePermission('compras.solicitacoes.edit'), validateParams(paramsSchema), validate(updateSolicitacaoCompraSchema), SolicitacaoCompraController.update);
router.post('/:id/enviar-aprovacao', requirePermission('compras.solicitacoes.edit'), validateParams(paramsSchema), SolicitacaoCompraController.enviarParaAprovacao);
router.post('/:id/aprovar', requirePermission('compras.solicitacoes.approve'), validateParams(paramsSchema), SolicitacaoCompraController.aprovar);
router.post('/:id/rejeitar', requirePermission('compras.solicitacoes.reject'), validateParams(paramsSchema), validate(rejeitarSolicitacaoSchema), SolicitacaoCompraController.rejeitar);
router.post('/:id/cancelar', requirePermission('compras.solicitacoes.cancel'), validateParams(paramsSchema), validate(cancelarSolicitacaoSchema), SolicitacaoCompraController.cancelar);

// Rotas apenas para administradores e compradores
router.post('/:id/atribuir-comprador', requirePermission('compras.solicitacoes.assign'), validateParams(paramsSchema), validate(atribuirCompradorSchema), SolicitacaoCompraController.atribuirComprador);

// Exclusão de solicitações (baseada em permissão, não apenas admin)
router.delete('/:id', requirePermission('compras.solicitacoes.delete'), validateParams(paramsSchema), SolicitacaoCompraController.delete);

export default router;

