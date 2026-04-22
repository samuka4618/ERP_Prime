'use client';

import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { apiService } from '../../../services/api';

type PerfDash = {
  uptime?: { percentage?: number; status?: string };
  users?: { peak?: number; current?: number };
};

const PerformanceSummaryWidget: React.FC = () => {
  const [data, setData] = useState<PerfDash | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = (await apiService.getPerformanceDashboard()) as PerfDash;
        if (alive) setData(d);
      } catch {
        if (alive) setErr('Indisponível');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (err) {
    return (
      <div className="card p-4 text-sm text-content-muted border border-edge bg-surface-card">
        Métricas de performance não disponíveis.
      </div>
    );
  }
  if (!data) {
    return <div className="h-24 animate-pulse rounded-xl bg-surface-muted border border-edge" />;
  }

  return (
    <div className="card p-4 h-full border border-edge bg-surface-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-content-primary">Performance</h3>
        <Activity className="w-4 h-4 text-content-subtle" aria-hidden />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-content-muted">Uptime</p>
          <p className="text-lg font-bold text-content-primary">{data.uptime?.percentage ?? '—'}%</p>
          <p className="text-content-subtle capitalize">{data.uptime?.status ?? ''}</p>
        </div>
        <div>
          <p className="text-content-muted">Utilizadores</p>
          <p className="text-lg font-bold text-content-primary">{data.users?.current ?? '—'}</p>
          <p className="text-content-subtle">Pico: {data.users?.peak ?? '—'}</p>
        </div>
      </div>
    </div>
  );
};

export default PerformanceSummaryWidget;
