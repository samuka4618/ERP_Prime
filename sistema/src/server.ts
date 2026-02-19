import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config/database';
import { executeSchema } from './database/connection';
import { errorHandler, notFound } from './middleware/errorHandler';
import { StatusUpdateService } from './services/StatusUpdateService';
import { logger } from './utils/logger';

// Importar rotas
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import ticketRoutes from './routes/tickets';
import categoryRoutes from './routes/categories';
import systemRoutes from './routes/system';
import dashboardRoutes from './routes/dashboard';
import notificationRoutes from './routes/notifications';
import attachmentRoutes from './routes/attachments';
import categoryAssignmentRoutes from './routes/categoryAssignments';
import reportRoutes from './routes/reports';
import adminMetricsRoutes from './routes/admin-metrics';
import realtimeRoutes from './routes/realtime';
import systemConfigRoutes from './routes/systemConfig';
import performanceRoutes from './routes/performance';
import clientRegistrationsRoutes from './routes/clientRegistrations';
import clientConfigRoutes from './routes/clientConfig';
import analiseCreditoRoutes from './routes/analiseCredito';
import { initializeWebSocket } from './services/WebSocketService';

const app = express();

// Configuração de CORS ANTES do helmet (importante!)
// Permitir origens específicas ou todas em desenvolvimento
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requisições sem origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    // Em desenvolvimento, permitir todas as origens
    if (config.nodeEnv === 'development') {
      return callback(null, true);
    }
    
    // Em produção, verificar se a origin está na lista
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// Middleware de segurança (depois do CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Desabilitar CSP para desenvolvimento
}));

// Log de debug para CORS
app.use((req, res, next) => {
  if (req.method === 'OPTIONS' || req.path.startsWith('/api')) {
    console.log('CORS Debug:', {
      origin: req.headers.origin,
      method: req.method,
      url: req.url,
      headers: req.headers['access-control-request-headers']
    });
  }
  next();
});

// Middleware de compressão
app.use(compression());

// Rate limiting global (desabilitado em desenvolvimento)
const globalLimiter = (req: any, res: any, next: any) => next(); // Desabilita rate limiting completamente

// Rate limiting para autenticação (desabilitado em desenvolvimento)
const authLimiter = (req: any, res: any, next: any) => next(); // Desabilita rate limiting de auth

// Rate limiting para uploads (desabilitado em desenvolvimento)
const uploadLimiter = (req: any, res: any, next: any) => next(); // Desabilita rate limiting de uploads

// Aplicar rate limiting global
app.use(globalLimiter);

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de cache headers
app.use((req, res, next) => {
  // Headers para APIs (não cachear)
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  // Headers para arquivos estáticos (cachear por 1 ano)
  else if (req.path.startsWith('/static/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // Headers para HTML (cachear por 1 hora)
  else if (req.path.endsWith('.html')) {
    res.set('Cache-Control', 'public, max-age=3600');
  }
  next();
});

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Middleware de logging
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  // Adicionar requestId ao req para uso em outros middlewares
  (req as any).requestId = requestId;
  
  logger.apiRequest(req.method, req.path, req.body, req.user);
  
  // Interceptar resposta para logar status e tempo
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    logger.apiResponse(req.method, req.path, res.statusCode, responseTime);
    return originalSend.call(this, data);
  };
  
  next();
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    message: 'Sistema de Chamados Financeiro',
    version: '1.0.0',
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    endpoints: {
      api: '/api',
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      tickets: '/api/tickets',
      dashboard: '/api/dashboard',
      notifications: '/api/notifications',
      reports: '/api/reports'
    }
  });
});


// Rota para favicon (evita erro 404)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Rota de teste para imagens
app.get('/test-images', (req, res) => {
  const fs = require('fs');
  try {
    const files = fs.readdirSync(path.join(process.cwd(), 'imgCadastros/20251027'));
    res.json({ 
      success: true, 
      files,
      cwd: process.cwd(),
      imgPath: path.join(process.cwd(), 'imgCadastros/20251027')
    });
  } catch (err) {
    res.json({ 
      success: false, 
      error: err instanceof Error ? err.message : String(err),
      cwd: process.cwd(),
      imgPath: path.join(process.cwd(), 'imgCadastros/20251027')
    });
  }
});

// Rotas de saúde
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv
  });
});

// Rotas da API com rate limiting específico
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attachments', uploadLimiter, attachmentRoutes);
app.use('/api/category-assignments', categoryAssignmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin-metrics', adminMetricsRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/system-config', systemConfigRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/client-registrations', clientRegistrationsRoutes);
app.use('/api/client-config', clientConfigRoutes);
app.use('/api/analise-credito', analiseCreditoRoutes);

// IMPORTANTE: Servir arquivos estáticos ANTES da rota catch-all
// Servir imagens de cadastros de clientes
app.use('/imgCadastros', express.static(path.join(process.cwd(), 'imgCadastros')));
// Servir arquivos de uploads (fallback)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rota de documentação básica
app.get('/api', (req, res) => {
  res.json({
    message: 'Sistema de Chamados Financeiro API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      tickets: '/api/tickets',
      dashboard: '/api/dashboard',
      reports: '/api/reports',
      clientRegistrations: '/api/client-registrations',
      clientConfig: '/api/client-config'
    },
    documentation: 'https://github.com/seu-repo/documentacao'
  });
});

// Rota catch-all para servir o frontend (deve vir antes dos middlewares de erro)
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'frontend/dist/index.html'));
});

// Middleware de tratamento de erros
app.use(notFound);
app.use(errorHandler);

// Função para inicializar o servidor
async function startServer() {
  try {
    // Executar migração do banco de dados
    console.log('Executando migração do banco de dados...');
    await executeSchema();
    console.log('Migração concluída com sucesso!');

    // Iniciar serviço de atualização automática de status
    StatusUpdateService.startAutoUpdate();

    // Iniciar servidor
    const PORT = Number(config.port);
    const HOST = process.env.HOST || '0.0.0.0';
    const server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📊 Ambiente: ${config.nodeEnv}`);
      console.log(`🔗 URL Local: http://localhost:${PORT}`);
      console.log(`🔗 URL Rede: http://${HOST === '0.0.0.0' ? '192.168.14.143' : HOST}:${PORT}`);
      console.log(`📚 API: http://${HOST === '0.0.0.0' ? '192.168.14.143' : HOST}:${PORT}/api`);
      console.log(`❤️  Health: http://${HOST === '0.0.0.0' ? '192.168.14.143' : HOST}:${PORT}/health`);
      console.log(`🔌 WebSocket: ws://${HOST === '0.0.0.0' ? '192.168.14.143' : HOST}:${PORT}/ws`);
    });

    // Inicializar WebSocket
    initializeWebSocket(server);
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Inicializar servidor
startServer();

// Tratamento de sinais para encerramento graceful
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido. Encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT recebido. Encerrando servidor...');
  process.exit(0);
});

export default app;
