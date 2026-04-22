'use client';

import { createBrowserRouter } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import Layout from '../components/Layout';
import { ProtectedRoute } from '../components/RouteGuards';
import { PublicFormRoot } from './PublicFormRoot';
import { publicAuthRoutes } from './publicAuthRoutes';
import { descarregamentoPublicRoutes } from './descarregamentoPublicRoutes';
import { authenticatedCoreRoutes } from './authenticatedCoreRoutes';
import { chamadosRoutes } from './chamadosRoutes';
import { cadastrosRoutes } from './cadastrosRoutes';
import { comprasRoutes } from './comprasRoutes';
import { descarregamentoInternoRoutes } from './descarregamentoInternoRoutes';
import { adminRoutes } from './adminRoutes';

const authenticatedChildRoutes: RouteObject[] = [
  ...authenticatedCoreRoutes,
  ...chamadosRoutes,
  ...cadastrosRoutes,
  ...comprasRoutes,
  ...descarregamentoInternoRoutes,
  ...adminRoutes,
];

/**
 * Router único da aplicação (React Router 6.4+ data API).
 * Rotas agrupadas por domínio em ficheiros em `legacy/router/*`.
 */
export const appRouter = createBrowserRouter(
  [
    {
      element: <PublicFormRoot />,
      children: [
        ...publicAuthRoutes,
        ...descarregamentoPublicRoutes,
        {
          path: '/',
          element: (
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          ),
          children: authenticatedChildRoutes,
        },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  }
);
