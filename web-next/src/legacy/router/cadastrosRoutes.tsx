import type { RouteObject } from 'react-router-dom';
import { ClientRegistrations } from '../pages/ClientRegistrations';
import { ClientRegistrationForm } from '../pages/ClientRegistrationForm';
import { ClientRegistrationDetail } from '../pages/ClientRegistrationDetail';
import CadastrosConfig from '../pages/CadastrosConfig';

/** Cadastros de clientes e configuração. */
export const cadastrosRoutes: RouteObject[] = [
  { path: 'client-registrations', element: <ClientRegistrations /> },
  { path: 'client-registrations/new', element: <ClientRegistrationForm /> },
  { path: 'client-registrations/:id', element: <ClientRegistrationDetail /> },
  { path: 'client-registrations/:id/edit', element: <ClientRegistrationForm /> },
  { path: 'cadastros-config', element: <CadastrosConfig /> },
];
