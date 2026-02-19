import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../../../config/database';
import { logger } from '../../../shared/utils/logger';

interface WebSocketClient {
  id: string;
  userId: number;
  ticketId?: number;
  ws: WebSocket;
  lastHeartbeat: number;
}

interface WebSocketMessage {
  type: 'message' | 'ticket_update' | 'notification' | 'heartbeat' | 'connection';
  ticketId?: number;
  data: any;
  timestamp: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    try {
      this.wss = new WebSocketServer({ 
        server,
        path: '/ws',
        perMessageDeflate: false
      });

      console.log('🔌 WebSocket Server inicializado');
      this.setupWebSocketServer();
      this.startHeartbeat();
    } catch (error) {
      console.error('❌ Erro ao inicializar WebSocket Server:', error);
    }
  }

  private setupWebSocketServer() {
    if (!this.wss) return;
    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('🔌 WebSocket: Nova conexão recebida');
      console.log('🔌 WebSocket: URL:', request.url);
      console.log('🔌 WebSocket: Headers:', request.headers);
      
      // Extrair token da URL
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token = url.searchParams.get('token');
      
      console.log('🔌 WebSocket: Token extraído:', token ? 'Presente' : 'Ausente');
      
      if (!token) {
        console.log('❌ WebSocket: Token não fornecido');
        ws.close(1008, 'Token não fornecido');
        return;
      }

      try {
        console.log('🔌 WebSocket: Verificando token JWT...');
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        console.log('🔌 WebSocket: Token válido para usuário', decoded.userId);
        console.log('🔌 WebSocket: Payload do token:', decoded);
        console.log('🔌 WebSocket: Token expira em:', new Date(decoded.exp * 1000));
        
        const clientId = `${decoded.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const client: WebSocketClient = {
          id: clientId,
          userId: decoded.userId,
          ticketId: undefined,
          ws,
          lastHeartbeat: Date.now()
        };

        this.clients.set(clientId, client);
        console.log(`🔌 WebSocket: Cliente conectado ${clientId} (total: ${this.clients.size})`);

        // Enviar mensagem de conexão
        this.sendToClient(clientId, {
          type: 'connection',
          data: { message: 'Conectado ao sistema de tempo real' },
          timestamp: new Date().toISOString()
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(clientId, message);
          } catch (error) {
            console.log('❌ WebSocket: Erro ao processar mensagem', error);
          }
        });

        ws.on('close', () => {
          console.log(`🔌 WebSocket: Cliente desconectado ${clientId}`);
          this.clients.delete(clientId);
        });

        ws.on('error', (error) => {
          console.log(`❌ ===== ERRO NO CLIENTE WEBSOCKET =====`);
          console.log(`❌ Cliente ID: ${clientId}`);
          console.log(`❌ Usuário ID: ${decoded.userId}`);
          console.log(`❌ Erro:`, error);
          console.log(`❌ ReadyState:`, ws.readyState);
          console.log(`❌ URL:`, request.url);
          console.log(`❌ Headers:`, request.headers);
          console.log(`❌ ======================================`);
          this.clients.delete(clientId);
        });

      } catch (error) {
        console.log('❌ ===== ERRO DE TOKEN JWT =====');
        console.log('❌ Erro:', error);
        console.log('❌ Token recebido:', token ? 'Presente' : 'Ausente');
        console.log('❌ Tipo do erro:', (error as any).name);
        console.log('❌ Mensagem do erro:', (error as any).message);
        console.log('❌ URL:', request.url);
        console.log('❌ Headers:', request.headers);
        console.log('❌ ==============================');
        ws.close(1008, 'Token inválido');
      }
    });
  }

  private handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'heartbeat':
        client.lastHeartbeat = Date.now();
        break;
      case 'subscribe_ticket':
        client.ticketId = message.ticketId;
        console.log(`🔌 WebSocket: Cliente ${clientId} inscrito no ticket ${message.ticketId}`);
        break;
      default:
        console.log(`🔌 WebSocket: Tipo de mensagem desconhecido: ${message.type}`);
    }
  }

  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.log(`🔌 WebSocket: Cliente ${clientId} não encontrado`);
      return;
    }

    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      } else {
        this.clients.delete(clientId);
      }
    } catch (error) {
      console.log(`❌ WebSocket: Erro ao enviar para ${clientId}`, error);
      this.clients.delete(clientId);
    }
  }

  public sendMessageToTicket(ticketId: number, message: any, excludeUserId?: number) {
    console.log(`🔌 WebSocket: Enviando mensagem para ticket ${ticketId}`, {
      ticketId,
      totalClients: this.clients.size,
      excludeUserId
    });

    let sentCount = 0;
    for (const [clientId, client] of this.clients) {
      if (client.ticketId === ticketId) {
        // Não excluir o próprio usuário para que veja sua mensagem
        this.sendToClient(clientId, {
          type: 'message',
          ticketId,
          data: message,
          timestamp: new Date().toISOString()
        });
        sentCount++;
      }
    }

    console.log(`🔌 WebSocket: Mensagem enviada para ticket ${ticketId}`, {
      ticketId,
      sentCount,
      excludeUserId,
      totalClients: this.clients.size
    });
  }

  public sendTicketUpdate(ticketId: number, update: any, excludeUserId?: number) {
    console.log(`🔌 WebSocket: Enviando atualização para ticket ${ticketId}`, {
      ticketId,
      totalClients: this.clients.size,
      excludeUserId
    });

    let sentCount = 0;
    for (const [clientId, client] of this.clients) {
      if (client.ticketId === ticketId && client.userId !== excludeUserId) {
        this.sendToClient(clientId, {
          type: 'ticket_update',
          ticketId,
          data: update,
          timestamp: new Date().toISOString()
        });
        sentCount++;
      }
    }

    console.log(`🔌 WebSocket: Atualização enviada para ticket ${ticketId}`, {
      ticketId,
      sentCount,
      excludeUserId,
      totalClients: this.clients.size
    });
  }

  public sendNotificationToUser(userId: number, notification: any) {
    console.log(`🔌 WebSocket: Enviando notificação para usuário ${userId}`, {
      userId,
      totalClients: this.clients.size
    });

    let sentCount = 0;
    for (const [clientId, client] of this.clients) {
      if (client.userId === userId) {
        this.sendToClient(clientId, {
          type: 'notification',
          data: notification,
          timestamp: new Date().toISOString()
        });
        sentCount++;
      }
    }

    console.log(`🔌 WebSocket: Notificação enviada para usuário ${userId}`, {
      userId,
      sentCount,
      totalClients: this.clients.size
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 segundos

      for (const [clientId, client] of this.clients) {
        if (now - client.lastHeartbeat > timeout) {
          console.log(`🔌 WebSocket: Cliente ${clientId} inativo, removendo`);
          client.ws.close();
          this.clients.delete(clientId);
        }
      }
    }, 10000); // Verificar a cada 10 segundos
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }
}

let webSocketService: WebSocketService | null = null;

export const initializeWebSocket = (server: Server) => {
  webSocketService = new WebSocketService(server);
  return webSocketService;
};

export const getWebSocketService = () => webSocketService;
