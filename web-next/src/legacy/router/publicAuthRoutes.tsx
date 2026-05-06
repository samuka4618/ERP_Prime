import type { RouteObject } from 'react-router-dom';
import { PublicRoute, ProtectedRoute } from '../components/RouteGuards';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForcePasswordChangePage from '../pages/ForcePasswordChangePage';

/** Login e registo (Fase “público / auth”). */
export const publicAuthRoutes: RouteObject[] = [
  {
    path: '/forcar-troca-senha',
    element: (
      <ProtectedRoute bypassMandatoryPassword>
        <ForcePasswordChangePage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <Register />
      </PublicRoute>
    ),
  },
];
