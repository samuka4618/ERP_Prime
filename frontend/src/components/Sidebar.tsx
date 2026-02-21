import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Ticket,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Monitor,
  Activity,
  Building2,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  UserCheck,
  Shield,
  Tag,
  List,
  FileText,
  ShoppingCart,
  CheckCircle,
  Package,
  ClipboardList,
  ShoppingBag,
  Truck,
  Calendar,
  Warehouse
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import UserAvatar from './UserAvatar';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  adminOnly?: boolean;
  items?: NavigationItem[];
}

interface NavigationSection {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavigationItem[];
  adminOnly?: boolean;
  collapsible?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse
}) => {
  const { user, isAdmin } = useAuth();
  const { config } = useSystemConfig();
  const location = useLocation();

  const systemName = config?.system_name || 'ERP PRIME';
  const systemSubtitle = config?.system_subtitle || 'Gestão Empresarial';
  const systemLogo = config?.system_logo;
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
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const navigationSections: NavigationSection[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: LayoutDashboard,
      items: [{ name: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard }],
      collapsible: false
    },
    {
      id: 'modules',
      name: 'Módulos',
      icon: FolderOpen,
      items: [
        { name: 'Chamados', href: '/tickets', icon: Ticket, badge: location.pathname.startsWith('/tickets') ? undefined : undefined },
        { name: 'Cadastros', href: '/client-registrations', icon: Building2 },
        {
          name: 'Compras',
          icon: ShoppingCart,
          items: [
            { name: 'Todas as Solicitações', href: '/compras/solicitacoes', icon: ClipboardList },
            { name: 'Orçamentos Recebidos', href: '/compras/orcamentos', icon: FileText },
            { name: 'Minhas Solicitações', href: '/compras/minhas-solicitacoes', icon: Package },
            { name: 'Pendentes de Aprovação', href: '/compras/pendentes-aprovacao', icon: CheckCircle }
          ]
        },
        {
          name: 'Descarregamento',
          icon: Truck,
          items: [
            { name: 'Agendamentos', href: '/descarregamento/agendamentos', icon: Calendar },
            { name: 'Grade', href: '/descarregamento/grade', icon: Calendar },
            { name: 'Fornecedores', href: '/descarregamento/fornecedores', icon: Building2 },
            { name: 'Docas', href: '/descarregamento/docas', icon: Warehouse },
            { name: 'Motoristas no Pátio', href: '/descarregamento/motoristas-patio', icon: Users }
          ]
        }
      ],
      collapsible: true
    },
    {
      id: 'administration',
      name: 'Administração',
      icon: Shield,
      items: [
        { name: 'Usuários', href: '/users', icon: Users },
        { name: 'Permissões', href: '/permissions', icon: Shield },
        { name: 'Relatórios', href: '/reports', icon: BarChart3 },
        { name: 'Monitoramento', href: '/admin-dashboard', icon: Monitor },
        { name: 'Performance', href: '/performance', icon: Activity },
        {
          name: 'Configurações',
          icon: Settings,
          items: [
            { name: 'Configurações Gerais', href: '/system-settings', icon: Settings },
            {
              name: 'Sistema de Chamados',
              icon: Ticket,
              items: [
                { name: 'Categorias', href: '/categories', icon: Tag },
                { name: 'Status', href: '/status', icon: List },
                { name: 'Atribuições', href: '/category-assignments', icon: UserCheck }
              ]
            },
            {
              name: 'Sistema de Cadastros',
              icon: Building2,
              items: [{ name: 'Configurações', href: '/cadastros-config', icon: FileText }]
            },
            {
              name: 'Sistema de Compras',
              icon: ShoppingBag,
              items: [{ name: 'Configurações', href: '/compras-config', icon: Settings }]
            },
            {
              name: 'Sistema de Descarregamento',
              icon: Truck,
              items: [{ name: 'Configurações', href: '/descarregamento-config', icon: Settings }]
            }
          ]
        }
      ],
      adminOnly: true,
      collapsible: true
    }
  ];

  const visibleSections = navigationSections.filter(section => !section.adminOnly || isAdmin);

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

  const isSectionActive = (section: NavigationSection) => {
    const checkItem = (item: NavigationItem): boolean => {
      if (item.href && isActive(item.href)) return true;
      if (item.items) return item.items.some(subItem => checkItem(subItem));
      return false;
    };
    return section.items.some(item => checkItem(item));
  };

  const navItemBase = 'flex items-center gap-3 w-full rounded-lg text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900';
  const navItemPadding = (isNested: boolean, collapsed: boolean) =>
    collapsed && !isNested ? 'px-2 py-2.5 justify-center' : isNested ? 'pl-4 pr-3 py-2' : 'px-3 py-2.5';
  const navItemActive = 'bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-300 font-medium';
  const navItemInactive = 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-gray-100 font-normal';

  const renderNavItem = (item: NavigationItem, isNested: boolean = false, parentId?: string) => {
    const Icon = item.icon;
    const itemId = `${parentId || ''}-${item.name}`;
    const hasSubItems = item.items && item.items.length > 0;
    const active = item.href ? isActive(item.href) : false;
    const isExpanded = hasSubItems && expandedSections.has(itemId);

    if (hasSubItems) {
      return (
        <div key={itemId} className="space-y-0.5">
          <button
            type="button"
            onClick={() => toggleSection(itemId)}
            aria-label={isExpanded ? `Recolher ${item.name}` : `Expandir ${item.name}`}
            aria-expanded={isExpanded}
            className={clsx(
              navItemBase,
              navItemPadding(isNested, isCollapsed),
              active ? navItemActive : navItemInactive
            )}
          >
            <Icon className={clsx('shrink-0 opacity-90', isNested ? 'w-4 h-4' : 'w-5 h-5')} />
            <span className={clsx(
              'flex-1 text-left overflow-hidden transition-all duration-300 whitespace-nowrap',
              isCollapsed && !isNested && 'w-0 opacity-0 overflow-hidden',
              isNested && 'text-xs text-gray-500 dark:text-gray-400'
            )}>
              {item.name}
            </span>
            {!isCollapsed && (
              isExpanded ? (
                <ChevronUp className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
              )
            )}
          </button>
          {!isCollapsed && (
            <div
              className={clsx(
                'ml-4 pl-3 border-l border-gray-200/80 dark:border-gray-600/80 space-y-0.5 transition-all duration-300 ease-out',
                isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
              )}
            >
              {item.items?.map(subItem => renderNavItem(subItem, true, itemId))}
            </div>
          )}
        </div>
      );
    }

    if (!item.href) return null;

    return (
      <NavLink
        key={itemId}
        to={item.href}
        onClick={onClose}
        className={({ isActive: navActive }) =>
          clsx(
            navItemBase,
            navItemPadding(isNested, isCollapsed),
            (navActive || active) ? navItemActive : navItemInactive
          )
        }
        title={isCollapsed ? item.name : undefined}
      >
        <Icon className={clsx('shrink-0 opacity-90', isNested ? 'w-4 h-4' : 'w-5 h-5')} />
        <span className={clsx(
          'flex-1 overflow-hidden transition-all duration-300 whitespace-nowrap',
          isCollapsed && !isNested && 'w-0 opacity-0 overflow-hidden',
          isNested && 'text-xs text-gray-500 dark:text-gray-400'
        )}>
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

  const renderSection = (section: NavigationSection) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedSections.has(section.id);
    const sectionActive = isSectionActive(section);
    if (!(!section.adminOnly || isAdmin)) return null;

    if (!section.collapsible) {
      return (
        <div key={section.id} className="space-y-0.5">
          {section.items.map(item => renderNavItem(item, false))}
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
            <SectionIcon className="w-5 h-5 shrink-0" />
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
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
            sectionActive ? navItemActive : navItemInactive
          )}
        >
          <SectionIcon className="w-5 h-5 shrink-0 opacity-90" />
          <span className="flex-1 text-left overflow-hidden whitespace-nowrap text-gray-700 dark:text-gray-300">
            {section.name}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
          )}
        </button>
        <div
          className={clsx(
            'ml-4 pl-3 border-l border-gray-200/80 dark:border-gray-600/80 space-y-0.5 transition-all duration-300 ease-out',
            isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
          )}
        >
          {section.items.map(item => renderNavItem(item, true, section.id))}
        </div>
      </div>
    );
  };

  const sidebarContent = (
    <>
      {/* Header / Logo */}
      <div className="shrink-0 px-4 pt-5 pb-4 border-b border-gray-200/60 dark:border-gray-700/60">
        <div className={clsx('flex items-center', isCollapsed ? 'justify-center' : 'gap-3')}>
          <div className="w-10 h-10 shrink-0 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200/80 dark:border-gray-600/80 flex items-center justify-center overflow-hidden">
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
          <div className={clsx(
            'min-w-0 overflow-hidden transition-all duration-300',
            isCollapsed ? 'w-0 opacity-0' : 'opacity-100'
          )}>
            <p className="text-gray-900 dark:text-white font-semibold truncate">{systemName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{systemSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-5 px-3 overflow-y-auto overflow-x-hidden scrollbar-sidebar">
        <div className="space-y-6">
          {visibleSections.map(section => (
            <div key={section.id} className="space-y-0.5">
              {renderSection(section)}
            </div>
          ))}
        </div>
      </nav>

      {/* User */}
      <div className="shrink-0 p-3 border-t border-gray-200/80 dark:border-gray-700/80 bg-gray-50/80 dark:bg-gray-800/50">
        <NavLink
          to="/profile"
          onClick={onClose}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-xl p-3 transition-all duration-200',
              isCollapsed ? 'justify-center' : '',
              isActive ? 'bg-primary-500/10 dark:bg-primary-500/20' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
            )
          }
        >
          <UserAvatar user={user} size={isCollapsed ? 'sm' : 'md'} className="shrink-0 ring-2 ring-white dark:ring-gray-800 shadow-sm" />
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">
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
      {/* Desktop */}
      <aside
        className={clsx(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50',
          'bg-white dark:bg-gray-900',
          'border-r border-gray-200 dark:border-gray-700/80',
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
            'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-md',
            'flex items-center justify-center',
            'hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
            'transition-all duration-200',
            isCollapsed ? '-right-3.5' : '-right-3.5'
          )}
          title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </button>
      </aside>

      {/* Mobile */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col',
          'bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700',
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
