'use client';

import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, ShoppingCart, FileText } from 'lucide-react';

const ReportsQuickWidget: React.FC = () => (
  <div className="card p-4 h-full min-w-0 border border-edge bg-surface-card">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-content-primary">Relatórios</h3>
      <Link
        to="/reports"
        className="text-xs text-primary-600 dark:text-primary-400 hover:underline rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        Ver todos →
      </Link>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
      <Link
        to="/reports"
        className="rounded-lg border border-edge p-3 hover:border-primary-500/40 transition-colors min-h-[44px] flex items-center gap-2 min-w-0"
      >
        <div className="bg-blue-500 p-2 rounded-md shrink-0">
          <BarChart3 className="w-4 h-4 text-white" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-content-primary truncate">Chamados</p>
          <p className="text-[10px] text-content-muted">SLA, volume…</p>
        </div>
      </Link>
      <Link
        to="/reports"
        className="rounded-lg border border-edge p-3 hover:border-primary-500/40 transition-colors min-h-[44px] flex items-center gap-2 min-w-0"
      >
        <div className="bg-green-500 p-2 rounded-md shrink-0">
          <ShoppingCart className="w-4 h-4 text-white" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-content-primary truncate">Compras</p>
          <p className="text-[10px] text-content-muted">Solicitações…</p>
        </div>
      </Link>
      <Link
        to="/reports"
        className="rounded-lg border border-edge p-3 hover:border-primary-500/40 transition-colors min-h-[44px] flex items-center gap-2 min-w-0"
      >
        <div className="bg-purple-500 p-2 rounded-md shrink-0">
          <FileText className="w-4 h-4 text-white" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-content-primary truncate">Personalizados</p>
          <p className="text-[10px] text-content-muted">Agendados</p>
        </div>
      </Link>
    </div>
  </div>
);

export default ReportsQuickWidget;
