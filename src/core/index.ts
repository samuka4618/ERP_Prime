import { Router } from 'express';
import authRoutes from './auth/auth';
import userRoutes from './users/users';
import systemRoutes from './system/system';
import performanceRoutes from './system/performance';
import permissionRoutes from './permissions/permissions';

/**
 * Módulos Core do ERP
 * Funcionalidades essenciais: autenticação, usuários e sistema
 */
export function registerCoreRoutes(router: Router, authLimiter: any) {
  router.use('/auth', authLimiter, authRoutes);
  router.use('/users', userRoutes);
  router.use('/system', systemRoutes);
  router.use('/performance', performanceRoutes);
  router.use('/permissions', permissionRoutes);
}

