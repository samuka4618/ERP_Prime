import Joi from 'joi';

export const createAgendamentoSchema = Joi.object({
  fornecedor_id: Joi.number().integer().positive().required(),
  scheduled_date: Joi.string().required().pattern(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_time: Joi.string().required().pattern(/^\d{2}:\d{2}$/),
  dock: Joi.string().required().min(1).max(10),
  notes: Joi.string().optional().allow(null, '').max(1000)
});

export const updateAgendamentoSchema = Joi.object({
  fornecedor_id: Joi.number().integer().positive().optional(),
  scheduled_date: Joi.string().optional().pattern(/^\d{4}-\d{2}-\d{2}$/),
  scheduled_time: Joi.string().optional().pattern(/^\d{2}:\d{2}$/),
  dock: Joi.string().optional().min(1).max(10),
  status: Joi.string().valid('pendente', 'motorista_pronto', 'em_andamento', 'concluido').optional(),
  notes: Joi.string().optional().allow(null, '').max(1000)
});

export const agendamentoQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(10000).optional(),
  start_date: Joi.string().optional().pattern(/^\d{4}-\d{2}-\d{2}$/),
  end_date: Joi.string().optional().pattern(/^\d{4}-\d{2}-\d{2}$/),
  status: Joi.string().valid('pendente', 'motorista_pronto', 'em_andamento', 'concluido').optional(),
  fornecedor_id: Joi.number().integer().positive().optional(),
  dock: Joi.string().optional(),
  search: Joi.string().optional().allow('')
});
