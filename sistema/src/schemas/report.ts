import Joi from 'joi';
import { ReportType, ReportFrequency } from '../types';

export const reportSchema = {
  create: Joi.object({
    name: Joi.string().required().min(3).max(255).messages({
      'string.empty': 'Nome do relatório é obrigatório',
      'string.min': 'Nome do relatório deve ter pelo menos 3 caracteres',
      'string.max': 'Nome do relatório deve ter no máximo 255 caracteres'
    }),
    description: Joi.string().optional().max(1000).messages({
      'string.max': 'Descrição deve ter no máximo 1000 caracteres'
    }),
    type: Joi.string().valid(...Object.values(ReportType)).required().messages({
      'any.only': 'Tipo de relatório inválido',
      'any.required': 'Tipo do relatório é obrigatório'
    }),
    parameters: Joi.object({
      start_date: Joi.string().isoDate().required().messages({
        'string.isoDate': 'Data de início deve estar no formato ISO (YYYY-MM-DD)',
        'any.required': 'Data de início é obrigatória'
      }),
      end_date: Joi.string().isoDate().required().messages({
        'string.isoDate': 'Data de fim deve estar no formato ISO (YYYY-MM-DD)',
        'any.required': 'Data de fim é obrigatória'
      }),
      category_ids: Joi.array().items(Joi.number().integer().positive()).optional().messages({
        'array.base': 'IDs de categorias devem ser um array',
        'number.integer': 'ID de categoria deve ser um número inteiro',
        'number.positive': 'ID de categoria deve ser positivo'
      }),
      attendant_ids: Joi.array().items(Joi.number().integer().positive()).optional().messages({
        'array.base': 'IDs de atendentes devem ser um array',
        'number.integer': 'ID de atendente deve ser um número inteiro',
        'number.positive': 'ID de atendente deve ser positivo'
      }),
      user_ids: Joi.array().items(Joi.number().integer().positive()).optional().messages({
        'array.base': 'IDs de usuários devem ser um array',
        'number.integer': 'ID de usuário deve ser um número inteiro',
        'number.positive': 'ID de usuário deve ser positivo'
      }),
      status: Joi.array().items(Joi.string().valid(
        'open', 'in_progress', 'pending_user', 'pending_third_party', 'resolved', 'closed'
      )).optional().messages({
        'array.base': 'Status devem ser um array',
        'any.only': 'Status inválido'
      }),
      priority: Joi.array().items(Joi.string().valid('low', 'medium', 'high', 'urgent')).optional().messages({
        'array.base': 'Prioridades devem ser um array',
        'any.only': 'Prioridade inválida'
      }),
      group_by: Joi.array().items(Joi.string().valid(
        'category', 'attendant', 'user', 'status', 'priority', 'date'
      )).optional().messages({
        'array.base': 'Agrupamentos devem ser um array',
        'any.only': 'Agrupamento inválido'
      }),
      include_charts: Joi.boolean().optional().default(true).messages({
        'boolean.base': 'Incluir gráficos deve ser um valor booleano'
      }),
      export_format: Joi.string().valid('json', 'csv', 'pdf', 'excel').optional().default('json').messages({
        'any.only': 'Formato de exportação inválido'
      })
    }).required().messages({
      'object.base': 'Parâmetros devem ser um objeto',
      'any.required': 'Parâmetros são obrigatórios'
    })
  }),

  update: Joi.object({
    name: Joi.string().optional().min(3).max(255).messages({
      'string.min': 'Nome do relatório deve ter pelo menos 3 caracteres',
      'string.max': 'Nome do relatório deve ter no máximo 255 caracteres'
    }),
    description: Joi.string().optional().max(1000).allow(null).messages({
      'string.max': 'Descrição deve ter no máximo 1000 caracteres'
    }),
    parameters: Joi.object({
      start_date: Joi.string().isoDate().optional().messages({
        'string.isoDate': 'Data de início deve estar no formato ISO (YYYY-MM-DD)'
      }),
      end_date: Joi.string().isoDate().optional().messages({
        'string.isoDate': 'Data de fim deve estar no formato ISO (YYYY-MM-DD)'
      }),
      category_ids: Joi.array().items(Joi.number().integer().positive()).optional().messages({
        'array.base': 'IDs de categorias devem ser um array',
        'number.integer': 'ID de categoria deve ser um número inteiro',
        'number.positive': 'ID de categoria deve ser positivo'
      }),
      attendant_ids: Joi.array().items(Joi.number().integer().positive()).optional().messages({
        'array.base': 'IDs de atendentes devem ser um array',
        'number.integer': 'ID de atendente deve ser um número inteiro',
        'number.positive': 'ID de atendente deve ser positivo'
      }),
      user_ids: Joi.array().items(Joi.number().integer().positive()).optional().messages({
        'array.base': 'IDs de usuários devem ser um array',
        'number.integer': 'ID de usuário deve ser um número inteiro',
        'number.positive': 'ID de usuário deve ser positivo'
      }),
      status: Joi.array().items(Joi.string().valid(
        'open', 'in_progress', 'pending_user', 'pending_third_party', 'resolved', 'closed'
      )).optional().messages({
        'array.base': 'Status devem ser um array',
        'any.only': 'Status inválido'
      }),
      priority: Joi.array().items(Joi.string().valid('low', 'medium', 'high', 'urgent')).optional().messages({
        'array.base': 'Prioridades devem ser um array',
        'any.only': 'Prioridade inválida'
      }),
      group_by: Joi.array().items(Joi.string().valid(
        'category', 'attendant', 'user', 'status', 'priority', 'date'
      )).optional().messages({
        'array.base': 'Agrupamentos devem ser um array',
        'any.only': 'Agrupamento inválido'
      }),
      include_charts: Joi.boolean().optional().messages({
        'boolean.base': 'Incluir gráficos deve ser um valor booleano'
      }),
      export_format: Joi.string().valid('json', 'csv', 'pdf', 'excel').optional().messages({
        'any.only': 'Formato de exportação inválido'
      })
    }).optional().messages({
      'object.base': 'Parâmetros devem ser um objeto'
    }),
    is_active: Joi.boolean().optional().messages({
      'boolean.base': 'Status ativo deve ser um valor booleano'
    })
  })
};

export const reportExecutionSchema = Joi.object({
  start_date: Joi.string().isoDate().required().messages({
    'string.isoDate': 'Data de início deve estar no formato ISO (YYYY-MM-DD)',
    'any.required': 'Data de início é obrigatória'
  }),
  end_date: Joi.string().isoDate().required().messages({
    'string.isoDate': 'Data de fim deve estar no formato ISO (YYYY-MM-DD)',
    'any.required': 'Data de fim é obrigatória'
  }),
  category_ids: Joi.array().items(Joi.number().integer().positive()).optional().messages({
    'array.base': 'IDs de categorias devem ser um array',
    'number.integer': 'ID de categoria deve ser um número inteiro',
    'number.positive': 'ID de categoria deve ser positivo'
  }),
  attendant_ids: Joi.array().items(Joi.number().integer().positive()).optional().messages({
    'array.base': 'IDs de atendentes devem ser um array',
    'number.integer': 'ID de atendente deve ser um número inteiro',
    'number.positive': 'ID de atendente deve ser positivo'
  }),
  user_ids: Joi.array().items(Joi.number().integer().positive()).optional().messages({
    'array.base': 'IDs de usuários devem ser um array',
    'number.integer': 'ID de usuário deve ser um número inteiro',
    'number.positive': 'ID de usuário deve ser positivo'
  }),
  status: Joi.array().items(Joi.string().valid(
    'open', 'in_progress', 'pending_user', 'pending_third_party', 'resolved', 'closed'
  )).optional().messages({
    'array.base': 'Status devem ser um array',
    'any.only': 'Status inválido'
  }),
  priority: Joi.array().items(Joi.string().valid('low', 'medium', 'high', 'urgent')).optional().messages({
    'array.base': 'Prioridades devem ser um array',
    'any.only': 'Prioridade inválida'
  }),
  group_by: Joi.array().items(Joi.string().valid(
    'category', 'attendant', 'user', 'status', 'priority', 'date'
  )).optional().messages({
    'array.base': 'Agrupamentos devem ser um array',
    'any.only': 'Agrupamento inválido'
  }),
  include_charts: Joi.boolean().optional().default(true).messages({
    'boolean.base': 'Incluir gráficos deve ser um valor booleano'
  }),
  export_format: Joi.string().valid('json', 'csv', 'pdf', 'excel').optional().default('json').messages({
    'any.only': 'Formato de exportação inválido'
  })
});

export const reportScheduleSchema = Joi.object({
  report_id: Joi.number().integer().positive().required().messages({
    'number.integer': 'ID do relatório deve ser um número inteiro',
    'number.positive': 'ID do relatório deve ser positivo',
    'any.required': 'ID do relatório é obrigatório'
  }),
  name: Joi.string().required().min(3).max(255).messages({
    'string.empty': 'Nome do agendamento é obrigatório',
    'string.min': 'Nome do agendamento deve ter pelo menos 3 caracteres',
    'string.max': 'Nome do agendamento deve ter no máximo 255 caracteres'
  }),
  frequency: Joi.string().valid(...Object.values(ReportFrequency)).required().messages({
    'any.only': 'Frequência inválida',
    'any.required': 'Frequência é obrigatória'
  }),
  day_of_week: Joi.number().integer().min(0).max(6).optional().messages({
    'number.integer': 'Dia da semana deve ser um número inteiro',
    'number.min': 'Dia da semana deve ser entre 0 (domingo) e 6 (sábado)',
    'number.max': 'Dia da semana deve ser entre 0 (domingo) e 6 (sábado)'
  }).when('frequency', {
    is: 'weekly',
    then: Joi.required().messages({
      'any.required': 'Dia da semana é obrigatório para frequência semanal'
    }),
    otherwise: Joi.forbidden()
  }),
  day_of_month: Joi.number().integer().min(1).max(31).optional().messages({
    'number.integer': 'Dia do mês deve ser um número inteiro',
    'number.min': 'Dia do mês deve ser entre 1 e 31',
    'number.max': 'Dia do mês deve ser entre 1 e 31'
  }).when('frequency', {
    is: 'monthly',
    then: Joi.required().messages({
      'any.required': 'Dia do mês é obrigatório para frequência mensal'
    }),
    otherwise: Joi.forbidden()
  }),
  time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
    'string.pattern.base': 'Horário deve estar no formato HH:MM (24h)',
    'any.required': 'Horário é obrigatório'
  }),
  recipients: Joi.array().items(Joi.string().email()).min(1).required().messages({
    'array.base': 'Destinatários devem ser um array',
    'array.min': 'Pelo menos um destinatário é obrigatório',
    'string.email': 'Email inválido',
    'any.required': 'Destinatários são obrigatórios'
  })
});
