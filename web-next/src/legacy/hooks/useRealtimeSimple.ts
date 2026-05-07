import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';
import { getApiOriginUrl } from '../utils/apiUrl';

interface RealtimeEvent {
  type: 'message' | 'ticket_update' | 'notification' | 'heartbeat' | 'connection';
  ticketId?: number;
  data: any;
  timestamp: string;
}

interface UseRealtimeSimpleOptions {
  ticketId?: number;
  onMessage?: (message: any) => void;
  onTicketUpdate?: (update: any) => void;
  onNotification?: (notification: any) => void;
  onError?: (error: any) => void;
}

export const useRealtimeSimple = ({
  ticketId,
  onMessage,
  onTicketUpdate,
  onNotification,
  onError
}: UseRealtimeSimpleOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    if (isConnectingRef.current || (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN)) {
      console.log('🔔 SSE já conectado ou conectando, ignorando');
      return;
    }

    isConnectingRef.current = true;
    setError(null);

    try {
      // Fechar conexão anterior se existir
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const origin = getApiOriginUrl();
      const baseURL = origin.startsWith('http') ? `${origin}/api/realtime` : '/api/realtime';
      const url = `${baseURL}/ticket/${ticketId}`;

      console.log('🔔 Conectando ao SSE:', url);
      logger.info('Conectando ao SSE', { url, ticketId }, 'REALTIME');

      eventSourceRef.current = new EventSource(url);

      eventSourceRef.current.onopen = () => {
        console.log('🔔 SSE conectado com sucesso');
        logger.info('SSE conectado com sucesso', { ticketId }, 'REALTIME');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;

        // Heartbeat removido para evitar erros 400
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          console.log('🔔 SSE MESSAGE:', event.data);
          logger.info('SSE MESSAGE', { data: event.data, ticketId }, 'REALTIME');

          const data: RealtimeEvent = JSON.parse(event.data);
          console.log('🔔 SSE EVENTO PROCESSADO:', data);
          logger.info('SSE EVENTO PROCESSADO', { type: data.type, ticketId: data.ticketId, data: data.data }, 'REALTIME');

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
              console.log('🔔 PROCESSANDO NOTIFICAÇÃO:', data.data);
              logger.info('Processando notificação em tempo real', { notification: data.data }, 'REALTIME');
              onNotification?.(data.data);
              break;
            case 'connection':
              console.log('🔔 CONEXÃO ESTABELECIDA:', data.data);
              logger.info('Conexão SSE estabelecida', { message: data.data }, 'REALTIME');
              break;
            case 'heartbeat':
              console.log('🔔 HEARTBEAT RECEBIDO');
              break;
            default:
              console.log('🔔 TIPO DE EVENTO DESCONHECIDO:', data.type);
          }
        } catch (e) {
          console.error('❌ ERRO AO PROCESSAR MENSAGEM SSE:', e);
          logger.error('Erro ao processar mensagem SSE', { error: e, eventData: event.data }, 'REALTIME');
        }
      };

      eventSourceRef.current.onerror = (event) => {
        console.error('❌ Erro no SSE:', event);
        logger.error('Erro no SSE', { error: event, ticketId }, 'REALTIME');
        setError('Erro na conexão SSE');
        isConnectingRef.current = false;
        setIsConnected(false);


        // Tentar reconectar
        attemptReconnect();
        onError?.(event);
      };

    } catch (error) {
      console.error('❌ Erro ao conectar SSE:', error);
      logger.error('Erro ao conectar SSE', { error, ticketId }, 'REALTIME');
      setError('Erro ao conectar SSE');
      isConnectingRef.current = false;
    }
  }, [ticketId, onMessage, onTicketUpdate, onNotification, onError]);


  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts.current >= 5) {
      console.log('🔔 Máximo de tentativas de reconexão atingido');
      logger.warn('Máximo de tentativas de reconexão SSE atingido', { ticketId }, 'REALTIME');
      setError('Falha na conexão SSE após múltiplas tentativas');
      return;
    }

    reconnectAttempts.current++;
    const delay = Math.min(2000 * reconnectAttempts.current, 10000);
    
    console.log(`🔔 Tentando reconectar SSE em ${delay}ms (tentativa ${reconnectAttempts.current})`);
    logger.info('Tentando reconectar SSE', { delay, attempt: reconnectAttempts.current, ticketId }, 'REALTIME');

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isConnectingRef.current) {
        connect();
      }
    }, delay);
  }, [connect, ticketId]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }


    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    setError(null);
    reconnectAttempts.current = 0;
    isConnectingRef.current = false;
  }, []);

  // Conectar quando o hook é montado
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);

  // Reconectar quando ticketId muda
  useEffect(() => {
    if (ticketId && isConnected) {
      // SSE não precisa de reinscrição, já está conectado ao ticket específico
      console.log('🔔 Ticket mudou para:', ticketId);
    }
  }, [ticketId, isConnected]);

  return {
    isConnected,
    error,
    connect,
    disconnect
  };
};
