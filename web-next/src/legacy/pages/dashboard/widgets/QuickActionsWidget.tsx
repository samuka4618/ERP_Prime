'use client';

import React from 'react';
import { Link } from 'react-router-dom';
import { Ticket, ShoppingCart, BarChart3, Users } from 'lucide-react';

const QuickActionsWidget: React.FC = () => (
  <div className="card p-4 h-full border border-edge bg-surface-card">
    <h3 className="text-sm font-semibold text-content-primary mb-3">Ações rápidas</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
      <Link to="/tickets/new" className="btn btn-primary flex items-center justify-center gap-2 min-h-[44px] text-sm">
        <Ticket className="w-4 h-4" aria-hidden />
        <span>Novo chamado</span>
      </Link>
      <Link
        to="/compras/solicitacoes/nova"
        className="btn btn-primary flex items-center justify-center gap-2 min-h-[44px] text-sm"
      >
        <ShoppingCart className="w-4 h-4" aria-hidden />
        <span>Nova solicitação</span>
      </Link>
      <Link to="/reports" className="btn btn-secondary flex items-center justify-center gap-2 min-h-[44px] text-sm">
        <BarChart3 className="w-4 h-4" aria-hidden />
        <span>Relatórios</span>
      </Link>
      <Link to="/users" className="btn btn-secondary flex items-center justify-center gap-2 min-h-[44px] text-sm">
        <Users className="w-4 h-4" aria-hidden />
        <span>Utilizadores</span>
      </Link>
    </div>
  </div>
);

export default QuickActionsWidget;
