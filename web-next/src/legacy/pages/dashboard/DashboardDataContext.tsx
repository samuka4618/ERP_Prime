'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/api';
import type { DashboardStats } from '../../types';
import { useActivityTracking } from '../../hooks/useActivityTracking';

export type RecentActivity = {
  id: number;
  type: 'ticket_created' | 'ticket_updated' | 'ticket_resolved' | 'ticket_reopened' | 'ticket_closed';
  title: string;
  description: string;
  timestamp: Date;
  user_name: string;
  ticket_id: number;
  ticket_subject: string;
};

export type DatePreset = 'all' | 'today' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';

type Ctx = {
  stats: DashboardStats | null;
  recentActivity: RecentActivity[];
  registrationStats: Record<string, unknown> | null;
  comprasStats: Record<string, unknown> | null;
  loading: boolean;
  loadError: string | null;
  datePreset: DatePreset;
  setDatePreset: (p: DatePreset) => void;
  startDate: string;
  setStartDate: (s: string) => void;
  endDate: string;
  setEndDate: (s: string) => void;
  showCustomDates: boolean;
  setShowCustomDates: (v: boolean) => void;
  fetchData: () => Promise<void>;
  getDateRange: (preset: DatePreset) => { startDate?: string; endDate?: string };
};

const DashboardDataContext = createContext<Ctx | undefined>(undefined);

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DashboardDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useActivityTracking();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [registrationStats, setRegistrationStats] = useState<Record<string, unknown> | null>(null);
  const [comprasStats, setComprasStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);

  const getDateRange = useCallback(
    (preset: DatePreset): { startDate?: string; endDate?: string } => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const endDateStr = formatDate(today);

      switch (preset) {
        case 'all':
          return {};
        case 'today': {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          return { startDate: formatDate(todayStart), endDate: endDateStr };
        }
        case 'last7days': {
          const last7Days = new Date(today);
          last7Days.setDate(today.getDate() - 7);
          return { startDate: formatDate(last7Days), endDate: endDateStr };
        }
        case 'last30days': {
          const last30Days = new Date(today);
          last30Days.setDate(today.getDate() - 30);
          return { startDate: formatDate(last30Days), endDate: endDateStr };
        }
        case 'thisMonth': {
          const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          return { startDate: formatDate(thisMonthStart), endDate: endDateStr };
        }
        case 'lastMonth': {
          const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
          return { startDate: formatDate(lastMonthStart), endDate: formatDate(lastMonthEnd) };
        }
        case 'custom':
          return { startDate, endDate };
        default:
          return {};
      }
    },
    [startDate, endDate]
  );

  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const dateRange = getDateRange(datePreset);
      const [statsData, activityData, regStatsData, comprasStatsData] = await Promise.all([
        apiService.getDashboardStats(dateRange.startDate, dateRange.endDate),
        apiService.getRecentActivity(),
        apiService.getClientRegistrationStatistics(dateRange.startDate, dateRange.endDate).catch(() => null),
        apiService.getComprasStatistics(dateRange.startDate, dateRange.endDate).catch(() => null),
      ]);
      setStats(statsData);
      setRegistrationStats(regStatsData);
      setComprasStats(comprasStatsData);
      const activitiesWithDates = activityData.map((activity) => ({
        ...activity,
        timestamp: new Date(activity.timestamp as unknown as string),
      }));
      setRecentActivity(activitiesWithDates);
    } catch (e) {
      console.error('Erro ao carregar dados do dashboard:', e);
      setLoadError('load');
    } finally {
      setLoading(false);
    }
  }, [datePreset, getDateRange]);

  useEffect(() => {
    if (datePreset !== 'custom') {
      void fetchData();
    }
  }, [datePreset, fetchData]);

  const value = useMemo(
    () => ({
      stats,
      recentActivity,
      registrationStats,
      comprasStats,
      loading,
      loadError,
      datePreset,
      setDatePreset,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      showCustomDates,
      setShowCustomDates,
      fetchData,
      getDateRange,
    }),
    [
      stats,
      recentActivity,
      registrationStats,
      comprasStats,
      loading,
      loadError,
      datePreset,
      startDate,
      endDate,
      showCustomDates,
      fetchData,
      getDateRange,
    ]
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
};

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error('useDashboardData must be used within DashboardDataProvider');
  return ctx;
}
