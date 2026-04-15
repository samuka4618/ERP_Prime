import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.internalAuthToken) {
    res.status(503).json({ error: 'Servidor sem INTERNAL_AUTH_TOKEN configurado' });
    return;
  }
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== config.internalAuthToken) {
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }
  next();
}
