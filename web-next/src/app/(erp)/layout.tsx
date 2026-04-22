import type { ReactNode } from 'react';

/**
 * Grupo de rotas Next (URL inalterada). O UI principal continua a ser o RouterShell
 * (React Router) até migração gradual para page.tsx por rota.
 */
export default function ErpRouteGroupLayout({ children }: { children: ReactNode }) {
  return children;
}
