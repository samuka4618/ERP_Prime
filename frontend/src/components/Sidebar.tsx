import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Ticket, 
  Users, 
  User, 
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
  ShoppingBag
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
  items?: NavigationItem[]; // Subitens para criar grupos
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
    // Carregar seções expandidas do localStorage
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

  // Salvar estado expandido no localStorage
  useEffect(() => {
    localStorage.setItem('expandedSections', JSON.stringify(Array.from(expandedSections)));
  }, [expandedSections]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Definir estrutura de navegação modular
  const navigationSections: NavigationSection[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: LayoutDashboard,
      items: [
        { name: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard }
      ],
      collapsible: false
    },
    {
      id: 'modules',
      name: 'Módulos',
      icon: FolderOpen,
      items: [
        {
          name: 'Chamados',
          href: '/tickets',
          icon: Ticket,
          badge: location.pathname.startsWith('/tickets') ? undefined : undefined
        },
        {
          name: 'Cadastros',
          href: '/client-registrations',
          icon: Building2
        },
        {
          name: 'Compras',
          icon: ShoppingCart,
          items: [
            { name: 'Todas as Solicitações', href: '/compras/solicitacoes', icon: ClipboardList },
            { name: 'Orçamentos Recebidos', href: '/compras/orcamentos', icon: FileText },
            { name: 'Minhas Solicitações', href: '/compras/minhas-solicitacoes', icon: Package },
            { name: 'Pendentes de Aprovação', href: '/compras/pendentes-aprovacao', icon: CheckCircle }
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
              items: [
                { name: 'Configurações', href: '/cadastros-config', icon: FileText }
              ]
            },
            {
              name: 'Sistema de Compras',
              icon: ShoppingBag,
              items: [
                { name: 'Configurações', href: '/compras-config', icon: Settings }
              ]
            }
          ]
        }
      ],
      adminOnly: true,
      collapsible: true
    }
  ];

  // Filtrar seções baseado em permissões
  const visibleSections = navigationSections.filter(section => 
    !section.adminOnly || isAdmin
  );

  const isActive = (href: string | undefined) => {
    if (!href) return false;
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    
    // Separar path e hash
    const [pathPart, hashPart] = href.split('#');
    const currentPath = location.pathname;
    const currentHash = location.hash;
    
    // Verificar se o path corresponde
    if (!currentPath.startsWith(pathPart)) {
      return false;
    }
    
    // Se o href tem hash, verificar se o hash atual corresponde
    if (hashPart) {
      // Se estamos na página correta E o hash corresponde
      return currentPath === pathPart && currentHash === `#${hashPart}`;
    }
    
    // Se o href não tem hash, verificar apenas o path (mas não deve ter hash na URL)
    return currentPath === pathPart && !currentHash;
  };

  const isSectionActive = (section: NavigationSection) => {
    const checkItem = (item: NavigationItem): boolean => {
      if (item.href && isActive(item.href)) return true;
      if (item.items) {
        return item.items.some(subItem => checkItem(subItem));
      }
      return false;
    };
    return section.items.some(item => checkItem(item));
  };

  const renderNavItem = (item: NavigationItem, isNested: boolean = false, parentId?: string) => {
    const Icon = item.icon;
    const itemId = `${parentId || ''}-${item.name}`;
    const hasSubItems = item.items && item.items.length > 0;
    const active = item.href ? isActive(item.href) : false;
    const isExpanded = hasSubItems && expandedSections.has(itemId);

    // Se tiver subitens, renderizar como grupo (sem navegação, apenas expandir)
    if (hasSubItems) {
      return (
        <div key={itemId} className="space-y-1">
          <button
            onClick={(e) => {
              e.preventDefault();
              toggleSection(itemId);
            }}
            className={clsx(
              'w-full flex items-center justify-between text-sm font-medium rounded-lg transition-all duration-200',
              isNested ? 'px-3 py-2 ml-4' : 'px-3 py-2',
              active
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            <div className="flex items-center">
              <Icon className="w-4 h-4 shrink-0" />
              <span className={clsx(
                'ml-3 overflow-hidden transition-all duration-300 whitespace-nowrap',
                isCollapsed && !isNested ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100',
                isNested && 'text-xs'
              )}>
                {item.name}
              </span>
            </div>
            {!isCollapsed && (
              <>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 transition-transform duration-200" />
                ) : (
                  <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                )}
              </>
            )}
          </button>
          {!isCollapsed && (
            <div className={clsx(
              'space-y-1 ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-3 transition-all duration-300 ease-in-out',
              isExpanded 
                ? 'max-h-[500px] opacity-100 overflow-visible' 
                : 'max-h-0 opacity-0 overflow-hidden'
            )}>
              {item.items?.map(subItem => renderNavItem(subItem, true, itemId))}
            </div>
          )}
        </div>
      );
    }

    // Item normal sem subitens
    if (!item.href) return null;

    return (
      <NavLink
        key={itemId}
        to={item.href}
        onClick={onClose}
        className={({ isActive: navActive }) =>
          clsx(
            'group flex items-center text-sm font-medium rounded-lg transition-all duration-200',
            isCollapsed && !isNested
              ? 'justify-center px-2 py-2 mx-1'
              : isNested
              ? 'px-3 py-2 ml-4'
              : 'px-3 py-2',
            (navActive || active)
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-r-2 border-primary-600 font-semibold'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
          )
        }
        title={isCollapsed ? item.name : undefined}
      >
        <Icon className={clsx(
          'shrink-0 transition-all duration-200',
          isCollapsed && !isNested ? 'w-5 h-5' : 'w-4 h-4'
        )} />
        <span className={clsx(
          'ml-3 overflow-hidden transition-all duration-300 whitespace-nowrap',
          isCollapsed && !isNested ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100',
          isNested && 'text-xs'
        )}>
          {item.name}
        </span>
        {item.badge && (!isCollapsed || isNested) && (
          <span className={clsx(
            'ml-auto bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs font-semibold px-2 py-0.5 rounded-full transition-all duration-300',
            isCollapsed && !isNested ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
          )}>
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
    const showSection = !section.adminOnly || isAdmin;

    if (!showSection) return null;

    // Seção não colapsável (Dashboard) - sempre mostra o item
    if (!section.collapsible) {
      return (
        <div key={section.id} className="space-y-1">
          {section.items.map(item => renderNavItem(item, false))}
        </div>
      );
    }

    // Se estiver colapsado, mostrar apenas o ícone da seção (tooltip nativo do browser)
    if (isCollapsed) {
      return (
        <div key={section.id}>
          <div
            className={clsx(
              'flex items-center justify-center px-2 py-2 mx-1 rounded-lg transition-colors duration-200',
              sectionActive
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
            title={section.name}
          >
            <SectionIcon className="w-5 h-5 shrink-0" />
          </div>
        </div>
      );
    }

    // Seção colapsável (expandida)
    return (
      <div key={section.id} className="space-y-1">
        <button
          onClick={() => toggleSection(section.id)}
          className={clsx(
            'w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg transition-colors duration-200',
            sectionActive
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
        >
          <div className="flex items-center">
            <SectionIcon className="w-4 h-4 shrink-0" />
            <span className={clsx(
              'ml-3 overflow-hidden transition-all duration-300 whitespace-nowrap',
              isCollapsed ? 'w-0 opacity-0 ml-0' : 'w-auto opacity-100'
            )}>
              {section.name}
            </span>
          </div>
          {!isCollapsed && (
            <>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 transition-transform duration-200" />
              ) : (
                <ChevronDown className="w-4 h-4 transition-transform duration-200" />
              )}
            </>
          )}
        </button>
        
        <div className={clsx(
          'space-y-1 ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-3 transition-all duration-300 ease-in-out',
          isExpanded 
            ? 'max-h-[500px] opacity-100 overflow-visible' 
            : 'max-h-0 opacity-0 overflow-hidden'
        )}>
          {section.items.map(item => renderNavItem(item, true, section.id))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={clsx(
        'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 lg:bg-white dark:lg:bg-gray-900 lg:border-r lg:border-gray-200 dark:lg:border-gray-700 transition-all duration-300 overflow-visible',
        isCollapsed ? 'lg:w-16' : 'lg:w-72'
      )}>
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className={clsx(
            'flex items-center w-full',
            isCollapsed ? 'justify-center px-2' : 'px-4'
          )}>
            {systemLogo ? (
              <img 
                src={`/${systemLogo}`} 
                alt={systemName}
                className="w-10 h-10 rounded-lg object-contain shadow-lg bg-white p-1"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'bg-white rounded-lg flex items-center justify-center shadow-lg w-10 h-10';
                    fallback.innerHTML = '<span class="text-primary-700 font-bold text-sm">' + systemName.substring(0, 2).toUpperCase() + '</span>';
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className={clsx(
                'bg-white rounded-lg flex items-center justify-center shadow-lg',
                'w-10 h-10'
              )}>
                <span className="text-primary-700 font-bold text-sm">
                  {systemName.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className={clsx(
              'ml-3 overflow-hidden transition-all duration-300',
              isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
            )}>
              <span className="text-white text-lg font-bold block leading-tight whitespace-nowrap">
                {systemName}
              </span>
              <span className="text-primary-100 text-xs block leading-tight whitespace-nowrap">
                {systemSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col py-4 px-2 space-y-2 overflow-y-auto overflow-x-hidden">
          {visibleSections.map(section => renderSection(section))}
        </nav>

        {/* User Info & Profile */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center transition-colors duration-200',
                isCollapsed ? 'justify-center p-2' : 'p-4',
                isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              )
            }
          >
            <UserAvatar 
              user={user} 
              size={isCollapsed ? 'sm' : 'md'}
              className="shadow-md"
            />
            {!isCollapsed && (
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
                  {user?.role === 'admin' ? 'Administrador' : user?.role === 'attendant' ? 'Atendente' : 'Usuário'}
                </p>
              </div>
            )}
          </NavLink>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={onToggleCollapse}
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 z-20 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500',
            isCollapsed ? '-right-3' : '-right-4'
          )}
          title={isCollapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 text-gray-600 dark:text-gray-300" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-gray-600 dark:text-gray-300" />
          )}
        </button>
      </div>

      {/* Mobile Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:hidden',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center px-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-600 to-primary-700">
          <div className="flex items-center">
            {systemLogo ? (
              <img 
                src={`/${systemLogo}`} 
                alt={systemName}
                className="w-10 h-10 rounded-lg object-contain shadow-lg bg-white p-1"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg';
                    fallback.innerHTML = '<span class="text-primary-700 font-bold text-sm">' + systemName.substring(0, 2).toUpperCase() + '</span>';
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-primary-700 font-bold text-sm">
                  {systemName.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className="ml-3">
              <span className="text-white text-lg font-bold block leading-tight">
                {systemName}
              </span>
              <span className="text-primary-100 text-xs block leading-tight">
                {systemSubtitle}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col px-3 py-4 space-y-2 overflow-y-auto">
          {visibleSections.map(section => renderSection(section))}
        </nav>

        {/* User Info & Profile */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
          <NavLink
            to="/profile"
            onClick={onClose}
            className={({ isActive }) =>
              clsx(
                'flex items-center p-4 transition-colors duration-200',
                isActive && 'bg-primary-50 dark:bg-primary-900/20'
              )
            }
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-md">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize truncate">
                {user?.role === 'admin' ? 'Administrador' : user?.role === 'attendant' ? 'Atendente' : 'Usuário'}
              </p>
            </div>
          </NavLink>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
