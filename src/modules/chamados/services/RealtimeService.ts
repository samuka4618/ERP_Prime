import { Response } from 'express';
import { logger } from '../../../shared/utils/logger';

interface Client {
  id: string;
  userId: number;
  response: Response;
  ticketId?: number;
  lastHeartbeat: number;
}

interface EventData {
  type: 'message' | 'ticket_update' | 'notification' | 'heartbeat' | 'connection';
  ticketId?: number;
  userId?: number;
  data: any;
  timestamp: string;
}

class RealtimeService {
  private clients: Map<string, Client> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Heartbeat a cada 30 segundos
  }

  private sendHeartbeat() {
    const now = Date.now();
    const clientsToRemove: string[] = [];

    this.clients.forEach((client, clientId) => {
      try {
        // Verificar se a conexão ainda está ativa
        if (now - client.lastHeartbeat > 60000) { // 1 minuto sem heartbeat
          clientsToRemove.push(clientId);
          return;
        }

        // Enviar heartbeat
        client.response.write(`data: ${JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString()
        })}\n\n`);
      } catch (error) {
        // Cliente desconectado
        clientsToRemove.push(clientId);
      }
    });

    // Remover clientes desconectados
    clientsToRemove.forEach(clientId => {
      this.clients.delete(clientId);
      logger.debug(`Cliente SSE removido: ${clientId}`, {}, 'REALTIME');
    });
  }

  addClient(userId: number, response: Response, ticketId?: number): string {
    const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const client: Client = {
      id: clientId,
      userId,
      response,
      ticketId,
      lastHeartbeat: Date.now()
    };

    this.clients.set(clientId, client);

    // Configurar headers SSE
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Enviar evento de conexão
    this.sendToClient(clientId, {
      type: 'connection',
      data: { message: 'Conectado ao sistema de tempo real' },
      timestamp: new Date().toISOString()
    });

    logger.info(`Cliente SSE conectado: ${clientId}`, { 
      userId, 
      ticketId,
      totalClients: this.clients.size 
    }, 'REALTIME');

    return clientId;
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.response.end();
      } catch (error) {
        // Ignorar erro ao fechar conexão
      }
      this.clients.delete(clientId);
      logger.debug(`Cliente SSE desconectado: ${clientId}`, {}, 'REALTIME');
    }
  }

  updateHeartbeat(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastHeartbeat = Date.now();
    }
  }

  private sendToClient(clientId: string, eventData: EventData) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        const message = `data: ${JSON.stringify(eventData)}\n\n`;
        
        console.log(`🔔 SEND TO CLIENT: Enviando para ${clientId}`, {
          clientId,
          eventType: eventData.type,
          ticketId: eventData.ticketId,
          messageLength: message.length
        });
        
        // Verificar se a conexão ainda está aberta
        if (client.response.destroyed) {
          console.log(`🔔 SEND TO CLIENT: Conexão já foi fechada para ${clientId}`);
          this.removeClient(clientId);
          return;
        }
        
        client.response.write(message);
        client.lastHeartbeat = Date.now();
        console.log(`🔔 MENSAGEM ESCRITA COM SUCESSO`);
      } catch (error) {
        // Cliente desconectado, remover
        console.log(`🔔 SEND TO CLIENT: ERRO ao enviar para ${clientId}`, error);
        this.clients.delete(clientId);
        logger.warn(`Erro ao enviar evento para cliente ${clientId}`, { error }, 'REALTIME');
      }
    } else {
      console.log(`🔔 SEND TO CLIENT: Cliente ${clientId} não encontrado`);
      logger.warn(`Cliente ${clientId} não encontrado`, {}, 'REALTIME');
    }
  }

  // Enviar mensagem para todos os clientes de um ticket específico
  sendMessageToTicket(ticketId: number, message: any, excludeUserId?: number) {
    const eventData: EventData = {
      type: 'message',
      ticketId,
      data: message,
      timestamp: new Date().toISOString()
    };

    console.log(`🔔 REALTIME: Tentando enviar mensagem para ticket ${ticketId}`, { 
      ticketId, 
      totalClients: this.clients.size,
      excludeUserId,
      messageData: message
    });
    
    logger.info(`Tentando enviar mensagem para ticket ${ticketId}`, { 
      ticketId, 
      totalClients: this.clients.size,
      excludeUserId,
      messageData: message
    }, 'REALTIME');

    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      // Não excluir o próprio usuário para que veja sua mensagem
      const shouldSend = client.ticketId === ticketId;
      
      console.log(`🔔 REALTIME: Verificando cliente ${clientId}`, {
        clientTicketId: client.ticketId,
        targetTicketId: ticketId,
        clientUserId: client.userId,
        excludeUserId,
        shouldSend
      });
      
      logger.debug(`Verificando cliente ${clientId}`, {
        clientTicketId: client.ticketId,
        targetTicketId: ticketId,
        clientUserId: client.userId,
        excludeUserId,
        shouldSend
      }, 'REALTIME');

      if (shouldSend) {
        console.log(`🔔 REALTIME: Enviando para cliente ${clientId}`);
        this.sendToClient(clientId, eventData);
        sentCount++;
      }
    });

    console.log(`🔔 REALTIME: Mensagem enviada para ticket ${ticketId}`, { 
      ticketId, 
      sentCount,
      excludeUserId,
      totalClients: this.clients.size
    });
    
    logger.info(`Mensagem enviada para ticket ${ticketId}`, { 
      ticketId, 
      sentCount,
      excludeUserId,
      totalClients: this.clients.size
    }, 'REALTIME');
  }

  // Enviar atualização de ticket para todos os clientes interessados
  sendTicketUpdate(ticketId: number, update: any, excludeUserId?: number) {
    const eventData: EventData = {
      type: 'ticket_update',
      ticketId,
      data: update,
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (client.ticketId === ticketId && client.userId !== excludeUserId) {
        this.sendToClient(clientId, eventData);
        sentCount++;
      }
    });

    logger.info(`Atualização de ticket enviada: ${ticketId}`, { 
      ticketId, 
      sentCount,
      excludeUserId 
    }, 'REALTIME');
  }

  // Enviar notificação para um usuário específico
  sendNotificationToUser(userId: number, notification: any) {
    const eventData: EventData = {
      type: 'notification',
      userId,
      data: notification,
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (client.userId === userId) {
        this.sendToClient(clientId, eventData);
        sentCount++;
      }
    });

    logger.info(`Notificação enviada para usuário ${userId}`, { 
      userId, 
      sentCount 
    }, 'REALTIME');
  }

  // Enviar para todos os clientes (admin/atendentes)
  broadcastToAll(eventData: EventData) {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, eventData);
      sentCount++;
    });

    logger.info(`Broadcast enviado para todos os clientes`, { 
      sentCount,
      eventType: eventData.type 
    }, 'REALTIME');
  }

  getConnectedClients(): Array<{ id: string; userId: number; ticketId?: number; lastHeartbeat: number }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      userId: client.userId,
      ticketId: client.ticketId,
      lastHeartbeat: client.lastHeartbeat
    }));
  }

  getClientCount(): number {
    return this.clients.size;
  }

  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.clients.forEach((client, clientId) => {
      try {
        client.response.end();
      } catch (error) {
        // Ignorar erro
      }
    });
    
    this.clients.clear();
    logger.info('Serviço de tempo real destruído', {}, 'REALTIME');
  }
}

export const realtimeService = new RealtimeService();
