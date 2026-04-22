import type { Layout, Layouts } from 'react-grid-layout';

const lg: Layout[] = [
  { i: 'ticket-kpis', x: 0, y: 0, w: 12, h: 7, minW: 6, minH: 4 },
  { i: 'recent-activity', x: 0, y: 7, w: 6, h: 9, minW: 3, minH: 4 },
  { i: 'sla-panel', x: 6, y: 7, w: 6, h: 9, minW: 3, minH: 4 },
  { i: 'category-dist', x: 0, y: 16, w: 12, h: 7, minW: 4, minH: 3 },
  { i: 'registration-block', x: 0, y: 23, w: 12, h: 8, minW: 4, minH: 3 },
  { i: 'compras-block', x: 0, y: 31, w: 12, h: 7, minW: 4, minH: 3 },
  { i: 'reports-quick', x: 0, y: 38, w: 12, h: 8, minW: 4, minH: 3 },
  { i: 'quick-actions', x: 0, y: 46, w: 12, h: 6, minW: 4, minH: 3 },
  { i: 'performance-summary', x: 0, y: 52, w: 12, h: 7, minW: 4, minH: 3 },
];

export const DEFAULT_DASHBOARD_LAYOUTS: Layouts = {
  lg,
  md: lg.map((c) => ({ ...c, w: Math.min(c.w, 10) })),
  sm: lg.map((c, idx) => ({ ...c, w: 6, x: 0, y: idx * 6 })),
  xs: lg.map((c, idx) => ({ ...c, w: 4, x: 0, y: idx * 5 })),
};
