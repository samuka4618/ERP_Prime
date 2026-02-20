import Joi from 'joi';

export const createFornecedorSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  category: Joi.string().required().min(1).max(100),
  plate: Joi.string().optional().max(20).allow(null, '')
});

export const updateFornecedorSchema = Joi.object({
  name: Joi.string().optional().min(1).max(255),
  category: Joi.string().optional().min(1).max(100),
  plate: Joi.string().optional().max(20).allow(null, '')
});

export const fornecedorQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(10000).optional(),
  search: Joi.string().optional().allow(''),
  category: Joi.string().optional().allow('')
});
