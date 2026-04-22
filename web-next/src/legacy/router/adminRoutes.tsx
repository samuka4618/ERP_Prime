import type { RouteObject } from 'react-router-dom';
import Users from '../pages/Users';
import PermissionsPage from '../pages/Permissions';
import SystemConfig from '../pages/SystemConfig';
import SystemSettings from '../pages/SystemSettings';
import Reports from '../pages/Reports';
import Audit from '../pages/Audit';
import BackupRestore from '../pages/BackupRestore';

/** Administração e sistema. */
export const adminRoutes: RouteObject[] = [
  { path: 'users', element: <Users /> },
  { path: 'permissions', element: <PermissionsPage /> },
  { path: 'system-config', element: <SystemConfig /> },
  { path: 'system-settings', element: <SystemSettings /> },
  { path: 'reports', element: <Reports /> },
  { path: 'audit', element: <Audit /> },
  { path: 'backup', element: <BackupRestore /> },
];
