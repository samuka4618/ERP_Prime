import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import Profile from '../pages/Profile';
import Sessions from '../pages/Sessions';
import NotificationsPage from '../pages/Notifications';

/** Shell autenticado: core (dashboard, perfil, sessões, notificações). */
export const authenticatedCoreRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/dashboard" replace /> },
  { path: 'dashboard', element: <Dashboard /> },
  { path: 'profile', element: <Profile /> },
  { path: 'sessions', element: <Sessions /> },
  { path: 'notifications', element: <NotificationsPage /> },
];
