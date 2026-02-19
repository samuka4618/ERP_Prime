// Re-exportar o middleware de autenticação do core
import { authenticate as _authenticate, authorize as _authorize, optionalAuth } from '../../../core/auth/middleware';

export { _authenticate as authenticate, _authorize as authorize, optionalAuth };

// Aliases para compatibilidade
export const authMiddleware = _authenticate;
export const requireRole = _authorize;

