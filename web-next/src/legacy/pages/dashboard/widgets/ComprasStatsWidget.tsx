'use client';

import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Clock, Package, CheckCircle } from 'lucide-react';
import { useDashboardData } from '../DashboardDataContext';

const ComprasStatsWidget: React.FC = () => {
  const { comprasStats: c } = useDashboardData();
  if (!c) {
    return (
      <div className="card p-4 text-sm text-content-muted border border-edge bg-surface-card">
        Sem dados de compras para o período.
      </div>
    );
  }
  return (
    <div className="card p-4 h-full min-w-0 border border-edge bg-surface-card">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold text-content-primary">Compras</h3>
        <Link
          to="/compras/solicitacoes"
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          Ver todas →
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 min-w-0">
        <div className="rounded-lg border border-edge p-2 min-w-0">
          <p className="text-[10px] text-content-muted">Solicitações</p>
          <p className="text-lg font-bold">{Number(c.total ?? 0)}</p>
          <p className="text-[10px] text-content-subtle truncate">
            Total R$ {Number(c.total_value ?? 0).toFixed(2).replace('.', ',')}
          </p>
          <ShoppingCart className="w-4 h-4 mt-1 text-blue-500" aria-hidden />
        </div>
        <div className="rounded-lg border border-edge p-2">
          <p className="text-[10px] text-content-muted">Pendentes aprovação</p>
          <p className="text-lg font-bold">{Number(c.pending_approval ?? 0)}</p>
          <Clock className="w-4 h-4 mt-1 text-yellow-500" aria-hidden />
        </div>
        <div className="rounded-lg border border-edge p-2">
          <p className="text-[10px] text-content-muted">Em cotação</p>
          <p className="text-lg font-bold">{Number(c.in_quotation ?? 0)}</p>
          <Package className="w-4 h-4 mt-1 text-orange-500" aria-hidden />
        </div>
        <div className="rounded-lg border border-edge p-2">
          <p className="text-[10px] text-content-muted">Aprovadas</p>
          <p className="text-lg font-bold">{Number(c.approved ?? 0)}</p>
          <CheckCircle className="w-4 h-4 mt-1 text-green-500" aria-hidden />
        </div>
      </div>
    </div>
  );
};

export default ComprasStatsWidget;
