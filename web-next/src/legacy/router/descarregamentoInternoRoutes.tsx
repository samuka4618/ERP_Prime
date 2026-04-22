import type { RouteObject } from 'react-router-dom';
import AgendamentosDescarregamento from '../pages/Descarregamento/Agendamentos';
import FornecedoresDescarregamento from '../pages/Descarregamento/Fornecedores';
import DescarregamentoConfig from '../pages/Descarregamento/DescarregamentoConfig';
import GradeDescarregamento from '../pages/Descarregamento/GradeDescarregamento';
import Docas from '../pages/Descarregamento/Docas';
import MotoristasPatio from '../pages/Descarregamento/MotoristasPatio';
import HistoricoDescarregamento from '../pages/Descarregamento/HistoricoDescarregamento';
import NovoAgendamento from '../pages/Descarregamento/NovoAgendamento';
import NovoFornecedor from '../pages/Descarregamento/NovoFornecedor';

/** Descarregamento autenticado (agendas, fornecedores, docas, etc.). */
export const descarregamentoInternoRoutes: RouteObject[] = [
  { path: 'descarregamento/agendamentos', element: <AgendamentosDescarregamento /> },
  { path: 'descarregamento/agendamentos/novo', element: <NovoAgendamento /> },
  { path: 'descarregamento/agendamentos/:id', element: <NovoAgendamento /> },
  { path: 'descarregamento/fornecedores', element: <FornecedoresDescarregamento /> },
  { path: 'descarregamento/fornecedores/novo', element: <NovoFornecedor /> },
  { path: 'descarregamento/fornecedores/:id/editar', element: <NovoFornecedor /> },
  { path: 'descarregamento/grade', element: <GradeDescarregamento /> },
  { path: 'descarregamento/docas', element: <Docas /> },
  { path: 'descarregamento/motoristas-patio', element: <MotoristasPatio /> },
  { path: 'descarregamento/historico', element: <HistoricoDescarregamento /> },
  { path: 'descarregamento-config', element: <DescarregamentoConfig /> },
];
