import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    console.log('🔍 DEBUG VALIDATION - Validando dados:', req.body);
    console.log('🔍 DEBUG VALIDATION - Schema:', schema.describe());
    
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: false 
    });
    
    if (error) {
      console.log('❌ ERRO DE VALIDAÇÃO NO MIDDLEWARE:', error.details);
      res.status(400).json({ 
        error: 'Dados inválidos', 
        details: error.details.map(detail => detail.message) 
      });
      return;
    }
    
    console.log('✅ VALIDAÇÃO PASSOU - Dados validados:', value);
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      res.status(400).json({ 
        error: 'Parâmetros de consulta inválidos', 
        details: error.details.map(detail => detail.message) 
      });
      return;
    }
    
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      res.status(400).json({ 
        error: 'Parâmetros inválidos', 
        details: error.details.map(detail => detail.message) 
      });
      return;
    }
    
    next();
  };
};

// Alias para compatibilidade
export const validateRequest = validate;