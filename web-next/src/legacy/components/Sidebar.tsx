import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Palette,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { useUiPreferences } from '../contexts/UiPreferencesContext';
import { NAV_SECTIONS, type NavItem, type NavSection } from '../config/navigation';
import {
  applyHiddenNavIds,
  buildNavIndex,
  filterNavByPermissions,
  orderNavSections,
} from '../config/navigationUtils';
import UserAvatar from './UserAvatar';
import NavigationSettingsModal from './NavigationSettingsModal';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, isCollapsed, onClose, onToggleCollapse }) => {
  const { user, isAdmin } = useAuth();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const { preferences } = useUiPreferences();
  const { config } = useSystemConfig();
  const location = useLocation();
  const [navSettingsOpen, setNavSettingsOpen] = useState(false);

  const systemName = config?.system_name || 'ERP PRIME';
  const systemSubtitle = config?.system_subtitle || 'Gestão Empresarial';
  const systemLogo = config?.system_logo;

  const navSectionsFiltered = useMemo(() => {
    let s = filterNavByPermissions(NAV_SECTIONS, !!isAdmin, { hasPermission, hasAnyPermission });
    s = applyHiddenNavIds(s, new Set(preferences.sidebar.hiddenIds));
    s = orderNavSections(s, preferences.sidebar.sectionOrder);
    return s;
  }, [isAdmin, hasPermission, hasAnyPermission, preferences.sidebar.hiddenIds, preferences.sidebar.sectionOrder]);

  const navIndex = useMemo(() => buildNavIndex(navSectionsFiltered), [navSectionsFiltered]);
  const favorites = preferences.sidebar.favorites;

  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('expandedSections');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch {
        return new Set(['dashboard', 'modules', 'administration']);
      }
    }
    return new Set(['dashboard', 'modules', 'administration']);
  });

  useEffect(() => {
    localStorage.setItem('expandedSections', JSON.stringify(Array.from(expandedSections)));
  }, [expandedSections]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const isActive = (href: string | undefined) => {
    if (!href) return false;
    if (href === '/dashboard') return location.pathname === '/dashboard';
    const [pathPart, hashPart] = href.split('#');
    const currentPath = location.pathname;
    const currentHash = location.hash;
    if (!currentPath.startsWith(pathPart)) return false;
    if (hashPart) return currentPath === pathPart && currentHash === `#${hashPart}`;
    return currentPath === pathPart && !currentHash;
  };

  const isSectionActive = (section: NavSection) => {
    const checkItem = (item: NavItem): boolean => {
      if (item.href && isActive(item.href)) return true;
      if (item.items) return item.items.some((subItem) => checkItem(subItem));
      return false;
    };
    return section.items.some((item) => checkItem(item));
  };

  const navItemBase =
    'flex items-center gap-3 w-full rounded-lg text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900';
  const navItemPadding = (isNested: boolean, collapsed: boolean) =>
    collapsed && !isNested ? 'px-2 py-2.5 justify-center' : isNested ? 'pl-4 pr-3 py-2' : 'px-3 py-2.5';
  const navItemActive = 'bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-300 font-medium';
  const navItemInactive =
    'text-content-muted hover:bg-surface-muted/80 dark:hover:bg-gray-800/80 hover:text-content-primary font-normal';

  const renderNavItem = (item: NavItem, isNested: boolean = false, parentExpandKey?: string) => {
    const Icon = item.icon;
    const expandKey = parentExpandKey ? `${parentExpandKey}::${item.id}` : item.id;
    const hasSubItems = item.items && item.items.length > 0;
    const active = item.href ? isActive(item.href) : false;
    const isExpanded = hasSubItems && expandedSections.has(expandKey);

    if (hasSubItems) {
      return (
        <div key={expandKey} className="space-y-0.5">
          <button
            type="button"
            onClick={() => toggleSection(expandKey)}
            aria-label={isExpanded ? `Recolher ${item.name}` : `Expandir ${item.name}`}
            aria-expanded={isExpanded}
            className={clsx(navItemBase, navItemPadding(isNested, isCollapsed), active ? navItemActive : navItemInactive)}
          >
            <Icon className={clsx('shrink-0 opacity-90', isNested ? 'w-4 h-4' : 'w-5 h-5')} aria-hidden />
            <span
              className={clsx(
                'flex-1 text-left overflow-hidden transition-all duration-300 whitespace-nowrap',
                isCollapsed && !isNested && 'w-0 opacity-0 overflow-hidden',
                isNested && 'text-xs text-content-subtle'
              )}
            >
              {item.name}
            </span>
            {!isCollapsed &&
              (isExpanded ? (
                <ChevronUp className="w-4 h-4 shrink-0 text-content-subtle" aria-hidden />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0 text-content-subtle" aria-hidden />
              ))}
          </button>
          {!isCollapsed && (
            <div
              className={clsx(
                'ml-4 pl-3 border-l border-edge space-y-0.5 transition-all duration-300 ease-out',
                isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
              )}
            >
              {item.items?.map((subItem) => renderNavItem(subItem, true, expandKey))}
            </div>
          )}
        </div>
      );
    }

    if (!item.href) return null;

    return (
      <NavLink
        key={item.id}
        to={item.href}
        onClick={onClose}
        className={({ isActive: navActive }) =>
          clsx(
            navItemBase,
            navItemPadding(isNested, isCollapsed),
            navActive || active ? navItemActive : navItemInactive
          )
        }
        title={isCollapsed ? item.name : undefined}
      >
        <Icon className={clsx('shrink-0 opacity-90', isNested ? 'w-4 h-4' : 'w-5 h-5')} aria-hidden />
        <span
          className={clsx(
            'flex-1 overflow-hidden transition-all duration-300 whitespace-nowrap',
            isCollapsed && !isNested && 'w-0 opacity-0 overflow-hidden',
            isNested && 'text-xs text-content-subtle'
          )}
        >
          {item.name}
        </span>
        {item.badge != null && (!isCollapsed || isNested) && (
          <span className="shrink-0 min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 text-xs font-medium">
            {item.badge}
          </span>
        )}
      </NavLink>
    );
  };

  const renderSection = (section: NavSection) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedSections.has(section.id);
    const sectionActive = isSectionActive(section);
    if (!(!section.adminOnly || isAdmin)) return null;

    if (!section.collapsible) {
      return (
        <div key={section.id} className="space-y-0.5">
          {section.items.map((item) => renderNavItem(item, false))}
        </div>
      );
    }

    if (isCollapsed) {
      return (
        <div key={section.id}>
          <div
            className={clsx(
              'flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-colors duration-200',
              sectionActive ? navItemActive : navItemInactive
            )}
            title={section.name}
          >
            <SectionIcon className="w-5 h-5 shrink-0" aria-hidden />
          </div>
        </div>
      );
    }

    return (
      <div key={section.id} className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          aria-label={isExpanded ? `Recolher ${section.name}` : `Expandir ${section.name}`}
          aria-expanded={isExpanded}
          className={clsx(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
            sectionActive ? navItemActive : navItemInactive
          )}
        >
          <SectionIcon className="w-5 h-5 shrink-0 opacity-90" aria-hidden />
          <span className="flex-1 text-left overflow-hidden whitespace-nowrap text-content-primary">{section.name}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 shrink-0 text-content-subtle" aria-hidden />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0 text-content-subtle" aria-hidden />
          )}
        </button>
        <div
          className={clsx(
            'ml-4 pl-3 border-l border-edge space-y-0.5 transition-all duration-300 ease-out',
            isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
          )}
        >
          {section.items.map((item) => renderNavItem(item, true, section.id))}
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <>
      <div className="shrink-0 px-4 pt-5 pb-4 border-b border-edge">
        <div className={clsx('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
          <div className="w-10 h-10 shrink-0 rounded-xl bg-surface-card shadow-sm border border-edge flex items-center justify-center overflow-hidden">
            {systemLogo ? (
              <img
                src={systemLogo.startsWith('http') ? systemLogo : `/${systemLogo.replace(/^\/+/, '')}`}
                alt={systemName}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = 'none';
                  const fallback = el.nextElementSibling as HTMLElement;
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
            ) : null}
            <span className={clsx('text-primary-600 dark:text-primary-400 font-bold text-sm', systemLogo && 'hidden')}>
              {systemName.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div className={clsx('min-w-0 overflow-hidden transition-all duration-300', isCollapsed ? 'w-0 opacity-0' : 'opacity-100')}>
            <p className="text-content-primary font-semibold truncate">{systemName}</p>
            <p className="text-xs text-content-muted truncate">{systemSubtitle}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-5 px-3 overflow-y-auto overflow-x-hidden scrollbar-sidebar min-h-0" aria-label="Principal">
        {!isCollapsed && favorites.length > 0 && (
          <div className="mb-5 space-y-1.5 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-content-subtle px-2">Favoritos</p>
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((fid) => {
                const hit = navIndex.get(fid);
                if (!hit) return null;
                const { item } = hit;
                if (!item.href) return null;
                const Icon = item.icon;
                return (
                  <NavLink
                    key={fid}
                    to={item.href}
                    onClick={onClose}
                    title={item.name}
                    className={({ isActive: na }) =>
                      clsx(
                        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium min-h-[40px]',
                        'border-edge bg-surface-muted/60 hover:bg-surface-muted',
                        na ? 'text-primary-600 dark:text-primary-300 border-primary-500/30' : 'text-content-primary'
                      )
                    }
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    <span className="max-w-[7.5rem] truncate">{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {navSectionsFiltered.map((section) => (
            <div key={section.id} className="space-y-0.5">
              {renderSection(section)}
            </div>
          ))}
        </div>
      </nav>

      <div className="shrink-0 p-3 border-t border-edge bg-surface-muted/40 dark:bg-gray-800/50 space-y-2">
        <button
          type="button"
          onClick={() => setNavSettingsOpen(true)}
          className={clsx(
            'flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 min-h-[48px]',
            'hover:bg-surface-muted dark:hover:bg-gray-700/50 text-content-primary',
            isCollapsed && 'justify-center px-0'
          )}
          aria-label="Aparência e navegação"
          title="Aparência e navegação"
        >
          <Palette className="w-5 h-5 shrink-0 text-content-muted" aria-hidden />
          {!isCollapsed && <span className="text-sm font-medium">Aparência e navegação</span>}
        </button>

        <NavLink
          to="/profile"
          onClick={onClose}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-xl p-3 transition-all duration-200 min-h-[48px]',
              isCollapsed ? 'justify-center' : '',
              isActive ? 'bg-primary-500/10 dark:bg-primary-500/20' : 'hover:bg-surface-muted dark:hover:bg-gray-700/50'
            )
          }
        >
          <UserAvatar user={user} size={isCollapsed ? 'sm' : 'md'} className="shrink-0 ring-2 ring-white dark:ring-gray-800 shadow-sm" />
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-content-primary truncate">{user?.name}</p>
              <p className="text-xs text-content-muted truncate capitalize">
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'attendant' ? 'Atendente' : 'Usuário'}
              </p>
            </div>
          )}
        </NavLink>
      </div>
    </>
  );

  return (
    <>
      <NavigationSettingsModal
        open={navSettingsOpen}
        onClose={() => setNavSettingsOpen(false)}
        filteredSections={filterNavByPermissions(NAV_SECTIONS, !!isAdmin, { hasPermission, hasAnyPermission })}
      />

      <aside
        className={clsx(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50',
          'bg-surface-card dark:bg-gray-900',
          'border-r border-edge',
          'transition-[width] duration-300 ease-out overflow-hidden',
          isCollapsed ? 'lg:w-[4.5rem]' : 'lg:w-72'
        )}
      >
        {sidebarContent}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 z-10 min-w-[44px] min-h-[44px] w-11 h-11 rounded-full',
            'bg-surface-card dark:bg-gray-800 border border-edge shadow-md',
            'flex items-center justify-center',
            'hover:bg-surface-muted dark:hover:bg-gray-700',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
            'transition-all duration-200',
            '-right-3.5'
          )}
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-content-muted" aria-hidden />
          ) : (
            <ChevronLeft className="w-4 h-4 text-content-muted" aria-hidden />
          )}
        </button>
      </aside>

      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col',
          'bg-surface-card dark:bg-gray-900 border-r border-edge',
          'transform transition-transform duration-300 ease-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
