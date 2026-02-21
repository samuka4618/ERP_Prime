import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

export const useActivityTracking = () => {
  const { user } = useAuth();

  const trackActivity = useCallback(async (activity: string) => {
    if (!user) return;
    try {
      await apiService.trackActivity(user.id, activity);
    } catch (error) {
      // Falha silenciosa - não interrompe o fluxo principal
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const timeout = setTimeout(() => {
      trackActivity('page_view');
    }, 1000);

    const interval = setInterval(() => {
      trackActivity('heartbeat');
    }, 60000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [user, trackActivity]);

  return { trackActivity };
};
