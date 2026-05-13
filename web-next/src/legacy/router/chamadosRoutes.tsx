import type { RouteObject } from 'react-router-dom';
import { PermissionRoute, PermissionAnyRoute } from '../components/RouteGuards';
import Tickets from '../pages/Tickets';
import CreateTicket from '../pages/CreateTicket';
import TicketDetail from '../pages/TicketDetail';
import Categories from '../pages/Categories';
import Status from '../pages/Status';
import CategoryAssignments from '../pages/CategoryAssignments';
import FinanceApprovals from '../pages/FinanceApprovals';
import CardSubscriptions from '../pages/CardSubscriptions';

/** Módulo Chamados + categorias / status / assignments / fluxo financeiro cartão. */
export const chamadosRoutes: RouteObject[] = [
  { path: 'tickets', element: <Tickets /> },
  { path: 'tickets/new', element: <CreateTicket /> },
  { path: 'tickets/:id', element: <TicketDetail /> },
  {
    path: 'finance-approvals',
    element: (
      <PermissionRoute permission="chamados.finance_approval.approve">
        <FinanceApprovals />
      </PermissionRoute>
    ),
  },
  {
    path: 'card-subscriptions',
    element: (
      <PermissionAnyRoute permissions={['chamados.subscriptions.view', 'chamados.subscriptions.self']}>
        <CardSubscriptions />
      </PermissionAnyRoute>
    ),
  },
  { path: 'categories', element: <Categories /> },
  { path: 'status', element: <Status /> },
  { path: 'category-assignments', element: <CategoryAssignments /> },
];
