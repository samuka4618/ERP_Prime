import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  Ticket, 
  Users, 
  User, 
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Monitor,
  Activity,
  Building2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  isCollapsed, 
  onClose, 
  onToggleCollapse 
}) => {
  const { user, isAdmin } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, current: location.pathname === '/dashboard' },
    { name: 'Chamados', href: '/tickets', icon: Ticket, current: location.pathname.startsWith('/tickets') },
    { name: 'Cadastro de Clientes', href: '/client-registrations', icon: Building2, current: location.pathname.startsWith('/client-registrations') },
    ...(isAdmin ? [{ name: 'Relatórios', href: '/reports', icon: BarChart3, current: location.pathname === '/reports' }] : []),
    ...(isAdmin ? [{ name: 'Monitoramento', href: '/admin-dashboard', icon: Monitor, current: location.pathname === '/admin-dashboard' }] : []),
    ...(isAdmin ? [{ name: 'Performance', href: '/performance', icon: Activity, current: location.pathname === '/performance' }] : []),
    ...(isAdmin ? [{ name: 'Usuários', href: '/users', icon: Users, current: location.pathname === '/users' }] : []),
    ...(isAdmin ? [{ name: 'Configurações', href: '/system-config', icon: Settings, current: location.pathname === '/system-config' }] : []),
    ...(isAdmin ? [{ name: 'Atribuições', href: '/category-assignments', icon: Users, current: location.pathname === '/category-assignments' }] : []),
    { name: 'Perfil', href: '/profile', icon: User, current: location.pathname === '/profile' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={clsx(
        'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 lg:bg-white dark:lg:bg-gray-900 lg:border-r lg:border-gray-200 dark:lg:border-gray-700 transition-all duration-300 overflow-visible',
        isCollapsed ? 'lg:w-16' : 'lg:w-64'
      )}>
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center border-b border-gray-200 dark:border-gray-700">
          <div className={clsx(
            'flex items-center',
            isCollapsed ? 'justify-center w-full px-2' : 'px-4'
          )}>
            <div className={clsx(
              'bg-primary-600 rounded-lg flex items-center justify-center',
              isCollapsed ? 'w-8 h-8' : 'w-8 h-8'
            )}>
              <Ticket className="w-5 h-5 text-white" />
            </div>
            {!isCollapsed && (
              <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">
                Chamados
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'group flex items-center text-sm font-medium rounded-lg transition-colors duration-200',
                    isCollapsed 
                      ? 'justify-center px-2 py-2 mx-1' 
                      : 'px-3 py-2',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-r-2 border-primary-600'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  )
                }
                onClick={onClose}
              >
                <Icon className={clsx(
                  'shrink-0',
                  isCollapsed ? 'w-5 h-5' : 'w-5 h-5'
                )} />
                {!isCollapsed && (
                  <span className="ml-3">{item.name}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
          <div className={clsx(
            'flex items-center',
            isCollapsed ? 'justify-center p-2' : 'p-4'
          )}>
            <div className={clsx(
              'bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center',
              isCollapsed ? 'w-8 h-8' : 'w-8 h-8'
            )}>
              <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </div>
            {!isCollapsed && (
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
              </div>
            )}
          </div>
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
        'fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:hidden',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-white">
              Sistema de Chamados
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col px-4 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-r-2 border-primary-600'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                  )
                }
                onClick={onClose}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="ml-3">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
