'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import {
  UI_PREFS_LS_KEY,
  defaultUiPreferences,
  mergePrefs,
  parseUiPreferencesClient,
  type UiPreferencesPayload,
} from '../types/uiPreferences';

type UiPreferencesPatch = Partial<{
  version: number;
  sidebar: Partial<UiPreferencesPayload['sidebar']>;
  dashboard: Partial<UiPreferencesPayload['dashboard']>;
}>;

type UiPreferencesContextValue = {
  preferences: UiPreferencesPayload;
  /** Atualiza preferências (merge), persiste em localStorage e tenta gravar no servidor. */
  updatePreferences: (patch: UiPreferencesPatch) => Promise<void>;
  resetPreferences: () => Promise<void>;
  loading: boolean;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | undefined>(undefined);

function readLocal(): UiPreferencesPayload {
  try {
    const raw = localStorage.getItem(UI_PREFS_LS_KEY);
    if (!raw) return defaultUiPreferences();
    return parseUiPreferencesClient(JSON.parse(raw));
  } catch {
    return defaultUiPreferences();
  }
}

function writeLocal(p: UiPreferencesPayload) {
  localStorage.setItem(UI_PREFS_LS_KEY, JSON.stringify(p));
}

export const UiPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [preferences, setPreferences] = useState<UiPreferencesPayload>(() => readLocal());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    writeLocal(preferences);
  }, [preferences]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const remote = await apiService.getMyUiPreferences();
        const merged = mergePrefs(defaultUiPreferences(), readLocal(), parseUiPreferencesClient(remote));
        if (!cancelled) setPreferences(merged);
      } catch {
        if (!cancelled) setPreferences(readLocal());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const updatePreferences = useCallback(async (patch: UiPreferencesPatch) => {
    setPreferences((prev) => mergePrefs(prev, patch));
    if (!isAuthenticated) return;
    try {
      const saved = await apiService.putMyUiPreferences(patch as Record<string, unknown>);
      setPreferences(parseUiPreferencesClient(saved));
    } catch {
      /* mantém merge local */
    }
  }, [isAuthenticated]);

  const resetPreferences = useCallback(async () => {
    const fresh = defaultUiPreferences();
    setPreferences(fresh);
    writeLocal(fresh);
    if (!isAuthenticated) return;
    try {
      const saved = await apiService.putMyUiPreferences(fresh as unknown as Record<string, unknown>);
      setPreferences(parseUiPreferencesClient(saved));
    } catch {
      /* ignore */
    }
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({ preferences, updatePreferences, resetPreferences, loading }),
    [preferences, updatePreferences, resetPreferences, loading]
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
};

export function useUiPreferences() {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) throw new Error('useUiPreferences must be used within UiPreferencesProvider');
  return ctx;
}
