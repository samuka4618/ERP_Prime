import type { RouteObject } from 'react-router-dom';
import { PublicFormOnlyWrapper } from '../components/PublicFormOnlyGuard';
import PublicForm from '../pages/Descarregamento/PublicForm';
import DriverTracking from '../pages/Descarregamento/DriverTracking';
import PublicFormRestrito from '../pages/Descarregamento/PublicFormRestrito';

/** Formulários e acompanhamento públicos (URLs estáveis para QR / links). */
export const descarregamentoPublicRoutes: RouteObject[] = [
  {
    path: '/descarregamento/formulario/:id',
    element: (
      <PublicFormOnlyWrapper>
        <PublicForm />
      </PublicFormOnlyWrapper>
    ),
  },
  {
    path: '/descarregamento/formulario-publico',
    element: (
      <PublicFormOnlyWrapper>
        <PublicForm />
      </PublicFormOnlyWrapper>
    ),
  },
  {
    path: '/descarregamento/formulario-publico/:id',
    element: (
      <PublicFormOnlyWrapper>
        <PublicForm />
      </PublicFormOnlyWrapper>
    ),
  },
  {
    path: '/descarregamento/acompanhamento/:trackingCode',
    element: (
      <PublicFormOnlyWrapper>
        <DriverTracking />
      </PublicFormOnlyWrapper>
    ),
  },
  {
    path: '/descarregamento/restrito',
    element: <PublicFormRestrito />,
  },
];
