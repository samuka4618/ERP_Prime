import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useActivityTracking = () => {
  const { user, token } = useAuth();

  useEffect(() => {
    if (!user || !token) return;

    // Rastrear atividade inicial após um pequeno delay
    const timeout = setTimeout(() => {
      trackActivity('page_view');
    }, 1000);

    // Rastrear atividade periódica para manter usuário como online
    const interval = setInterval(() => {
      trackActivity('heartbeat');
    }, 60000); // A cada 1 minuto

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [user, token]);

  const trackActivity = async (activity: string) => {
    if (!user || !token) return;
    
    try {
      await fetch('/api/admin-metrics/track-activity', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          activity
        })
      });
    } catch (error) {
      // Falha silenciosa - não interrompe o fluxo principal
    }
  };

  return { trackActivity };
};
