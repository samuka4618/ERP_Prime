import type { RouteObject } from 'react-router-dom';
import { PublicRoute } from '../components/RouteGuards';
import Login from '../pages/Login';
import Register from '../pages/Register';

/** Login e registo (Fase “público / auth”). */
export const publicAuthRoutes: RouteObject[] = [
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
