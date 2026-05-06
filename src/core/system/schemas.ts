import Joi from 'joi';

export const updateSystemConfigSchema = Joi.object({
  sla_first_response_hours: Joi.number().integer().min(1).max(168).optional(),
  sla_resolution_hours: Joi.number().integer().min(1).max(720).optional(),
  reopen_days: Joi.number().integer().min(1).max(30).optional(),
  max_file_size: Joi.number().integer().min(1024).optional(),
  allowed_file_types: Joi.string().max(255).allow('').optional(),
  email_notifications: Joi.boolean().optional(),
  system_name: Joi.string().min(1).max(255).optional(),
  system_subtitle: Joi.string().max(255).allow('').optional(),
  system_logo: Joi.string().max(500).allow('').optional(),
  system_version: Joi.string().max(50).allow('').optional(),
  password_max_age_days: Joi.number().integer().min(0).max(730).optional(),
  password_require_strong: Joi.boolean().optional(),
  password_min_length_weak: Joi.number().integer().min(8).max(128).optional()
}).min(1).messages({
  'object.min': 'Pelo menos um campo deve ser fornecido para atualização'
});

