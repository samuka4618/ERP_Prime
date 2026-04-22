import { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '../utils/logger';
import { getApiOriginUrl } from '../utils/apiUrl';

interface RealtimeEvent {
  type: 'message' | 'ticket_update' | 'notification' | 'heartbeat' | 'connection';
  ticketId?: number;
  userId?: number;
  data: any;
  timestamp: string;
}

interface UseRealtimeOptions {
  ticketId?: number;
  onMessage?: (message: any) => void;
  onTicketUpdate?: (update: any) => void;
  onNotification?: (notification: any) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export const useRealtime = (options: UseRealtimeOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnectingRef = useRef(false);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 segundos

  const { ticketId, onMessage, onTicketUpdate, onNotification, onConnectionChange } = options;

  const connect = useCallback(() => {
    // Evitar múltiplas conexões simultâneas
    if (isConnectingRef.current) {
      logger.debug('Conexão SSE já em andamento, ignorando nova tentativa', {}, 'REALTIME');
      return;
    }

    if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.CLOSED) {
      logger.debug('Conexão SSE já existe, ignorando nova tentativa', {}, 'REALTIME');
      return;
    }

    isConnectingRef.current = true;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Token de autenticação não encontrado');
      isConnectingRef.current = false;
      return;
    }

    try {
      // Usar VITE_API_URL quando definido (deploy Vercel + Render); senão /api/realtime ou origem:port
      const origin = getApiOriginUrl();
      const baseURL = origin.startsWith('http') ? `${origin}/api/realtime` : '/api/realtime';

      const url = ticketId 
        ? `${baseURL}/ticket/${ticketId}?token=${encodeURIComponent(token)}`
        : `${baseURL}/notifications?token=${encodeURIComponent(token)}`;

      logger.info('Conectando ao SSE', { url, ticketId }, 'REALTIME');

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        logger.info('SSE conectado com sucesso', { ticketId }, 'REALTIME');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;
        onConnectionChange?.(true);
      };

      eventSource.onmessage = (event) => {
        try {
          console.log('🔔 EVENTO SSE RECEBIDO (RAW):', event.data);
          logger.info('Evento SSE recebido (raw)', { 
            data: event.data, 
            ticketId 
          }, 'REALTIME');
          
          const data: RealtimeEvent = JSON.parse(event.data);
          console.log('🔔 EVENTO SSE PROCESSADO:', data);
          logger.info('Evento SSE processado', { 
            type: data.type,
            ticketId: data.ticketId,
            data: data.data 
          }, 'REALTIME');

          switch (data.type) {
            case 'message':
              console.log('🔔 PROCESSANDO MENSAGEM:', data.data);
              logger.info('Processando mensagem em tempo real', { message: data.data }, 'REALTIME');
              onMessage?.(data.data);
              break;
            case 'ticket_update':
              console.log('🔔 PROCESSANDO ATUALIZAÇÃO DE TICKET:', data.data);
              logger.info('Processando atualização de ticket em tempo real', { update: data.data }, 'REALTIME');
              onTicketUpdate?.(data.data);
              break;
            case 'notification':
              logger.info('Processando notificação em tempo real', { notification: data.data }, 'REALTIME');
              onNotification?.(data.data);
              break;
            case 'heartbeat':
              logger.debug('Heartbeat recebido', {}, 'REALTIME');
              break;
            case 'connection':
              logger.info('Conexão SSE estabelecida', { data }, 'REALTIME');
              break;
            default:
              logger.warn('Tipo de evento SSE desconhecido', { type: data.type }, 'REALTIME');
          }
        } catch (error) {
          logger.error('Erro ao processar evento SSE', { error, eventData: event.data }, 'REALTIME');
        }
      };

      eventSource.onerror = (error) => {
        logger.error('Erro na conexão SSE', { error, ticketId }, 'REALTIME');
        setIsConnected(false);
        isConnectingRef.current = false;
        onConnectionChange?.(false);
        
        if (eventSource.readyState === EventSource.CLOSED) {
          setError('Conexão fechada pelo servidor');
          attemptReconnect();
        } else {
          setError('Erro na conexão de tempo real');
        }
      };

    } catch (error) {
      logger.error('Erro ao criar conexão SSE', { error, ticketId }, 'REALTIME');
      setError('Erro ao conectar ao sistema de tempo real');
      isConnectingRef.current = false;
    }
  }, [ticketId, onMessage, onTicketUpdate, onNotification, onConnectionChange]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      logger.error('Máximo de tentativas de reconexão atingido', {}, 'REALTIME');
      setError('Não foi possível reconectar ao sistema de tempo real');
      return;
    }

    reconnectAttempts.current++;
    const delay = reconnectDelay * Math.pow(2, reconnectAttempts.current - 1); // Backoff exponencial

    logger.info(`Tentativa de reconexão ${reconnectAttempts.current}/${maxReconnectAttempts} em ${delay}ms`, {}, 'REALTIME');

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    isConnectingRef.current = false;
    setIsConnected(false);
    onConnectionChange?.(false);
    logger.info('SSE desconectado', { ticketId }, 'REALTIME');
  }, [ticketId, onConnectionChange]);

  const sendHeartbeat = useCallback(async () => {
    if (!isConnected) return;

    try {
      const origin = getApiOriginUrl();
      const baseURL = origin.startsWith('http') ? `${origin}/api/realtime` : '/api/realtime';

      const response = await fetch(`${baseURL}/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ clientId: 'frontend' })
      });

      if (!response.ok) {
        logger.warn('Falha no heartbeat', { status: response.status }, 'REALTIME');
      }
    } catch (error) {
      logger.warn('Erro no heartbeat', { error }, 'REALTIME');
    }
  }, [isConnected]);

  // Conectar automaticamente quando o hook for montado
  useEffect(() => {
    connect();

    // Heartbeat a cada 30 segundos
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000);

    return () => {
      disconnect();
    };
  }, []); // Dependências vazias para executar apenas uma vez

  // Reconectar quando ticketId mudar
  useEffect(() => {
    if (isConnected) {
      disconnect();
      // Pequeno delay para evitar reconexões muito rápidas
      const timeoutId = setTimeout(() => {
        connect();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [ticketId]); // Apenas ticketId como dependência

  return {
    isConnected,
    error,
    connect,
    disconnect,
    sendHeartbeat
  };
};
