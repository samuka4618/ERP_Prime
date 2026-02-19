import Joi from 'joi';

export const createCompradorSchema = Joi.object({
  user_id: Joi.number().integer().positive().required()
});

export const updateCompradorSchema = Joi.object({
  is_active: Joi.boolean().optional()
});

