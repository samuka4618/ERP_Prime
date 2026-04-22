/** Layouts por breakpoint (react-grid-layout). */
export type DashboardLayouts = Record<
  string,
  Array<{ i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number; static?: boolean }>
>;

export type UiPreferencesPayload = {
  version: 1;
  sidebar: {
    hiddenIds: string[];
    favorites: string[];
    sectionOrder: string[];
  };
  dashboard: {
    layouts?: DashboardLayouts | null;
  };
};

export const UI_PREFS_LS_KEY = 'erp.ui_preferences.v1';

export function defaultUiPreferences(): UiPreferencesPayload {
  return {
    version: 1,
    sidebar: { hiddenIds: [], favorites: [], sectionOrder: [] },
    dashboard: { layouts: {} },
  };
}

export function parseUiPreferencesClient(raw: unknown): UiPreferencesPayload {
  const base = defaultUiPreferences();
  if (raw == null) return base;
  let o: any;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch {
      return base;
    }
  } else {
    o = raw;
  }
  if (!o || typeof o !== 'object') return base;
  return {
    version: 1,
    sidebar: {
      hiddenIds: Array.isArray(o.sidebar?.hiddenIds) ? o.sidebar.hiddenIds.map(String) : [],
      favorites: Array.isArray(o.sidebar?.favorites) ? o.sidebar.favorites.map(String) : [],
      sectionOrder: Array.isArray(o.sidebar?.sectionOrder) ? o.sidebar.sectionOrder.map(String) : [],
    },
    dashboard: {
      layouts: o.dashboard?.layouts && typeof o.dashboard.layouts === 'object' ? o.dashboard.layouts : {},
    },
  };
}

export type UiPreferencesMergeInput = {
  version?: number;
  sidebar?: Partial<UiPreferencesPayload['sidebar']>;
  dashboard?: Partial<UiPreferencesPayload['dashboard']>;
};

export function mergePrefs(base: UiPreferencesPayload, ...layers: UiPreferencesMergeInput[]): UiPreferencesPayload {
  let out = { ...base, sidebar: { ...base.sidebar }, dashboard: { ...base.dashboard } };
  for (const layer of layers) {
    if (!layer) continue;
    out = {
      version: 1,
      sidebar: {
        hiddenIds: layer.sidebar?.hiddenIds ?? out.sidebar.hiddenIds,
        favorites: layer.sidebar?.favorites ?? out.sidebar.favorites,
        sectionOrder: layer.sidebar?.sectionOrder ?? out.sidebar.sectionOrder,
      },
      dashboard: {
        layouts:
          layer.dashboard && Object.prototype.hasOwnProperty.call(layer.dashboard, 'layouts')
            ? (layer.dashboard.layouts as DashboardLayouts) ?? {}
            : out.dashboard.layouts,
      },
    };
  }
  return out;
}
