import Joi from 'joi';

export const createAprovadorSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  nivel_aprovacao: Joi.number().integer().min(1).required(),
  valor_minimo: Joi.number().min(0).default(0),
  valor_maximo: Joi.number().min(0).default(999999999.99)
});

export const updateAprovadorSchema = Joi.object({
  nivel_aprovacao: Joi.number().integer().min(1).optional(),
  valor_minimo: Joi.number().min(0).optional(),
  valor_maximo: Joi.number().min(0).optional(),
  is_active: Joi.boolean().optional()
});

