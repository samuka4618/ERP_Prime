import Joi from 'joi';

export const clientRegistrationSchema = Joi.object({
  nome_cliente: Joi.string().max(255).required().messages({
    'string.empty': 'Nome do cliente é obrigatório',
    'string.max': 'Nome do cliente deve ter no máximo 255 caracteres',
    'any.required': 'Nome do cliente é obrigatório'
  }),
  
  nome_fantasia: Joi.string().max(255).optional().allow('').messages({
    'string.max': 'Nome fantasia deve ter no máximo 255 caracteres'
  }),
  
  cnpj: Joi.string()
    .regex(/^\d{14}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/)
    .required()
    .messages({
      'string.empty': 'CNPJ é obrigatório',
      'string.pattern.base': 'CNPJ deve ter 14 dígitos ou estar no formato 12.345.678/0001-90',
      'any.required': 'CNPJ é obrigatório'
    }),
  
  email: Joi.string()
    .email()
    .max(255)
    .required()
    .messages({
      'string.empty': 'Email é obrigatório',
      'string.email': 'Email deve ter um formato válido',
      'string.max': 'Email deve ter no máximo 255 caracteres',
      'any.required': 'Email é obrigatório'
    }),
  
  ramo_atividade_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Ramo de atividade deve ser um número',
    'number.integer': 'Ramo de atividade deve ser um número inteiro',
    'number.positive': 'Ramo de atividade deve ser um número positivo',
    'any.required': 'Ramo de atividade é obrigatório'
  }),
  
  vendedor_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Vendedor deve ser um número',
    'number.integer': 'Vendedor deve ser um número inteiro',
    'number.positive': 'Vendedor deve ser um número positivo',
    'any.required': 'Vendedor é obrigatório'
  }),
  
  gestor_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Gestor deve ser um número',
    'number.integer': 'Gestor deve ser um número inteiro',
    'number.positive': 'Gestor deve ser um número positivo',
    'any.required': 'Gestor é obrigatório'
  }),
  
  codigo_carteira_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Código da carteira deve ser um número',
    'number.integer': 'Código da carteira deve ser um número inteiro',
    'number.positive': 'Código da carteira deve ser um número positivo',
    'any.required': 'Código da carteira é obrigatório'
  }),
  
  lista_preco_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Lista de preço deve ser um número',
    'number.integer': 'Lista de preço deve ser um número inteiro',
    'number.positive': 'Lista de preço deve ser um número positivo',
    'any.required': 'Lista de preço é obrigatória'
  }),
  
  forma_pagamento_desejada_id: Joi.number().integer().positive().required().messages({
    'number.base': 'Forma de pagamento desejada deve ser um número',
    'number.integer': 'Forma de pagamento desejada deve ser um número inteiro',
    'number.positive': 'Forma de pagamento desejada deve ser um número positivo',
    'any.required': 'Forma de pagamento desejada é obrigatória'
  }),
  
  prazo_desejado: Joi.number().integer().min(1).max(365).optional().messages({
    'number.base': 'Prazo desejado deve ser um número',
    'number.integer': 'Prazo desejado deve ser um número inteiro',
    'number.min': 'Prazo desejado deve ser pelo menos 1 dia',
    'number.max': 'Prazo desejado deve ser no máximo 365 dias'
  }),
  
  periodicidade_pedido: Joi.string().max(100).optional().allow('').messages({
    'string.max': 'Periodicidade de pedido deve ter no máximo 100 caracteres'
  }),
  
  valor_estimado_pedido: Joi.number().precision(2).min(0).optional().messages({
    'number.base': 'Valor estimado de pedido deve ser um número',
    'number.min': 'Valor estimado de pedido deve ser maior ou igual a zero',
    'number.precision': 'Valor estimado de pedido deve ter no máximo 2 casas decimais'
  }),
  
  forma_contato: Joi.string().max(255).optional().allow('').messages({
    'string.max': 'Forma de contato deve ter no máximo 255 caracteres'
  }),
  
  whatsapp_cliente: Joi.string().max(20).optional().allow('').messages({
    'string.max': 'WhatsApp do cliente deve ter no máximo 20 caracteres'
  }),
  
  rede_social: Joi.string().max(255).optional().allow('').messages({
    'string.max': 'Rede social deve ter no máximo 255 caracteres'
  }),
  
  link_google_maps: Joi.string().uri().max(500).optional().allow('').messages({
    'string.uri': 'Link do Google Maps deve ser uma URL válida',
    'string.max': 'Link do Google Maps deve ter no máximo 500 caracteres'
  })
});

export const updateClientRegistrationStatusSchema = Joi.object({
  status: Joi.string()
    .valid('cadastro_enviado', 'aguardando_analise_credito', 'cadastro_finalizado')
    .required()
    .messages({
      'any.only': 'Status deve ser: cadastro_enviado, aguardando_analise_credito ou cadastro_finalizado',
      'any.required': 'Status é obrigatório'
    }),
  
  observacoes: Joi.string().max(1000).optional().allow('').messages({
    'string.max': 'Observações devem ter no máximo 1000 caracteres'
  }),
  
  prazo_aprovado: Joi.string().max(50).optional().allow('').messages({
    'string.max': 'Prazo aprovado deve ter no máximo 50 caracteres'
  }),
  
  limite_aprovado: Joi.string().max(50).optional().allow('').messages({
    'string.max': 'Limite aprovado deve ter no máximo 50 caracteres'
  })
});

export const clientConfigSchema = Joi.object({
  nome: Joi.string().max(255).required().messages({
    'string.empty': 'Nome é obrigatório',
    'string.max': 'Nome deve ter no máximo 255 caracteres',
    'any.required': 'Nome é obrigatório'
  }),
  
  descricao: Joi.string().max(500).optional().allow('').messages({
    'string.max': 'Descrição deve ter no máximo 500 caracteres'
  })
});

export const updateClientConfigSchema = Joi.object({
  nome: Joi.string().max(255).optional().messages({
    'string.max': 'Nome deve ter no máximo 255 caracteres'
  }),
  
  descricao: Joi.string().max(500).optional().allow('').messages({
    'string.max': 'Descrição deve ter no máximo 500 caracteres'
  }),
  
  is_active: Joi.boolean().optional().messages({
    'boolean.base': 'Status ativo deve ser verdadeiro ou falso'
  })
});

export const clientRegistrationFiltersSchema = Joi.object({
  status: Joi.string()
    .valid('cadastro_enviado', 'aguardando_analise_credito', 'cadastro_finalizado')
    .optional(),
  
  user_id: Joi.number().integer().positive().optional(),
  
  cnpj: Joi.string().max(18).optional().allow(''),
  
  nome_cliente: Joi.string().max(255).optional().allow(''),
  
  email: Joi.string().email().max(255).optional().allow(''),
  
  page: Joi.number().integer().min(1).default(1),
  
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const validateClientRegistration = (data: any) => {
  const { error, value } = clientRegistrationSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    throw new Error(`Dados inválidos: ${errorMessages.join(', ')}`);
  }
  
  return value;
};

export const validateUpdateStatus = (data: any) => {
  const { error, value } = updateClientRegistrationStatusSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    throw new Error(`Dados inválidos: ${errorMessages.join(', ')}`);
  }
  
  return value;
};

export const validateClientConfig = (data: any) => {
  const { error, value } = clientConfigSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    throw new Error(`Dados inválidos: ${errorMessages.join(', ')}`);
  }
  
  return value;
};

export const validateFilters = (data: any) => {
  const { error, value } = clientRegistrationFiltersSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    throw new Error(`Filtros inválidos: ${errorMessages.join(', ')}`);
  }
  
  return value;
};
