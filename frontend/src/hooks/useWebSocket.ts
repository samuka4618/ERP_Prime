import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';
import { useRealtime } from './useRealtime';

// Função para obter a URL base do servidor automaticamente
function getServerBaseUrl(): string {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const port = window.location.port || '3000';
  
  // Se estiver em localhost, usar localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//localhost:${port}`;
  }
  
  // Caso contrário, usar o hostname atual (pode ser IP ou domínio)
  return `${protocol}//${hostname}:${port}`;
}

interface WebSocketEvent {
  type: 'message' | 'ticket_update' | 'notification' | 'heartbeat' | 'connection';
  ticketId?: number;
  data: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  ticketId?: number;
  onMessage?: (message: any) => void;
  onTicketUpdate?: (update: any) => void;
  onNotification?: (notification: any) => void;
  onError?: (error: any) => void;
}

export const useWebSocket = ({
  ticketId,
  onMessage,
  onTicketUpdate,
  onNotification,
  onError
}: UseWebSocketOptions) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const isConnectingRef = useRef(false);

  // Fallback para SSE quando WebSocket falha
  const { isConnected: sseConnected } = useRealtime({
    ticketId,
    onMessage,
    onTicketUpdate,
    onNotification
  });

  const connect = useCallback(async () => {
    if (isConnectingRef.current) {
      console.log('🔌 WebSocket já conectando, ignorando');
      return;
    }

    // Se já está conectado, não reconectar
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('🔌 WebSocket já conectado');
      return;
    }

    isConnectingRef.current = true;
    setError(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ Token não encontrado no localStorage');
        setError('Token não encontrado');
        isConnectingRef.current = false;
        return;
      }

      // Verificar se o token não expirou
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          console.error('❌ Token JWT expirado');
          setError('Token expirado');
          isConnectingRef.current = false;
          return;
        }
        console.log('🔌 Token JWT válido, expira em:', new Date(payload.exp * 1000));
      } catch (error) {
        console.error('❌ Erro ao verificar token JWT:', error);
        setError('Token inválido');
        isConnectingRef.current = false;
        return;
      }

      // Fechar conexão anterior se existir
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Obter URL base do servidor
      const serverBaseUrl = getServerBaseUrl();
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.hostname;
      const wsPort = window.location.port || '3000';
      
      // Verificar conectividade primeiro
      console.log('🔌 Verificando conectividade com o servidor...');
      try {
        const healthUrl = `${serverBaseUrl}/health`;
        const response = await fetch(healthUrl, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache'
        });
        console.log('🔌 Servidor respondeu:', response.status, response.statusText);
      } catch (error) {
        console.error('❌ Erro ao verificar conectividade:', error);
        setError('Servidor não acessível');
        isConnectingRef.current = false;
        return;
      }

      const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws?token=${encodeURIComponent(token)}`;
      console.log('🔌 ===== CONECTANDO AO WEBSOCKET =====');
      console.log('🔌 URL completa:', wsUrl);
      console.log('🔌 Token (primeiros 50 chars):', token.substring(0, 50) + '...');
      console.log('🔌 Ticket ID:', ticketId);
      console.log('🔌 Timestamp atual:', new Date().toISOString());
      console.log('🔌 ====================================');
      
      logger.info('Conectando ao WebSocket', { 
        url: wsUrl, 
        ticketId,
        tokenLength: token.length,
        timestamp: new Date().toISOString()
      }, 'REALTIME');

      wsRef.current = new WebSocket(wsUrl);
      
      console.log('🔌 WebSocket criado, readyState inicial:', wsRef.current.readyState);
      
      // Adicionar timeout para detectar problemas de conexão
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
          console.error('❌ Timeout na conexão WebSocket após 10 segundos');
          wsRef.current.close();
          setError('Timeout na conexão WebSocket');
          isConnectingRef.current = false;
        }
      }, 10000);
      
      // Limpar timeout quando conectar
      const originalOnOpen = wsRef.current.onopen;
      wsRef.current.onopen = (event) => {
        clearTimeout(connectionTimeout);
        if (originalOnOpen && wsRef.current) originalOnOpen.call(wsRef.current, event);
      };

      wsRef.current.onopen = () => {
        console.log('🔌 WebSocket conectado com sucesso');
        logger.info('WebSocket conectado com sucesso', { ticketId }, 'REALTIME');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        isConnectingRef.current = false;

        // Inscrever no ticket se especificado (aguardar conexão completa)
        if (ticketId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const subscribeMessage = {
            type: 'subscribe_ticket',
            ticketId: ticketId
          };
          wsRef.current.send(JSON.stringify(subscribeMessage));
          console.log('🔌 Inscrito no ticket:', ticketId);
        } else if (ticketId) {
          // Se ainda não estiver conectado, aguardar um pouco e tentar novamente
          setTimeout(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const subscribeMessage = {
                type: 'subscribe_ticket',
                ticketId: ticketId
              };
              wsRef.current.send(JSON.stringify(subscribeMessage));
              console.log('🔌 Inscrito no ticket (tentativa 2):', ticketId);
            }
          }, 100);
        }

        // Iniciar heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            try {
              wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
              console.log('💓 Heartbeat enviado');
            } catch (error) {
              console.error('❌ Erro ao enviar heartbeat:', error);
            }
          }
        }, 30000); // Heartbeat a cada 30 segundos
      };

      wsRef.current.onmessage = (event) => {
        try {
          console.log('🔌 WebSocket MESSAGE:', event.data);
          logger.info('WebSocket MESSAGE', { data: event.data, ticketId }, 'REALTIME');

          const data: WebSocketEvent = JSON.parse(event.data);
          console.log('🔌 WebSocket EVENTO PROCESSADO:', data);
          logger.info('WebSocket EVENTO PROCESSADO', { type: data.type, ticketId: data.ticketId, data: data.data }, 'REALTIME');

          switch (data.type) {
            case 'message':
              console.log('🔌 PROCESSANDO MENSAGEM:', data.data);
              logger.info('Processando mensagem em tempo real', { message: data.data }, 'REALTIME');
              onMessage?.(data.data);
              break;
            case 'ticket_update':
              console.log('🔌 PROCESSANDO ATUALIZAÇÃO DE TICKET:', data.data);
              logger.info('Processando atualização de ticket em tempo real', { update: data.data }, 'REALTIME');
              onTicketUpdate?.(data.data);
              break;
            case 'notification':
              console.log('🔌 PROCESSANDO NOTIFICAÇÃO:', data.data);
              logger.info('Processando notificação em tempo real', { notification: data.data }, 'REALTIME');
              onNotification?.(data.data);
              break;
            case 'connection':
              console.log('🔌 CONEXÃO ESTABELECIDA:', data.data);
              logger.info('Conexão WebSocket estabelecida', { message: data.data }, 'REALTIME');
              break;
            case 'heartbeat':
              console.log('🔌 HEARTBEAT RECEBIDO');
              break;
            default:
              console.log('🔌 TIPO DE EVENTO DESCONHECIDO:', data.type);
          }
        } catch (e) {
          console.error('❌ ERRO AO PROCESSAR MENSAGEM WEBSOCKET:', e);
          logger.error('Erro ao processar mensagem WebSocket', { error: e, eventData: event.data }, 'REALTIME');
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 ===== WEBSOCKET FECHADO =====');
        console.log('🔌 Código:', event.code);
        console.log('🔌 Motivo:', event.reason);
        console.log('🔌 Foi limpo:', event.wasClean);
        console.log('🔌 ReadyState no close:', wsRef.current?.readyState);
        console.log('🔌 Ticket ID:', ticketId);
        console.log('🔌 =============================');
        
        logger.info('WebSocket fechado', { 
          code: event.code, 
          reason: event.reason, 
          wasClean: event.wasClean,
          readyState: wsRef.current?.readyState,
          ticketId 
        }, 'REALTIME');
        setIsConnected(false);
        isConnectingRef.current = false;

        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Tentar reconectar se não foi fechado intencionalmente
        if (event.code !== 1000 && event.code !== 1001) {
          attemptReconnect();
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('❌ ===== ERRO NO WEBSOCKET =====');
        console.error('❌ Evento:', event);
        console.error('❌ Tipo do evento:', event.type);
        console.error('❌ Timestamp:', event.timeStamp);
        console.error('❌ WebSocket readyState:', wsRef.current?.readyState);
        console.error('❌ WebSocket url:', wsRef.current?.url);
        console.error('❌ WebSocket protocol:', wsRef.current?.protocol);
        console.error('❌ WebSocket extensions:', wsRef.current?.extensions);
        console.error('❌ WebSocket binaryType:', wsRef.current?.binaryType);
        console.error('❌ WebSocket bufferedAmount:', wsRef.current?.bufferedAmount);
        console.error('❌ WebSocket CONNECTING:', WebSocket.CONNECTING);
        console.error('❌ WebSocket OPEN:', WebSocket.OPEN);
        console.error('❌ WebSocket CLOSING:', WebSocket.CLOSING);
        console.error('❌ WebSocket CLOSED:', WebSocket.CLOSED);
        
        // Tentar decodificar o token para debug
        try {
          const url = new URL(wsRef.current?.url || '');
          const token = url.searchParams.get('token');
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.error('❌ Token payload:', payload);
            console.error('❌ Token expira em:', new Date(payload.exp * 1000));
            console.error('❌ Token é válido agora:', payload.exp > Math.floor(Date.now() / 1000));
          }
        } catch (e) {
          console.error('❌ Erro ao decodificar token:', e);
        }
        
        console.error('❌ ================================');
        
        logger.error('Erro no WebSocket', { 
          error: event, 
          ticketId, 
          readyState: wsRef.current?.readyState,
          url: wsRef.current?.url,
          protocol: wsRef.current?.protocol,
          extensions: wsRef.current?.extensions,
          binaryType: wsRef.current?.binaryType,
          bufferedAmount: wsRef.current?.bufferedAmount,
          eventType: event.type,
          eventTimestamp: event.timeStamp
        }, 'REALTIME');
        setError('Erro na conexão WebSocket');
        isConnectingRef.current = false;
        
        // Usar fallback SSE imediatamente
        setUseFallback(true);
        console.log('🔌 WebSocket falhou, usando fallback SSE');
        
        onError?.(event);
      };

    } catch (error) {
      console.error('❌ Erro ao conectar WebSocket:', error);
      logger.error('Erro ao conectar WebSocket', { error, ticketId }, 'REALTIME');
      setError('Erro ao conectar WebSocket');
      isConnectingRef.current = false;
    }
  }, [ticketId, onMessage, onTicketUpdate, onNotification, onError]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts.current >= 3) {
      console.log('🔌 Máximo de tentativas de reconexão atingido, usando fallback SSE');
      logger.warn('Máximo de tentativas de reconexão WebSocket atingido, usando fallback SSE', { ticketId }, 'REALTIME');
      setUseFallback(true);
      setError('WebSocket falhou, usando SSE como fallback');
      return;
    }

    reconnectAttempts.current++;
    const delay = Math.min(2000 * reconnectAttempts.current, 10000);
    
    console.log(`🔌 Tentando reconectar WebSocket em ${delay}ms (tentativa ${reconnectAttempts.current})`);
    logger.info('Tentando reconectar WebSocket', { delay, attempt: reconnectAttempts.current, ticketId }, 'REALTIME');

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

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Desconexão intencional');
      wsRef.current = null;
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
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const subscribeMessage = {
          type: 'subscribe_ticket',
          ticketId: ticketId
        };
        wsRef.current.send(JSON.stringify(subscribeMessage));
        console.log('🔌 Reinscrito no ticket:', ticketId);
      }
    }
  }, [ticketId, isConnected]);

  return {
    isConnected: useFallback ? sseConnected : isConnected,
    error: useFallback ? null : error,
    connect,
    disconnect
  };
};
