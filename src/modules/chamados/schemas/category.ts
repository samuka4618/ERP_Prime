import Joi from 'joi';

const categoryFieldSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  label: Joi.string().required(),
  type: Joi.string().valid('text', 'textarea', 'number', 'email', 'date', 'select', 'file').required(),
  required: Joi.boolean().default(false),
  placeholder: Joi.string().optional(),
  options: Joi.array().items(Joi.string()).optional(),
  description: Joi.string().optional()
});

export const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  sla_first_response_hours: Joi.number().integer().min(1).max(168).required(), // 1 hora a 1 semana
  sla_resolution_hours: Joi.number().integer().min(1).max(720).required(), // 1 hora a 30 dias
  is_active: Joi.boolean().default(true),
  custom_fields: Joi.array().items(categoryFieldSchema).optional()
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  description: Joi.string().max(500).optional(),
  sla_first_response_hours: Joi.number().integer().min(1).max(168).optional(),
  sla_resolution_hours: Joi.number().integer().min(1).max(720).optional(),
  is_active: Joi.boolean().optional(),
  custom_fields: Joi.array().items(categoryFieldSchema).optional()
}).min(1).messages({
  'object.min': 'Pelo menos um campo deve ser fornecido para atualização'
});

export const categoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(255)
});
