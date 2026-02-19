import { Router } from 'express';
import solicitacoesRoutes from './routes/solicitacoes';
import orcamentosRoutes from './routes/orcamentos';
import aprovadoresRoutes from './routes/aprovadores';
import compradoresRoutes from './routes/compradores';
import anexosRoutes from './routes/anexos';

/**
 * Módulo de Compras
 * Gerencia solicitações de compra, orçamentos, aprovações e compradores
 */
export function registerComprasRoutes(router: Router) {
  router.use('/solicitacoes-compra', solicitacoesRoutes);
  router.use('/orcamentos', orcamentosRoutes);
  router.use('/aprovadores', aprovadoresRoutes);
  router.use('/compradores', compradoresRoutes);
  router.use('/compras-anexos', anexosRoutes);
}

