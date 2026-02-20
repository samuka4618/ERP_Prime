import Joi from 'joi';

export const createFormResponseSchema = Joi.object({
  form_id: Joi.number().integer().positive().optional().allow(null),
  responses: Joi.object().required(),
  driver_name: Joi.string().required().min(1).max(255),
  phone_number: Joi.string().optional().max(20).allow(null, ''),
  fornecedor_id: Joi.number().integer().positive().required()
});

export const formResponseQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(10000).optional(),
  start_date: Joi.string().optional().pattern(/^\d{4}-\d{2}-\d{2}$/),
  end_date: Joi.string().optional().pattern(/^\d{4}-\d{2}-\d{2}$/),
  fornecedor_id: Joi.number().integer().positive().optional(),
  is_in_yard: Joi.boolean().optional(),
  search: Joi.string().optional().allow('')
});
