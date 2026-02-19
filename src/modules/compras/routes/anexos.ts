import { Router } from 'express';
import { ComprasAnexoController } from '../controllers/ComprasAnexoController';
import { authenticate } from '../../../core/auth/middleware';
import { uploadMultiple } from '../../../shared/middleware/upload';
import { requirePermission } from '../../../core/permissions/middleware';
import Joi from 'joi';
import { validateParams } from '../../../shared/middleware/validation';

const router = Router();

// Todas as rotas precisam de autenticação
router.use(authenticate);

const paramsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

const orcamentoParamsSchema = Joi.object({
  orcamentoId: Joi.number().integer().positive().required()
});

const solicitacaoParamsSchema = Joi.object({
  solicitacaoId: Joi.number().integer().positive().required()
});

// Upload de anexos - usar campo 'anexos' para múltiplos arquivos
const uploadAnexos = uploadMultiple;
router.post('/upload', requirePermission('compras.orcamentos.create'), uploadAnexos, ComprasAnexoController.upload);

// Obter anexos por orçamento
router.get('/orcamento/:orcamentoId', requirePermission('compras.orcamentos.view'), validateParams(orcamentoParamsSchema), ComprasAnexoController.getByOrcamento);

// Obter anexos por solicitação
router.get('/solicitacao/:solicitacaoId', requirePermission('compras.solicitacoes.view'), validateParams(solicitacaoParamsSchema), ComprasAnexoController.getBySolicitacao);

// Download de anexo
router.get('/:id/download', requirePermission('compras.solicitacoes.view'), validateParams(paramsSchema), ComprasAnexoController.download);

// Deletar anexo
router.delete('/:id', requirePermission('compras.solicitacoes.edit'), validateParams(paramsSchema), ComprasAnexoController.delete);

export default router;

