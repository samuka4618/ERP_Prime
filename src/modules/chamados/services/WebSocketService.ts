import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../../../config/database';
import { logger } from '../../../shared/utils/logger';

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const ACCESS_COOKIE_NAME = 'token';
const isProd = config.nodeEnv === 'production';

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

/** JWT do handshake: cookie httpOnly (preferido), Authorization: Bearer, ou ?token= (legado). */
function extractWsJwt(request: IncomingMessage): string | null {
  const auth = request.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (JWT_RE.test(t)) return t;
  }
  const fromCookie = parseCookies(request.headers.cookie)[ACCESS_COOKIE_NAME];
  if (fromCookie && JWT_RE.test(fromCookie)) return fromCookie;

  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    const q = url.searchParams.get('token');
    if (q && JWT_RE.test(q)) {
      if (isProd) {
        logger.warn('WebSocket: token na query string é legado; use cookie ou Authorization', {}, 'WEBSOCKET');
      }
      return q;
    }
  } catch {
    /* ignore */
  }
  return null;
}

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

      if (!isProd) logger.info('WebSocket Server inicializado', undefined, 'WEBSOCKET');
      this.setupWebSocketServer();
      this.startHeartbeat();
    } catch (error) {
      logger.error('Erro ao inicializar WebSocket Server', error, 'WEBSOCKET');
    }
  }

  private setupWebSocketServer() {
    if (!this.wss) return;
    this.wss.on('connection', (ws: WebSocket, request) => {
      if (!isProd) {
        logger.debug('WebSocket: nova conexão', { url: request.url }, 'WEBSOCKET');
      }

      const token = extractWsJwt(request);
      if (!token) {
        logger.warn('WebSocket: token ausente (cookie, Authorization ou query legada)', {}, 'WEBSOCKET');
        ws.close(1008, 'Token não fornecido');
        return;
      }

      try {
        const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload & { userId?: number };
        const userId = typeof decoded.userId === 'number' ? decoded.userId : undefined;
        if (userId == null) {
          ws.close(1008, 'Token inválido');
          return;
        }

        if (!isProd) {
          logger.debug('WebSocket: JWT válido', { userId }, 'WEBSOCKET');
        }

        const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const client: WebSocketClient = {
          id: clientId,
          userId,
          ticketId: undefined,
          ws,
          lastHeartbeat: Date.now()
        };

        this.clients.set(clientId, client);

        this.sendToClient(clientId, {
          type: 'connection',
          data: { message: 'Conectado ao sistema de tempo real' },
          timestamp: new Date().toISOString()
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(clientId, message);
          } catch (_error) {
            if (!isProd) logger.debug('WebSocket: mensagem inválida', {}, 'WEBSOCKET');
          }
        });

        ws.on('close', () => {
          this.clients.delete(clientId);
        });

        ws.on('error', (error) => {
          logger.warn('Erro no cliente WebSocket', { clientId, err: (error as Error).message }, 'WEBSOCKET');
          this.clients.delete(clientId);
        });
      } catch (error) {
        logger.warn('WebSocket: JWT inválido', { err: (error as Error).message }, 'WEBSOCKET');
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
        if (!isProd) logger.debug('WebSocket: inscrito no ticket', { clientId, ticketId: message.ticketId }, 'WEBSOCKET');
        break;
      default:
        if (!isProd) logger.debug('WebSocket: tipo desconhecido', { type: message.type }, 'WEBSOCKET');
    }
  }

  private sendToClient(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) {
      if (!isProd) logger.debug('WebSocket: cliente não encontrado', { clientId }, 'WEBSOCKET');
      return;
    }

    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      } else {
        this.clients.delete(clientId);
      }
    } catch (error) {
      logger.warn('WebSocket: erro ao enviar', { clientId, err: (error as Error).message }, 'WEBSOCKET');
      this.clients.delete(clientId);
    }
  }

  public sendMessageToTicket(ticketId: number, message: any, excludeUserId?: number) {
    if (!isProd) {
      logger.debug('WebSocket: enviar mensagem ticket', { ticketId, totalClients: this.clients.size, excludeUserId }, 'WEBSOCKET');
    }

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

    if (!isProd) {
      logger.debug('WebSocket: mensagem enviada ticket', { ticketId, sentCount, excludeUserId }, 'WEBSOCKET');
    }
  }

  public sendTicketUpdate(ticketId: number, update: any, excludeUserId?: number) {
    if (!isProd) {
      logger.debug('WebSocket: enviar atualização ticket', { ticketId, totalClients: this.clients.size, excludeUserId }, 'WEBSOCKET');
    }

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

    if (!isProd) {
      logger.debug('WebSocket: atualização enviada ticket', { ticketId, sentCount, excludeUserId }, 'WEBSOCKET');
    }
  }

  public sendNotificationToUser(userId: number, notification: any) {
    if (!isProd) {
      logger.debug('WebSocket: enviar notificação', { userId, totalClients: this.clients.size }, 'WEBSOCKET');
    }

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

    if (!isProd) {
      logger.debug('WebSocket: notificação enviada', { userId, sentCount }, 'WEBSOCKET');
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 segundos

      for (const [clientId, client] of this.clients) {
        if (now - client.lastHeartbeat > timeout) {
          if (!isProd) logger.debug('WebSocket: cliente inativo', { clientId }, 'WEBSOCKET');
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
