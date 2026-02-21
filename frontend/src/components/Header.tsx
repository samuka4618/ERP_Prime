import React, { useState, useEffect } from 'react';
import { Menu, Bell, User, LogOut, Bug } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Notifications from './Notifications';
import LogViewer from './LogViewer';
import ThemeToggle from './ThemeToggle';
import UserAvatar from './UserAvatar';
import { apiService } from '../services/api';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await apiService.getUnreadNotificationCount();
        setUnreadCount(count);
      } catch (error) {
        console.error('Erro ao carregar contagem de notificações:', error);
        setUnreadCount(0);
        toast.error('Não foi possível carregar as notificações.');
      }
    };

    if (user) {
      fetchUnreadCount();
    }
  }, [user]);

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
      {/* Left side - apenas botão de menu para mobile */}
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Log Viewer - apenas em desenvolvimento */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => setShowLogViewer(true)}
            aria-label="Visualizar logs"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            <Bug className="w-5 h-5" />
          </button>
        )}

                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    aria-label={unreadCount > 0 ? `${unreadCount} notificações não lidas` : 'Notificações'}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
          <Notifications 
            isOpen={showNotifications} 
            onClose={() => setShowNotifications(false)}
            onNotificationRead={() => {
              // Atualizar contagem quando notificação for lida
              apiService.getUnreadNotificationCount().then(setUnreadCount).catch(console.error);
            }}
          />
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="Menu do usuário"
            aria-expanded={showUserMenu}
            className="flex items-center space-x-2 min-h-[44px] min-w-[44px] p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            <UserAvatar user={user} size="sm" className="border-2 border-gray-300 dark:border-gray-600" />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.role}</p>
            </div>
          </button>

          {/* Dropdown menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-[60] border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  navigate('/profile');
                  setShowUserMenu(false);
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <User className="w-4 h-4 mr-3" />
                Meu Perfil
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile menu - apenas em mobile */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setShowUserMenu(false)}
        />
      )}

      {/* Log Viewer */}
      <LogViewer 
        isOpen={showLogViewer} 
        onClose={() => setShowLogViewer(false)} 
      />
    </header>
  );
};

export default Header;
