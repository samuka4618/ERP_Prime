'use client';

import React from 'react';
import { UserPlus, Calendar, CreditCard, Send, Clock, CheckCircle, FileCheck } from 'lucide-react';
import { useDashboardData } from '../DashboardDataContext';

const RegistrationStatsWidget: React.FC = () => {
  const { registrationStats: r } = useDashboardData();
  if (!r) {
    return (
      <div className="card p-4 text-sm text-content-muted border border-edge bg-surface-card">
        Sem dados de cadastros para o período.
      </div>
    );
  }
  const cards = [
    { label: 'Total', value: Number(r.totalRegistrations ?? 0), icon: UserPlus, color: 'bg-blue-500' },
    { label: 'Hoje', value: Number(r.todayCount ?? 0), icon: Calendar, color: 'bg-green-500' },
    { label: 'Aguardando análise', value: Number(r.pendingAnalysisCount ?? 0), icon: CreditCard, color: 'bg-yellow-500' },
    { label: 'Enviados', value: Number(r.sentCount ?? 0), icon: Send, color: 'bg-orange-500' },
    { label: 'Em análise', value: Number(r.inAnalysisCount ?? 0), icon: Clock, color: 'bg-purple-500' },
    { label: 'Aprovados', value: Number(r.approvedCount ?? 0), icon: CheckCircle, color: 'bg-green-600' },
    { label: 'Finalizados', value: Number(r.completedCount ?? 0), icon: FileCheck, color: 'bg-gray-500' },
  ];
  return (
    <div className="card p-4 h-full min-w-0 border border-edge bg-surface-card">
      <h3 className="text-sm font-semibold text-content-primary mb-3">Cadastros de clientes</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 min-w-0">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-lg border border-edge p-2 flex items-center justify-between gap-1 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] text-content-muted truncate">{c.label}</p>
                <p className="text-lg font-bold text-content-primary">{c.value}</p>
              </div>
              <div className={`${c.color} p-1.5 rounded-md shrink-0`}>
                <Icon className="w-4 h-4 text-white" aria-hidden />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegistrationStatsWidget;
