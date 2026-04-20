import Joi from 'joi';

export const updateSystemConfigSchema = Joi.object({
  sla_first_response_hours: Joi.number().integer().min(1).max(168).optional(),
  sla_resolution_hours: Joi.number().integer().min(1).max(720).optional(),
  reopen_days: Joi.number().integer().min(1).max(30).optional(),
  max_file_size: Joi.number().integer().min(1024).max(104857600).optional(), // 1KB to 100MB
  allowed_file_types: Joi.string().min(1).max(500).optional(),
  email_notifications: Joi.boolean().optional(),
  // Aceita nomes com caracteres comuns de marca (ex.: "Prime+")
  system_name: Joi.string().min(1).max(255).optional(),
  system_subtitle: Joi.string().max(255).optional(),
  system_logo: Joi.string().max(500).optional(),
  system_version: Joi.string().min(1).max(50).optional()
}).min(1).messages({
  'object.min': 'Pelo menos um campo deve ser fornecido para atualização',
  'object.unknown': 'Campo não permitido: {{#label}}'
});
