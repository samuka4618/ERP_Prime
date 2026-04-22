'use client';

import { RouterProvider } from 'react-router-dom';
import { appRouter } from './createAppRouter';

export function RouterShell() {
  return <RouterProvider router={appRouter} />;
}
