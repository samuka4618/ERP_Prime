import Joi from 'joi';

export const createTicketSchema = Joi.object({
  category_id: Joi.number().integer().positive().required(),
  subject: Joi.string().min(5).max(255).required(),
  description: Joi.string().min(10).required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  custom_data: Joi.object().pattern(Joi.string(), Joi.any()).optional()
});

export const updateTicketSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'pending_user', 'pending_third_party', 'resolved', 'closed', 'overdue_first_response', 'overdue_resolution').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  attendantId: Joi.number().integer().positive().optional()
}).min(1).unknown(false).messages({
  'object.min': 'Pelo menos um campo deve ser fornecido para atualização',
  'object.unknown': 'Campo não permitido: {{#label}}'
});

export const assignTicketSchema = Joi.object({
  attendantId: Joi.number().integer().positive().required()
});

export const addMessageSchema = Joi.object({
  message: Joi.string().min(1).required(),
  attachment: Joi.string().optional()
});

export const ticketQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(255),
  status: Joi.string().valid('open', 'in_progress', 'pending_user', 'pending_third_party', 'resolved', 'closed'),
  category_id: Joi.number().integer().positive(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent')
});
