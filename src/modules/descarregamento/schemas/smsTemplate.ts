import Joi from 'joi';

export const createSMSTemplateSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  message: Joi.string().required().min(1).max(1600), // Limite de caracteres para SMS
  template_type: Joi.string().valid('arrival', 'release').required(),
  is_default: Joi.boolean().optional()
});

export const updateSMSTemplateSchema = Joi.object({
  name: Joi.string().optional().min(1).max(255),
  message: Joi.string().optional().min(1).max(1600),
  template_type: Joi.string().valid('arrival', 'release').optional(),
  is_default: Joi.boolean().optional()
});
