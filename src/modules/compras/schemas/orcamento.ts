import Joi from 'joi';

export const createOrcamentoSchema = Joi.object({
  solicitacao_id: Joi.number().integer().positive().required(),
  fornecedor_id: Joi.number().integer().positive().optional(),
  fornecedor_nome: Joi.string().required().min(3).max(255),
  fornecedor_cnpj: Joi.string().optional().max(18),
  fornecedor_contato: Joi.string().optional().max(255),
  fornecedor_email: Joi.string().email().optional().max(255),
  fornecedor_telefone: Joi.string().optional().allow('').max(20),
  numero_orcamento: Joi.string().optional().max(50),
  data_orcamento: Joi.date().iso().optional(),
  data_validade: Joi.date().iso().optional(),
  condicoes_pagamento: Joi.string().optional().max(500),
  prazo_entrega: Joi.string().optional().max(100),
  observacoes: Joi.string().optional().allow('').max(2000),
  itens: Joi.array().items(
    Joi.object({
      item_solicitacao_id: Joi.number().integer().positive().required(),
      descricao: Joi.string().required().min(3).max(500),
      quantidade: Joi.number().positive().required(),
      unidade_medida: Joi.string().max(20).default('UN'),
      valor_unitario: Joi.number().min(0).required(),
      valor_total: Joi.number().min(0).optional(),
      observacoes: Joi.string().optional().allow('').max(500)
    })
  ).min(1).required()
});

export const updateOrcamentoSchema = Joi.object({
  fornecedor_nome: Joi.string().optional().min(3).max(255),
  fornecedor_cnpj: Joi.string().optional().max(18),
  fornecedor_contato: Joi.string().optional().max(255),
  fornecedor_email: Joi.string().email().optional().max(255),
  fornecedor_telefone: Joi.string().optional().allow('').max(20),
  numero_orcamento: Joi.string().optional().max(50),
  data_orcamento: Joi.date().iso().optional(),
  data_validade: Joi.date().iso().optional(),
  condicoes_pagamento: Joi.string().optional().max(500),
  prazo_entrega: Joi.string().optional().max(100),
  observacoes: Joi.string().optional().allow('').max(2000),
  itens: Joi.array().items(
    Joi.object({
      item_solicitacao_id: Joi.number().integer().positive().required(),
      descricao: Joi.string().required().min(3).max(500),
      quantidade: Joi.number().positive().required(),
      unidade_medida: Joi.string().max(20).default('UN'),
      valor_unitario: Joi.number().min(0).required(),
      valor_total: Joi.number().min(0).optional(),
      observacoes: Joi.string().optional().allow('').max(500)
    })
  ).optional()
});

export const aprovarOrcamentoSchema = Joi.object({
  observacoes: Joi.string().optional().allow('').max(1000)
});

export const rejeitarOrcamentoSchema = Joi.object({
  motivo: Joi.string().required().min(3).max(1000)
});

export const devolverOrcamentoSchema = Joi.object({
  motivo: Joi.string().required().min(3).max(1000)
});

export const orcamentoListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().valid('pendente', 'aprovado', 'rejeitado', 'devolvido', 'cancelado').optional()
});

export const updateEntregaSchema = Joi.object({
  entrega_prevista: Joi.date().iso().optional().allow(null),
  entrega_efetiva: Joi.date().iso().optional().allow(null),
  status_entrega: Joi.string().valid('pendente', 'em_transito', 'entregue').optional()
});

