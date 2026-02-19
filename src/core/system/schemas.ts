import Joi from 'joi';

export const updateSystemConfigSchema = Joi.object({
  sla_first_response_hours: Joi.number().integer().min(1).max(168).optional(),
  sla_resolution_hours: Joi.number().integer().min(1).max(720).optional(),
  reopen_days: Joi.number().integer().min(1).max(30).optional(),
  max_file_size: Joi.number().integer().min(1024).optional(),
  allowed_file_types: Joi.string().max(255).optional(),
  email_notifications: Joi.boolean().optional(),
  system_name: Joi.string().max(255).optional(),
  system_subtitle: Joi.string().max(255).optional(),
  system_logo: Joi.string().max(500).optional(),
  system_version: Joi.string().max(50).optional()
}).min(1).messages({
  'object.min': 'Pelo menos um campo deve ser fornecido para atualização'
});

