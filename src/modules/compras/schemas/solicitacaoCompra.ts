import Joi from 'joi';

export const createSolicitacaoCompraSchema = Joi.object({
  centro_custo: Joi.string().max(100).optional(),
  descricao: Joi.string().required().min(3).max(1000),
  justificativa: Joi.string().optional().max(2000),
  prioridade: Joi.string().valid('baixa', 'normal', 'alta', 'urgente').default('normal'),
  data_necessidade: Joi.date().iso().optional(),
  observacoes: Joi.string().optional().allow('').max(2000),
  aprovadores_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
  itens: Joi.array().items(
    Joi.object({
      item_numero: Joi.number().integer().positive().required(),
      descricao: Joi.string().required().min(3).max(500),
      quantidade: Joi.number().positive().required(),
      unidade_medida: Joi.string().max(20).default('UN'),
      valor_unitario: Joi.number().min(0).required(),
      valor_total: Joi.number().min(0).optional(),
      observacoes: Joi.string().optional().allow('').max(500)
    })
  ).min(1).required()
});

export const updateSolicitacaoCompraSchema = Joi.object({
  centro_custo: Joi.string().max(100).optional(),
  descricao: Joi.string().optional().min(3).max(1000),
  justificativa: Joi.string().optional().max(2000),
  prioridade: Joi.string().valid('baixa', 'normal', 'alta', 'urgente').optional(),
  data_necessidade: Joi.date().iso().optional(),
  observacoes: Joi.string().optional().allow('').max(2000),
  comprador_id: Joi.number().integer().positive().optional().allow(null),
  itens: Joi.array().items(
    Joi.object({
      item_numero: Joi.number().integer().positive().required(),
      descricao: Joi.string().required().min(3).max(500),
      quantidade: Joi.number().positive().required(),
      unidade_medida: Joi.string().max(20).default('UN'),
      valor_unitario: Joi.number().min(0).required(),
      valor_total: Joi.number().min(0).optional(),
      observacoes: Joi.string().optional().allow('').max(500)
    })
  ).optional()
});

export const solicitacaoCompraQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('rascunho', 'pendente_aprovacao', 'aprovada', 'rejeitada', 'em_cotacao', 'cotacao_recebida', 'orcamento_aprovado', 'orcamento_rejeitado', 'em_compra', 'comprada', 'cancelada', 'devolvida').optional(),
  solicitante_id: Joi.number().integer().positive().optional(),
  comprador_id: Joi.number().integer().positive().optional(),
  search: Joi.string().optional()
});

export const rejeitarSolicitacaoSchema = Joi.object({
  motivo: Joi.string().required().min(3).max(1000)
});

export const atribuirCompradorSchema = Joi.object({
  comprador_id: Joi.number().integer().positive().required()
});

export const cancelarSolicitacaoSchema = Joi.object({
  motivo: Joi.string().optional().max(1000)
});

