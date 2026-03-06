import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    logger.debug('VALIDATION - Validando dados', req.body, 'VALIDATION');
    logger.debug('VALIDATION - Schema', schema.describe() as any, 'VALIDATION');

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: false
    });

    if (error) {
      logger.debug('ERRO DE VALIDAÇÃO', error.details, 'VALIDATION');
      res.status(400).json({
        error: 'Dados inválidos',
        details: error.details.map(detail => detail.message)
      });
      return;
    }

    logger.debug('VALIDAÇÃO PASSOU', value, 'VALIDATION');
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