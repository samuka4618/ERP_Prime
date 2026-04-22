'use client';

import dynamic from 'next/dynamic';
import { StrictMode } from 'react';

const RouterShell = dynamic(
  () => import('@/legacy/router/RouterShell').then((m) => ({ default: m.RouterShell })),
  { ssr: false }
);

export default function ErpHome() {
  return (
    <StrictMode>
      <RouterShell />
    </StrictMode>
  );
}
