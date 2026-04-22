'use client';

import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import type { NavSection } from '../config/navigation';
import { flattenNavForSettings } from '../config/navigationUtils';
import { useUiPreferences } from '../contexts/UiPreferencesContext';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Secções já filtradas por permissão (base para ocultar / favoritos). */
  filteredSections: NavSection[];
};

const NavigationSettingsModal: React.FC<Props> = ({ open, onClose, filteredSections }) => {
  const { preferences, updatePreferences, resetPreferences } = useUiPreferences();
  const sb = preferences.sidebar;
  const panelRef = useRef<HTMLDivElement>(null);

  const entries = flattenNavForSettings(filteredSections);
  const hidden = new Set(preferences.sidebar.hiddenIds);
  const favorites = preferences.sidebar.favorites;
  const sectionOrder = preferences.sidebar.sectionOrder;

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button, [href]')?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const moveSection = (id: string, dir: -1 | 1) => {
    const ids = filteredSections.map((s) => s.id);
    const order = [...(sectionOrder.length ? sectionOrder.filter((x) => ids.includes(x)) : ids)];
    const i = order.indexOf(id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    void updatePreferences({ sidebar: { ...sb, sectionOrder: order } });
  };

  const toggleHidden = (id: string, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id);
    else next.add(id);
    void updatePreferences({ sidebar: { ...sb, hiddenIds: [...next] } });
  };

  const toggleFavorite = (id: string, on: boolean) => {
    let next = [...favorites];
    if (on && !next.includes(id)) {
      if (next.length >= 12) return;
      next.push(id);
    } else {
      next = next.filter((x) => x !== id);
    }
    void updatePreferences({ sidebar: { ...sb, favorites: next } });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nav-settings-title"
        className={clsx(
          'relative w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl',
          'bg-surface-card border border-edge text-content-primary'
        )}
      >
        <div className="px-5 py-4 border-b border-edge flex items-center justify-between gap-3">
          <h2 id="nav-settings-title" className="text-lg font-semibold">
            Aparência e navegação
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-content-muted hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
          >
            Fechar
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-8">
          <section aria-labelledby="fav-title" className="space-y-2">
            <h3 id="fav-title" className="text-sm font-medium text-content-muted">
              Favoritos no topo (máx. 12)
            </h3>
            <p className="text-xs text-content-subtle">
              Os favoritos aparecem acima da navegação principal quando o menu está expandido. Ative &quot;Favorito&quot; nos
              destinos abaixo.
            </p>
            {favorites.length === 0 ? (
              <p className="text-xs text-content-muted">Nenhum favorito definido.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {favorites.map((fid) => {
                  const e = entries.find((x) => x.id === fid);
                  if (!e) return null;
                  return (
                    <li
                      key={fid}
                      className="rounded-full border border-edge bg-surface-muted/50 px-3 py-1 text-xs text-content-primary"
                    >
                      {e.name}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="sections-order-title" className="space-y-2">
            <h3 id="sections-order-title" className="text-sm font-medium text-content-muted">
              Ordem das secções
            </h3>
            <ul className="space-y-2">
              {(sectionOrder.length
                ? [...new Set([...sectionOrder, ...filteredSections.map((s) => s.id)])].filter((id) =>
                    filteredSections.some((s) => s.id === id)
                  )
                : filteredSections.map((s) => s.id)
              ).map((sid) => {
                const sec = filteredSections.find((s) => s.id === sid);
                if (!sec) return null;
                return (
                  <li
                    key={sid}
                    className="flex items-center justify-between gap-2 rounded-lg border border-edge px-3 py-2 bg-surface-muted/40"
                  >
                    <span className="text-sm font-medium truncate">{sec.name}</span>
                    <span className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="min-h-[44px] min-w-[44px] rounded-md border border-edge text-sm hover:bg-surface-card"
                        aria-label={`Mover secção ${sec.name} para cima`}
                        onClick={() => moveSection(sid, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="min-h-[44px] min-w-[44px] rounded-md border border-edge text-sm hover:bg-surface-card"
                        aria-label={`Mover secção ${sec.name} para baixo`}
                        onClick={() => moveSection(sid, 1)}
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="visibility-title" className="space-y-2">
            <h3 id="visibility-title" className="text-sm font-medium text-content-muted">
              Visibilidade dos destinos
            </h3>
            <ul className="space-y-2">
              {entries.map((e) => {
                const visible = !hidden.has(e.id);
                const favOn = favorites.includes(e.id);
                return (
                  <li
                    key={e.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-edge px-3 py-2"
                  >
                    <span
                      className="text-sm pl-2 border-l-2 border-primary-500/40"
                      style={{ marginLeft: e.depth * 8 }}
                    >
                      {e.name}
                    </span>
                    <div className="flex flex-wrap gap-3 sm:justify-end">
                      <label className="inline-flex items-center gap-2 text-xs text-content-muted cursor-pointer min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(ev) => toggleHidden(e.id, ev.target.checked)}
                          className="rounded border-edge"
                        />
                        Mostrar
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-content-muted cursor-pointer min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={favOn}
                          disabled={!visible}
                          onChange={(ev) => toggleFavorite(e.id, ev.target.checked)}
                          className="rounded border-edge"
                        />
                        Favorito
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-edge flex flex-wrap gap-2 justify-end bg-surface-muted/30">
          <button
            type="button"
            className="min-h-[44px] px-4 rounded-lg border border-edge text-sm hover:bg-surface-card"
            onClick={() => {
              if (window.confirm('Repor navegação e favoritos para o padrão?')) {
                void resetPreferences();
              }
            }}
          >
            Repor padrão
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationSettingsModal;
