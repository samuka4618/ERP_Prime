import React, { useState, useEffect } from 'react';
import { Bell, X, AlertCircle, MessageSquare, Clock, Trash2 } from 'lucide-react';
import { Notification } from '../types';
import { apiService } from '../services/api';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import FormattedDate from './FormattedDate';

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationRead?: () => void;
}

const Notifications: React.FC<NotificationsProps> = ({ isOpen, onClose, onNotificationRead }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiService.getNotifications(1, 10);
      setNotifications(response.data);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      toast.error('Erro ao carregar notificações');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await apiService.markNotificationAsRead(id);
      setNotifications(prev =>
        prev ? prev.map(notif =>
          notif.id === id ? { ...notif, is_read: true } : notif
        ) : []
      );
      onNotificationRead?.();
    } catch (error) {
      toast.error('Erro ao marcar notificação como lida');
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      setNotifications(prev =>
        prev ? prev.map(notif => ({ ...notif, is_read: true })) : []
      );
      onNotificationRead?.();
      toast.success('Todas as notificações foram marcadas como lidas');
    } catch (error) {
      toast.error('Erro ao marcar notificações como lidas');
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await apiService.deleteNotification(id);
      setNotifications(prev => prev ? prev.filter(notif => notif.id !== id) : []);
      onNotificationRead?.();
      toast.success('Notificação excluída com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir notificação');
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Marcar como lida se não estiver lida
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    
    // Redirecionar para o chamado
    if (notification.ticket_id) {
      navigate(`/tickets/${notification.ticket_id}`);
      onClose();
    }
  };

  const handleViewAllNotifications = () => {
    navigate('/notifications');
    onClose();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'status_change':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'new_message':
        return <MessageSquare className="w-4 h-4 text-green-500" />;
      case 'sla_alert':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'ticket_reopened':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-40 bg-black bg-opacity-25"
        onClick={onClose}
      />
      
      {/* Notifications Panel */}
      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white dark:text-white">
            Notificações
          </h3>
          <div className="flex items-center space-x-2">
            {notifications.some(n => !n.is_read) && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Marcar todas como lidas
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Nenhuma notificação
            </div>
          ) : (
            notifications && notifications.length > 0 ? notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${
                        !notification.is_read 
                          ? 'text-gray-900 dark:text-white dark:text-white' 
                          : 'text-gray-700 dark:text-gray-300 dark:text-gray-300'
                      }`}>
                        {notification.title}
                      </p>
                      <div className="flex items-center space-x-2">
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Tem certeza que deseja excluir esta notificação?')) {
                              deleteNotification(notification.id);
                            }
                          }}
                          className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Excluir notificação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p 
                      className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400 mt-1 cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      <FormattedDate date={notification.created_at} />
                    </p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-4 text-center text-gray-500">
                Nenhuma notificação encontrada
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button 
            onClick={handleViewAllNotifications}
            className="w-full text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Ver todas as notificações
          </button>
        </div>
      </div>
    </>
  );
};

export default Notifications;
