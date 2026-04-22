import React, { lazy, Suspense } from 'react';

export type WidgetDefinition = {
  id: string;
  title: string;
  requiredPermission?: string;
  requiredAny?: string[];
};

export const DASHBOARD_WIDGETS: WidgetDefinition[] = [
  { id: 'ticket-kpis', title: 'Chamados (KPIs)', requiredPermission: 'tickets.view' },
  { id: 'recent-activity', title: 'Atividade recente', requiredPermission: 'tickets.view' },
  { id: 'sla-panel', title: 'SLA', requiredPermission: 'tickets.view' },
  { id: 'category-dist', title: 'Por categoria', requiredPermission: 'tickets.view' },
  { id: 'registration-block', title: 'Cadastros', requiredPermission: 'registrations.view' },
  {
    id: 'compras-block',
    title: 'Compras',
    requiredAny: ['compras.solicitacoes.view', 'compras.orcamentos.view', 'compras.acompanhamento.view'],
  },
  { id: 'reports-quick', title: 'Relatórios', requiredPermission: 'reports.view' },
  { id: 'quick-actions', title: 'Ações rápidas' },
  {
    id: 'performance-summary',
    title: 'Performance do sistema',
    requiredAny: ['performance.view', 'performance.manage'],
  },
];

const loaders: Record<string, React.LazyExoticComponent<React.FC>> = {
  'ticket-kpis': lazy(() => import('./widgets/TicketKpisWidget')),
  'recent-activity': lazy(() => import('./widgets/RecentActivityWidget')),
  'sla-panel': lazy(() => import('./widgets/SlaPanelWidget')),
  'category-dist': lazy(() => import('./widgets/CategoryDistributionWidget')),
  'registration-block': lazy(() => import('./widgets/RegistrationStatsWidget')),
  'compras-block': lazy(() => import('./widgets/ComprasStatsWidget')),
  'reports-quick': lazy(() => import('./widgets/ReportsQuickWidget')),
  'quick-actions': lazy(() => import('./widgets/QuickActionsWidget')),
  'performance-summary': lazy(() => import('./widgets/PerformanceSummaryWidget')),
};

export function WidgetMount({ id }: { id: string }) {
  const Comp = loaders[id];
  if (!Comp) return null;
  return (
    <Suspense
      fallback={<div className="h-full min-h-[120px] animate-pulse rounded-xl bg-surface-muted border border-edge" />}
    >
      <Comp />
    </Suspense>
  );
}
