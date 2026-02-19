import Joi from 'joi';

export const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('user', 'attendant', 'admin').required(),
  is_active: Joi.alternatives().try(
    Joi.boolean(),
    Joi.number().integer().valid(0, 1)
  ).default(true)
});

export const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(255).optional(),
  email: Joi.string().email().optional(),
  role: Joi.string().valid('user', 'attendant', 'admin').optional(),
  is_active: Joi.alternatives().try(
    Joi.boolean(),
    Joi.number().integer().valid(0, 1)
  ).optional(),
  currentPassword: Joi.string().optional(),
  newPassword: Joi.string().min(6).optional()
}).min(1).unknown(false).messages({
  'object.min': 'Pelo menos um campo deve ser fornecido para atualização',
  'object.unknown': 'Campo não permitido: {{#label}}'
});

export const changePasswordSchema = Joi.object({
  newPassword: Joi.string().min(6).required()
});

export const userQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(255),
  role: Joi.string().valid('user', 'attendant', 'admin')
});
