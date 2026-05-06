import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

function createRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  const headerRequestId = (req.headers['x-request-id'] as string | undefined)?.trim();
  const headerCorrelationId = (req.headers['x-correlation-id'] as string | undefined)?.trim();
  const requestId = headerRequestId || createRequestId();
  const correlationId = headerCorrelationId || requestId;

  res.setHeader('x-request-id', requestId);
  (req as any).requestId = requestId;

  logger.runWithRequestContext(
    {
      requestId,
      correlationId,
      userId: (req as any)?.user?.id
    },
    () => {
      logger.apiRequest(req.method, req.path, req.body, (req as any).user);

      res.on('finish', () => {
        logger.apiResponse(req.method, req.path, res.statusCode, Date.now() - startedAt);
      });

      next();
    }
  );
}
