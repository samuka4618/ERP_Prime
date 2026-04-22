export const UI_PREFERENCES_VERSION = 1;

export type UiSidebarPreferences = {
  hiddenIds: string[];
  favorites: string[];
  sectionOrder: string[];
};

export type UiDashboardPreferences = {
  layouts?: Record<string, Array<Record<string, unknown>>> | null;
};

export type UiPreferencesPayload = {
  version: typeof UI_PREFERENCES_VERSION;
  sidebar: UiSidebarPreferences;
  dashboard: UiDashboardPreferences;
};

export function defaultUiPreferences(): UiPreferencesPayload {
  return {
    version: UI_PREFERENCES_VERSION,
    sidebar: { hiddenIds: [], favorites: [], sectionOrder: [] },
    dashboard: { layouts: {} },
  };
}

export function parseUiPreferences(raw: unknown): UiPreferencesPayload {
  const base = defaultUiPreferences();
  if (raw == null || raw === '') return base;
  let obj: any;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return base;
    }
  } else if (typeof raw === 'object') {
    obj = raw;
  } else {
    return base;
  }
  if (!obj || typeof obj !== 'object') return base;
  return {
    version: UI_PREFERENCES_VERSION,
    sidebar: {
      hiddenIds: Array.isArray(obj.sidebar?.hiddenIds) ? obj.sidebar.hiddenIds.map(String) : base.sidebar.hiddenIds,
      favorites: Array.isArray(obj.sidebar?.favorites) ? obj.sidebar.favorites.map(String) : base.sidebar.favorites,
      sectionOrder: Array.isArray(obj.sidebar?.sectionOrder)
        ? obj.sidebar.sectionOrder.map(String)
        : base.sidebar.sectionOrder,
    },
    dashboard: {
      layouts:
        obj.dashboard?.layouts != null && typeof obj.dashboard.layouts === 'object'
          ? (obj.dashboard.layouts as Record<string, Array<Record<string, unknown>>>)
          : base.dashboard?.layouts ?? {},
    },
  };
}

export function mergeUiPreferences(
  existingRaw: unknown,
  patch: Partial<{
    version: number;
    sidebar: Partial<UiSidebarPreferences>;
    dashboard: Partial<UiDashboardPreferences>;
  }>
): UiPreferencesPayload {
  const current = parseUiPreferences(existingRaw);
  const p = patch || {};
  return {
    version: UI_PREFERENCES_VERSION,
    sidebar: {
      hiddenIds: p.sidebar?.hiddenIds ?? current.sidebar.hiddenIds,
      favorites: p.sidebar?.favorites ?? current.sidebar.favorites,
      sectionOrder: p.sidebar?.sectionOrder ?? current.sidebar.sectionOrder,
    },
    dashboard: {
      layouts:
        p.dashboard != null && Object.prototype.hasOwnProperty.call(p.dashboard, 'layouts')
          ? (p.dashboard.layouts as Record<string, Array<Record<string, unknown>>> | null) ?? {}
          : current.dashboard.layouts ?? {},
    },
  };
}
