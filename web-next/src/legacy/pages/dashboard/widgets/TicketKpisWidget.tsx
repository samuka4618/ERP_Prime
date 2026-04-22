'use client';

import React from 'react';
import { Ticket, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { useDashboardData } from '../DashboardDataContext';

const TicketKpisWidget: React.FC = () => {
  const { stats } = useDashboardData();
  if (!stats) {
    return <div className="text-sm text-content-muted">Sem dados de chamados.</div>;
  }

  const cards = [
    {
      title: 'Total de Chamados',
      value: stats.total_tickets || 0,
      icon: Ticket,
      color: 'bg-blue-500',
      change: `${stats.sla_first_response_rate || 0}%`,
      subtitle: 'Taxa SLA 1ª Resposta',
    },
    {
      title: 'Chamados Abertos',
      value: stats.open_tickets || 0,
      icon: AlertCircle,
      color: 'bg-yellow-500',
      change: `${stats.pending_user_tickets || 0}`,
      subtitle: 'Pendentes Usuário',
    },
    {
      title: 'Em Atendimento',
      value: stats.in_progress_tickets || 0,
      icon: Clock,
      color: 'bg-orange-500',
      change: `${stats.pending_third_party_tickets || 0}`,
      subtitle: 'Pendentes Terceiro',
    },
    {
      title: 'Aguardando Aprovação',
      value: stats.pending_approval_tickets || 0,
      icon: CheckCircle,
      color: 'bg-yellow-500',
      change: `${stats.pending_approval_tickets || 0}`,
      subtitle: 'Aguardando confirmação',
    },
    {
      title: 'Resolvidos',
      value: stats.resolved_tickets || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      change: `${stats.sla_resolution_rate || 0}%`,
      subtitle: 'Taxa SLA Resolução',
    },
    {
      title: 'Fechados',
      value: stats.closed_tickets || 0,
      icon: CheckCircle,
      color: 'bg-gray-500',
      change: `${stats.sla_violations || 0}`,
      subtitle: 'Violações SLA',
    },
    {
      title: 'Tempo Médio (h)',
      value: Math.round(stats.avg_resolution_time || 0),
      icon: TrendingUp,
      color: 'bg-purple-500',
      change: `${stats.total_users || 0}`,
      subtitle: 'Total Utilizadores',
    },
  ];

  return (
    <div className="card p-4 h-full min-w-0 border border-edge bg-surface-card">
      <h3 className="text-sm font-semibold text-content-primary mb-3">Indicadores de chamados</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-w-0">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="rounded-xl border border-edge p-3 bg-surface-muted/30 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-content-muted truncate">{card.title}</p>
                  <p className="text-xl font-bold text-content-primary">{card.value}</p>
                  <p className="text-[11px] text-content-subtle mt-1 truncate">
                    <span className="text-primary-600 dark:text-primary-400">{card.change}</span>{' '}
                    <span className="text-content-muted">{card.subtitle}</span>
                  </p>
                </div>
                <div className={`${card.color} p-2 rounded-lg shrink-0`}>
                  <Icon className="w-5 h-5 text-white" aria-hidden />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TicketKpisWidget;
