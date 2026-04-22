import type { RouteObject } from 'react-router-dom';
import Tickets from '../pages/Tickets';
import CreateTicket from '../pages/CreateTicket';
import TicketDetail from '../pages/TicketDetail';
import Categories from '../pages/Categories';
import Status from '../pages/Status';
import CategoryAssignments from '../pages/CategoryAssignments';

/** Módulo Chamados + categorias / status / assignments. */
export const chamadosRoutes: RouteObject[] = [
  { path: 'tickets', element: <Tickets /> },
  { path: 'tickets/new', element: <CreateTicket /> },
  { path: 'tickets/:id', element: <TicketDetail /> },
  { path: 'categories', element: <Categories /> },
  { path: 'status', element: <Status /> },
  { path: 'category-assignments', element: <CategoryAssignments /> },
];
