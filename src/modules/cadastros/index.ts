import { Router } from 'express';
import clientRegistrationsRoutes from './routes/clientRegistrations';
import clientConfigRoutes from './routes/clientConfig';
import analiseCreditoRoutes from './routes/analiseCredito';

/**
 * Módulo de Cadastros
 * Gerencia cadastros de clientes, configurações e análise de crédito
 */
export function registerCadastrosRoutes(router: Router) {
  router.use('/client-registrations', clientRegistrationsRoutes);
  router.use('/client-config', clientConfigRoutes);
  router.use('/analise-credito', analiseCreditoRoutes);
}

