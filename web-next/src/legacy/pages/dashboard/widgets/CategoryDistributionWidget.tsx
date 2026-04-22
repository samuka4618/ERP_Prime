'use client';

import React from 'react';
import { useDashboardData } from '../DashboardDataContext';

const CategoryDistributionWidget: React.FC = () => {
  const { stats } = useDashboardData();
  const list = stats?.tickets_by_category;
  if (!list?.length) {
    return (
      <div className="card p-4 h-full text-sm text-content-muted border border-edge bg-surface-card">
        Sem dados de categorias para o período.
      </div>
    );
  }
  const total = stats?.total_tickets || 0;
  return (
    <div className="card p-4 h-full min-w-0 border border-edge bg-surface-card">
      <h3 className="text-sm font-semibold text-content-primary mb-3">Chamados por categoria</h3>
      <div className="space-y-2">
        {list.map((category, index) => (
          <div key={index} className="flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs text-content-muted truncate">{category.category_name}</span>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-16 sm:w-24 bg-surface-muted rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full"
                  style={{ width: `${total > 0 ? (category.count / total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-medium text-content-primary w-6 text-right">{category.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryDistributionWidget;
