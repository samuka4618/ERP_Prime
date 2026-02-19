import { Router, Request, Response } from 'express';
import { realtimeService } from '../services/RealtimeService';
import { sseAuthenticate } from '../../../core/auth/sseAuth';
import { logger } from '../../../shared/utils/logger';

const router = Router();

// Middleware para autenticação SSE (via query parameter)
router.use(sseAuthenticate);

// Conectar ao SSE para um ticket específico
router.get('/ticket/:ticketId', (req: Request, res: Response) => {
  const { ticketId } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado' });
    return;
  }

  const ticketIdNum = parseInt(ticketId);
  if (isNaN(ticketIdNum)) {
    res.status(400).json({ error: 'ID do ticket inválido' });
    return;
  }

  try {
    const clientId = realtimeService.addClient(userId, res, ticketIdNum);
    
    // Configurar cleanup quando a conexão for fechada
    req.on('close', () => {
      realtimeService.removeClient(clientId);
    });

    req.on('error', () => {
      realtimeService.removeClient(clientId);
    });

    logger.info(`SSE conectado para ticket ${ticketId}`, { 
      userId, 
      ticketId: ticketIdNum,
      clientId 
    }, 'REALTIME');

  } catch (error) {
    logger.error('Erro ao conectar SSE', { error, userId, ticketId }, 'REALTIME');
    res.status(500).json({ error: 'Erro ao conectar ao sistema de tempo real' });
  }
});

// Conectar ao SSE para notificações gerais (sem ticket específico)
router.get('/notifications', (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Usuário não autenticado' });
    return;
  }

  try {
    const clientId = realtimeService.addClient(userId, res);
    
    // Configurar cleanup quando a conexão for fechada
    req.on('close', () => {
      realtimeService.removeClient(clientId);
    });

    req.on('error', () => {
      realtimeService.removeClient(clientId);
    });

    logger.info(`SSE conectado para notificações`, { 
      userId, 
      clientId 
    }, 'REALTIME');

  } catch (error) {
    logger.error('Erro ao conectar SSE para notificações', { error, userId }, 'REALTIME');
    res.status(500).json({ error: 'Erro ao conectar ao sistema de tempo real' });
  }
});

// Endpoint para heartbeat (manter conexão viva)
router.post('/heartbeat', (req: Request, res: Response) => {
  const { clientId } = req.body;
  
  if (!clientId) {
    res.status(400).json({ error: 'Client ID é obrigatório' });
    return;
  }

  realtimeService.updateHeartbeat(clientId);
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Endpoint para debug (apenas admin)
router.get('/debug/clients', (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso negado' });
    return;
  }

  const clients = realtimeService.getConnectedClients();
  const count = realtimeService.getClientCount();

  res.json({
    totalClients: count,
    clients: clients.map(client => ({
      id: client.id,
      userId: client.userId,
      ticketId: client.ticketId,
      lastHeartbeat: new Date(client.lastHeartbeat).toISOString(),
      isActive: Date.now() - client.lastHeartbeat < 60000
    }))
  });
});


export default router;
