import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let { statusCode = 500, message } = error;

  // Se for erro de validação do Joi
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Dados inválidos';
  }

  // Se for erro de sintaxe JSON
  if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = 'JSON inválido';
  }

  // Se for erro de JWT
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token inválido';
  }

  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expirado';
  }

  const isOperational = statusCode >= 400 && statusCode < 500 && (error.isOperational ?? error.statusCode != null);
  const logPayload = {
    message: error.message,
    url: req.url,
    method: req.method,
    statusCode,
    ...(isOperational ? {} : { stack: error.stack, ip: req.ip, userAgent: req.get('User-Agent') })
  };
  if (isOperational) {
    console.warn('Erro operacional (4xx):', logPayload);
  } else {
    console.error('Erro:', logPayload);
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && !isOperational && { stack: error.stack })
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
  const error = new Error(`Rota não encontrada: ${req.originalUrl}`) as AppError;
  error.statusCode = 404;
  next(error);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
