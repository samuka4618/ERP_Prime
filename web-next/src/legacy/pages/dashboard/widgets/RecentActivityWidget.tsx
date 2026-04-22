'use client';

import React from 'react';
import { Activity } from 'lucide-react';
import { useDashboardData } from '../DashboardDataContext';

function getTimeAgo(timestamp: Date) {
  if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) return 'Data inválida';
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
  if (diffInMinutes < 1) return 'Agora mesmo';
  if (diffInMinutes < 60) return `Há ${diffInMinutes} min`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Há ${diffInHours}h`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `Há ${diffInDays} dias`;
}

function activityColor(type: string) {
  switch (type) {
    case 'ticket_created':
      return 'bg-green-500';
    case 'ticket_resolved':
      return 'bg-blue-500';
    case 'ticket_closed':
      return 'bg-gray-500';
    case 'ticket_reopened':
      return 'bg-yellow-500';
    case 'ticket_updated':
      return 'bg-purple-500';
    default:
      return 'bg-gray-400';
  }
}

const RecentActivityWidget: React.FC = () => {
  const { recentActivity } = useDashboardData();
  return (
    <div className="card p-4 h-full min-h-0 min-w-0 flex flex-col border border-edge bg-surface-card">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-sm font-semibold text-content-primary">Atividade recente</h3>
        <Activity className="w-4 h-4 text-content-subtle" aria-hidden />
      </div>
      <div className="space-y-2 overflow-y-auto min-h-0 min-w-0 flex-1">
        {recentActivity.length > 0 ? (
          recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-start gap-2 min-w-0">
              <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${activityColor(activity.type)}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-content-primary truncate">{activity.title}</p>
                <p className="text-xs text-content-muted line-clamp-2">{activity.description}</p>
                <p className="text-[11px] text-content-subtle">
                  {getTimeAgo(activity.timestamp)} • {activity.user_name}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-content-muted text-center py-4">Nenhuma atividade recente</p>
        )}
      </div>
    </div>
  );
};

export default RecentActivityWidget;
