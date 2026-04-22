import type { RouteObject } from 'react-router-dom';
import SolicitacoesCompra from '../pages/Compras/SolicitacoesCompra';
import NovaSolicitacaoCompra from '../pages/Compras/NovaSolicitacaoCompra';
import SolicitacaoCompraDetail from '../pages/Compras/SolicitacaoCompraDetail';
import ComprasConfig from '../pages/Compras/ComprasConfig';
import NovoOrcamento from '../pages/Compras/NovoOrcamento';
import MinhasSolicitacoesComprador from '../pages/Compras/MinhasSolicitacoesComprador';
import SolicitacoesPendentesAprovacao from '../pages/Compras/SolicitacoesPendentesAprovacao';
import OrcamentosRecebidos from '../pages/Compras/OrcamentosRecebidos';
import OrcamentoDetail from '../pages/Compras/OrcamentoDetail';

/** Módulo Compras. */
export const comprasRoutes: RouteObject[] = [
  { path: 'compras/solicitacoes', element: <SolicitacoesCompra /> },
  { path: 'compras/solicitacoes/nova', element: <NovaSolicitacaoCompra /> },
  { path: 'compras/solicitacoes/:id', element: <SolicitacaoCompraDetail /> },
  {
    path: 'compras/solicitacoes/:solicitacaoId/orcamento/novo',
    element: <NovoOrcamento />,
  },
  { path: 'compras/orcamentos', element: <OrcamentosRecebidos /> },
  { path: 'compras/orcamentos/:id', element: <OrcamentoDetail /> },
  { path: 'compras/minhas-solicitacoes', element: <MinhasSolicitacoesComprador /> },
  { path: 'compras/pendentes-aprovacao', element: <SolicitacoesPendentesAprovacao /> },
  { path: 'compras-config', element: <ComprasConfig /> },
];
