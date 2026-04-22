'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { useDashboardData } from '../DashboardDataContext';

const SlaPanelWidget: React.FC = () => {
  const { stats } = useDashboardData();
  if (!stats) return <div className="text-sm text-content-muted">Sem dados de SLA.</div>;

  return (
    <div className="card p-4 h-full min-w-0 border border-edge bg-surface-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-content-primary">Estado do SLA</h3>
        <Calendar className="w-4 h-4 text-content-subtle" aria-hidden />
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1 text-content-muted">
            <span>Primeira resposta</span>
            <span>{stats.sla_first_response_rate || 0}%</span>
          </div>
          <div className="w-full bg-surface-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                (stats.sla_first_response_rate || 0) >= 90
                  ? 'bg-green-500'
                  : (stats.sla_first_response_rate || 0) >= 70
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${stats.sla_first_response_rate || 0}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1 text-content-muted">
            <span>Resolução</span>
            <span>{stats.sla_resolution_rate || 0}%</span>
          </div>
          <div className="w-full bg-surface-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                (stats.sla_resolution_rate || 0) >= 90
                  ? 'bg-green-500'
                  : (stats.sla_resolution_rate || 0) >= 70
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${stats.sla_resolution_rate || 0}%` }}
            />
          </div>
        </div>
        <p
          className={`text-xs font-medium ${
            (stats.sla_violations || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          }`}
        >
          {stats.sla_violations || 0} violações de SLA
        </p>
      </div>
    </div>
  );
};

export default SlaPanelWidget;
