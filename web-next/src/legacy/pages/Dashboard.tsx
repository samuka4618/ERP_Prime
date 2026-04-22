'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout';
import { Filter, Calendar, Settings, RefreshCw } from 'lucide-react';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useUiPreferences } from '../contexts/UiPreferencesContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { dashboardMessages } from '../messages/dashboard';
import { DashboardDataProvider, useDashboardData, type DatePreset } from './dashboard/DashboardDataContext';
import { DEFAULT_DASHBOARD_LAYOUTS } from './dashboard/defaultLayouts';
import { DASHBOARD_WIDGETS, WidgetMount } from './dashboard/widgetRegistry';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

function filterLayoutsByWidgets(layouts: Layouts, allowed: Set<string>): Layouts {
  const out: Layouts = {};
  for (const [bp, arr] of Object.entries(layouts)) {
    out[bp] = (arr as Layout[]).filter((l) => allowed.has(l.i));
  }
  return out;
}

function mergeSavedWithDefaults(saved: Layouts | undefined, allowed: Set<string>): Layouts {
  const base = saved && Object.keys(saved).length ? saved : DEFAULT_DASHBOARD_LAYOUTS;
  return filterLayoutsByWidgets(base, allowed);
}

const DashboardInner: React.FC = () => {
  const { config } = useSystemConfig();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { preferences, updatePreferences } = useUiPreferences();
  const {
    stats,
    loading,
    loadError,
    fetchData,
    datePreset,
    setDatePreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    showCustomDates,
    setShowCustomDates,
    getDateRange,
  } = useDashboardData();

  const systemName = config?.system_name || 'ERP PRIME';
  const canCustomize = hasPermission('dashboard.customize');
  const [editMode, setEditMode] = useState(false);

  const allowedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const w of DASHBOARD_WIDGETS) {
      let ok = true;
      if (w.requiredAny?.length) ok = hasAnyPermission(...w.requiredAny);
      else if (w.requiredPermission) ok = hasPermission(w.requiredPermission);
      if (ok) ids.add(w.id);
    }
    return ids;
  }, [hasPermission, hasAnyPermission]);

  const savedLayouts = preferences.dashboard?.layouts as Layouts | undefined;

  const [layouts, setLayouts] = useState<Layouts>(() =>
    filterLayoutsByWidgets(DEFAULT_DASHBOARD_LAYOUTS, allowedIds)
  );

  useEffect(() => {
    if (editMode) return;
    setLayouts(mergeSavedWithDefaults(savedLayouts, allowedIds));
  }, [savedLayouts, allowedIds, editMode]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    setShowCustomDates(preset === 'custom');
  };

  const onLayoutChange = useCallback(
    (_current: unknown, all: Layouts) => {
      if (editMode) setLayouts(all);
    },
    [editMode]
  );

  const saveLayouts = async () => {
    await updatePreferences({ dashboard: { layouts } });
    setEditMode(false);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setLayouts(mergeSavedWithDefaults(savedLayouts, allowedIds));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      {(loadError || !stats) && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-3">
          <span>
            {loadError ? dashboardMessages.loadFailed : dashboardMessages.statsMissing}
          </span>
          <button
            type="button"
            onClick={() => fetchData()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500 min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" aria-hidden />
            {dashboardMessages.retry}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-content-primary">Dashboard</h1>
          <p className="text-content-muted">Visão geral do {systemName}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {canCustomize && (
            <>
              {!editMode ? (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="btn btn-outline min-h-[44px] px-4"
                >
                  Personalizar dashboard
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => void saveLayouts()} className="btn btn-primary min-h-[44px] px-4">
                    Guardar layout
                  </button>
                  <button type="button" onClick={cancelEdit} className="btn btn-outline min-h-[44px] px-4">
                    Cancelar
                  </button>
                </>
              )}
            </>
          )}
          <Link to="/system-settings" className="btn btn-outline flex items-center gap-2 min-h-[44px]">
            <Settings className="w-4 h-4" aria-hidden />
            <span>Configurações</span>
          </Link>
        </div>
      </div>

      <div className="card p-4 border border-edge bg-surface-card min-w-0">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-5 h-5 text-content-muted" aria-hidden />
            <span className="font-medium text-content-primary text-sm">Filtrar por período</span>
          </div>
          <div className="flex flex-wrap gap-2 flex-1 min-w-0">
            {(
              [
                ['all', 'Todos'],
                ['today', 'Hoje'],
                ['last7days', 'Últimos 7 dias'],
                ['last30days', 'Últimos 30 dias'],
                ['thisMonth', 'Este mês'],
                ['lastMonth', 'Mês passado'],
                ['custom', 'Personalizado'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePresetChange(key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium min-h-[40px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                  datePreset === key
                    ? 'bg-primary-600 text-white'
                    : 'bg-surface-muted text-content-primary hover:bg-surface-muted/80 border border-edge'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {showCustomDates && (
          <div className="mt-4 flex flex-col md:flex-row gap-4 items-end min-w-0">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-content-muted mb-1">Data inicial</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-edge rounded-lg bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-content-muted mb-1">Data final</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-edge rounded-lg bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (startDate && endDate) void fetchData();
              }}
              disabled={!startDate || !endDate || startDate > endDate}
              className="min-h-[44px] px-4 rounded-lg bg-primary-600 text-white disabled:opacity-50"
            >
              Aplicar
            </button>
            {startDate && endDate && startDate > endDate && (
              <p className="text-sm text-red-600 w-full md:w-auto">{dashboardMessages.invalidDateRange}</p>
            )}
          </div>
        )}

        {datePreset !== 'all' && (
          <div className="mt-3 text-sm text-content-muted flex items-center gap-1 min-w-0">
            <Calendar className="w-4 h-4 shrink-0" aria-hidden />
            <span className="truncate">
              Período:{' '}
              {(() => {
                const range = getDateRange(datePreset);
                if (range.startDate && range.endDate) {
                  return `${new Date(range.startDate).toLocaleDateString('pt-PT')} — ${new Date(
                    range.endDate
                  ).toLocaleDateString('pt-PT')}`;
                }
                return 'Período completo';
              })()}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0 -mx-1 sm:mx-0">
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={36}
          margin={[10, 10]}
          containerPadding={[0, 0]}
          onLayoutChange={onLayoutChange}
          isDraggable={editMode && canCustomize}
          isResizable={editMode && canCustomize}
          draggableCancel="input,textarea,a,button,select,option"
          compactType="vertical"
        >
          {DASHBOARD_WIDGETS.filter((w) => allowedIds.has(w.id)).map((w) => (
            <div key={w.id} className="min-h-0 min-w-0">
              <WidgetMount id={w.id} />
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => (
  <DashboardDataProvider>
    <DashboardInner />
  </DashboardDataProvider>
);

export default Dashboard;
