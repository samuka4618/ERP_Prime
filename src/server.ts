import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { config } from './config/database';
import { executeSchema } from './core/database/connection';
import { errorHandler, notFound } from './shared/middleware/errorHandler';
import { StatusUpdateService } from './modules/chamados/services/StatusUpdateService';
import { logger } from './shared/utils/logger';

// Importar módulos do ERP
import { registerCoreRoutes } from './core';
import { registerChamadosRoutes } from './modules/chamados';
import { registerCadastrosRoutes } from './modules/cadastros';
import { registerComprasRoutes } from './modules/compras';
import { registerDescarregamentoRoutes } from './modules/descarregamento';
import { SatelliteInboundPoller } from './modules/descarregamento/services/SatelliteInboundPoller';
import { SatelliteSyncService } from './modules/descarregamento/services/SatelliteSyncService';
import { initializeWebSocket } from './modules/chamados/services/WebSocketService';
import { ReportController } from './modules/chamados/controllers/ReportController';
import { BackupAutomationService } from './core/backup/BackupAutomationService';
import { requestContextMiddleware } from './shared/middleware/requestContext';

const app = express();

const uiStaticRoot =
  config.erpUi === 'next'
    ? path.join(process.cwd(), 'web-next/out')
    : path.join(process.cwd(), 'frontend/dist');
const uiIndexHtml = path.join(uiStaticRoot, 'index.html');

// Middleware para tratar tentativas de acesso via HTTPS (redirecionar para HTTP)
app.use((req, res, next) => {
  // Se a requisição vier via HTTPS (detectado pelo header x-forwarded-proto ou req.secure)
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const host = (req.headers.host || '').toLowerCase();

  if (isHttps && config.nodeEnv === 'development') {
    // Não redirecionar quando a requisição vier do host definido em PUBLIC_URL (ex.: Cloudflare Tunnel).
    // Assim, quem usa túnel (Cloudflare ou outro) define PUBLIC_URL e o backend não força HTTP.
    if (process.env.PUBLIC_URL && process.env.PUBLIC_URL.trim()) {
      try {
        const raw = process.env.PUBLIC_URL.trim().replace(/\/+$/, '');
        const pubHost = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.toLowerCase();
        const reqHost = host.split(':')[0];
        if (pubHost && (reqHost === pubHost || reqHost.endsWith('.' + pubHost))) {
          return next();
        }
      } catch {
        // PUBLIC_URL inválida, segue o fluxo normal
      }
    }
    // Redirecionar para HTTP apenas em acesso direto (ex.: localhost)
    const hostNormalized = req.headers.host?.replace(':443', ':3000') || req.headers.host;
    const httpUrl = `http://${hostNormalized}${req.url}`;
    return res.redirect(301, httpUrl);
  }

  // Remover qualquer header que possa forçar HTTPS ANTES de processar
  res.removeHeader('Strict-Transport-Security');
  res.removeHeader('Upgrade-Insecure-Requests');
  res.removeHeader('Origin-Agent-Cluster');
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  next();
});

// Middleware de segurança (em produção com HTTPS, HSTS pode ser reativado via DISABLE_HSTS=0)
const disableHsts = process.env.DISABLE_HSTS === 'true' || config.nodeEnv !== 'production';
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  strictTransportSecurity: disableHsts ? false : { maxAge: 31536000, includeSubDomains: true },
  contentSecurityPolicy: false,
  originAgentCluster: false
}));

// Middleware DEPOIS do Helmet: em dev remove headers que forçam HTTPS; em produção mantém HSTS se habilitado
app.use((req, res, next) => {
  res.removeHeader('Cross-Origin-Opener-Policy');
  res.removeHeader('Cross-Origin-Embedder-Policy');
  res.removeHeader('Origin-Agent-Cluster');
  if (config.nodeEnv !== 'production' || disableHsts) {
    res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Upgrade-Insecure-Requests');
  }
  next();
});

// Configuração de CORS: em produção usar ALLOWED_ORIGINS (ex: https://meudominio.com), em dev permitir todas
const allowedOriginsList = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o: string) => o.trim()).filter(Boolean)
  : [];
const hasVercelOrigin = allowedOriginsList.some((o: string) => o.includes('vercel.app'));

const corsOrigin = config.nodeEnv === 'production' && allowedOriginsList.length > 0
  ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedOriginsList.includes(origin)) return callback(null, true);
      // Permite qualquer subdomínio/preview da Vercel quando há pelo menos uma URL vercel.app em ALLOWED_ORIGINS
      if (hasVercelOrigin && origin.endsWith('.vercel.app')) return callback(null, true);
      callback(null, false);
    }
  : true;

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 200,
  maxAge: 86400
}));

if (config.nodeEnv !== 'production') {
  app.use((req, res, next) => {
    logger.debug('CORS Debug', { origin: req.headers.origin, method: req.method, url: req.url }, 'CORS');
    next();
  });
}

// Middleware para tratar requisições OPTIONS (preflight)
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Middleware de compressão
app.use(compression());

// Rate limiting: ativo em produção para mitigar abuso; desabilitado em desenvolvimento
const isProduction = config.nodeEnv === 'production';
const globalLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
      standardHeaders: true,
      legacyHeaders: false
    })
  : (req: express.Request, res: express.Response, next: express.NextFunction) => next();

const authLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
      standardHeaders: true,
      legacyHeaders: false
    })
  : (req: express.Request, res: express.Response, next: express.NextFunction) => next();

const uploadLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 30,
      message: { error: 'Muitos uploads. Tente novamente em alguns minutos.' },
      standardHeaders: true,
      legacyHeaders: false
    })
  : (req: express.Request, res: express.Response, next: express.NextFunction) => next();

// Aplicar rate limiting global
app.use(globalLimiter);

// Middleware para parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

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

// Middleware para garantir que recursos estáticos usem HTTP
app.use((req, res, next) => {
  // Se a requisição vier via proxy que adiciona headers de HTTPS, garantir que o protocolo seja HTTP
  if (req.headers['x-forwarded-proto'] === 'https' && config.nodeEnv === 'development') {
    req.headers['x-forwarded-proto'] = 'http';
  }
  next();
});

// Servir arquivos estáticos do frontend (Vite ou export Next conforme ERP_UI)
app.use(express.static(uiStaticRoot, {
  setHeaders: (res) => {
    if (config.nodeEnv !== 'production' || disableHsts) res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Origin-Agent-Cluster');
  }
}));

// Middleware de contexto/correlação e logging de request/response
app.use(requestContextMiddleware);

// Rota para favicon (evita erro 404)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Rota de teste para imagens (apenas em desenvolvimento; em produção não expõe caminhos/IPs)
app.get('/test-images', (req, res) => {
  if (config.nodeEnv === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const fs = require('fs');
  try {
    const imagesPath = path.join(process.cwd(), 'storage/images');
    const files = fs.readdirSync(imagesPath);
    res.json({
      success: true,
      files,
      cwd: process.cwd(),
      imgPath: imagesPath
    });
  } catch (err) {
    res.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      cwd: process.cwd(),
      imgPath: path.join(process.cwd(), 'storage/images')
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

// Rota de teste de conectividade (apenas em desenvolvimento; em produção não expõe IPs/headers)
app.get('/api/test-connection', (req, res) => {
  if (config.nodeEnv === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({
    success: true,
    message: 'Conexão estabelecida com sucesso!',
    serverIP: req.socket.localAddress,
    clientIP: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
    headers: {
      origin: req.headers.origin,
      host: req.headers.host,
      'user-agent': req.headers['user-agent']
    }
  });
});

// Criar router da API
const apiRouter = express.Router();

// Middleware de debug para todas as requisições da API
apiRouter.use((req, res, next) => {
  logger.debug('Requisição API recebida', {
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    url: req.url
  }, 'API_ROUTER');
  next();
});

// Rota pública para configurações do sistema (ANTES de registrar outros módulos)
// Esta rota deve ser acessível sem autenticação para a tela de login do mobile
apiRouter.get('/system/public-config', async (req, res) => {
  try {
    const { SystemConfigModel } = await import('./core/system/SystemConfig');
    const config = await SystemConfigModel.getSystemConfig();
    res.json({
      message: 'Configurações públicas obtidas com sucesso',
      data: {
        system_name: config.system_name || 'ERP PRIME',
        system_subtitle: config.system_subtitle || 'Sistema de Gestão Empresarial',
        system_logo: config.system_logo || '',
        system_version: config.system_version || '1.0.0'
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar configurações públicas', error, 'SYSTEM_CONFIG');
    res.json({
      message: 'Configurações públicas obtidas com sucesso',
      data: {
        system_name: 'ERP PRIME',
        system_subtitle: 'Sistema de Gestão Empresarial',
        system_logo: '',
        system_version: '1.0.0'
      }
    });
  }
});

// Registrar módulos do ERP
logger.info('Registrando rotas do sistema', undefined, 'BOOT');
registerCoreRoutes(apiRouter, authLimiter);
registerChamadosRoutes(apiRouter, uploadLimiter);
registerCadastrosRoutes(apiRouter);
registerComprasRoutes(apiRouter);
registerDescarregamentoRoutes(apiRouter);
logger.success('Todas as rotas registradas', undefined, 'BOOT');

// Aplicar router da API
app.use('/api', apiRouter);
logger.success('Router da API aplicado em /api', undefined, 'BOOT');

// IMPORTANTE: Servir arquivos estáticos ANTES da rota catch-all
// Servir imagens de cadastros de clientes
app.use('/storage/images', express.static(path.join(process.cwd(), 'storage/images')));
// Servir arquivos de uploads
app.use('/storage/uploads', express.static(path.join(process.cwd(), 'storage/uploads')));
// Servir avatares de usuários
app.use('/storage/avatars', express.static(path.join(process.cwd(), 'storage/avatars')));
// Compatibilidade com rotas antigas (redirecionar)
app.use('/imgCadastros', express.static(path.join(process.cwd(), 'storage/images')));
app.use('/uploads', express.static(path.join(process.cwd(), 'storage/uploads')));

// Rota de documentação básica
app.get('/api', (req, res) => {
  res.json({
    message: 'ERP PRIME API',
    version: '2.0.0',
    system: 'ERP PRIME - Sistema de gestão empresarial',
    modules: {
      core: {
        name: 'Core',
        description: 'Funcionalidades essenciais do ERP',
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          system: '/api/system',
          'system-config': '/api/system-config',
          performance: '/api/performance'
        }
      },
      chamados: {
        name: 'Módulo de Chamados',
        description: 'Sistema completo de gerenciamento de chamados e tickets',
        endpoints: {
          tickets: '/api/tickets',
          categories: '/api/categories',
          dashboard: '/api/dashboard',
          reports: '/api/reports',
          notifications: '/api/notifications',
          attachments: '/api/attachments',
          'category-assignments': '/api/category-assignments',
          'admin-metrics': '/api/admin-metrics',
          realtime: '/api/realtime'
        }
      },
      cadastros: {
        name: 'Módulo de Cadastros',
        description: 'Sistema de cadastro de clientes e análise de crédito',
        endpoints: {
          'client-registrations': '/api/client-registrations',
          'client-config': '/api/client-config',
          'analise-credito': '/api/analise-credito'
        }
      },
      compras: {
        name: 'Módulo de Compras',
        description: 'Sistema completo de gestão de compras, solicitações, orçamentos e aprovações',
        endpoints: {
          'solicitacoes-compra': '/api/solicitacoes-compra',
          'orcamentos': '/api/orcamentos',
          'aprovadores': '/api/aprovadores',
          'compradores': '/api/compradores',
          'compras-anexos': '/api/compras-anexos'
        }
      },
      descarregamento: {
        name: 'Módulo de Descarregamento',
        description: 'Agendamentos, docas, fornecedores, formulários públicos, SMS e respostas de motoristas',
        endpoints: {
          fornecedores: '/api/descarregamento/fornecedores',
          agendamentos: '/api/descarregamento/agendamentos',
          docas: '/api/descarregamento/docas',
          formularios: '/api/descarregamento/formularios',
          'form-responses': '/api/descarregamento/form-responses',
          'sms-templates': '/api/descarregamento/sms-templates'
        }
      }
    },
    documentation: 'Ver docs/MANUAL_COMPLETO_ERP_PRIME.md e docs/INDICE_DOCUMENTACAO.md no repositório'
  });
});

// Rota catch-all para servir o frontend (deve vir antes dos middlewares de erro)
app.get('*', (req, res, next) => {
  if (config.nodeEnv !== 'production' || disableHsts) {
    res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Upgrade-Insecure-Requests');
  }
  res.removeHeader('Origin-Agent-Cluster');

  // Servir o HTML
  res.sendFile(uiIndexHtml, (err) => {
    if (err) {
      next(err);
    }
  });
});

// Middleware de tratamento de erros
app.use(notFound);
app.use(errorHandler);

// Função para obter o IP da máquina na rede local
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  
  // Priorizar interfaces Ethernet e Wi-Fi
  const priorityInterfaces = ['Ethernet', 'Wi-Fi', 'eth0', 'wlan0', 'en0'];
  
  // Tentar encontrar IP em interfaces prioritárias
  for (const ifaceName of priorityInterfaces) {
    const iface = interfaces[ifaceName];
    if (iface) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
  }
  
  // Se não encontrou nas prioritárias, procurar em todas as interfaces
  for (const ifaceName in interfaces) {
    const iface = interfaces[ifaceName];
    if (iface) {
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
  }
  
  // Fallback para localhost se não encontrar nenhum IP
  return 'localhost';
}

// Função para inicializar o servidor
async function startServer() {
  try {
    // Executar migração do banco de dados
    logger.info('Executando migração do banco de dados', undefined, 'BOOT');
    await executeSchema();
    logger.success('Migração concluída com sucesso', undefined, 'BOOT');

    if (config.erpUi === 'next' && !fs.existsSync(uiIndexHtml)) {
      logger.warn(
        `⚠️  ERP_UI=next mas não foi encontrado o ficheiro de entrada da UI: ${uiIndexHtml}. ` +
          'Execute `npm run build:web-next` (ou `npm run build:all`) antes de `npm start`.',
        undefined,
        'BOOT'
      );
    }
    logger.info(`UI estática: ${config.erpUi} → ${uiStaticRoot}`, undefined, 'BOOT');

    // Iniciar serviço de atualização automática de status
    StatusUpdateService.startAutoUpdate();

    // Agendamento de relatórios: verificar a cada 1 minuto se há relatórios para executar
    setInterval(() => {
      ReportController.processScheduledReports().catch((err) => {
        logger.error('Erro no processador de agendamentos de relatórios', err, 'REPORTS');
      });
    }, 60 * 1000);
    // Executar uma vez após 30s (dar tempo do servidor subir)
    setTimeout(() => ReportController.processScheduledReports().catch(() => {}), 30 * 1000);
    BackupAutomationService.start();

    // Iniciar servidor
    const PORT = Number(config.port);
    const HOST = process.env.HOST || '0.0.0.0';
    const localIP = getLocalIP();
    const server = app.listen(PORT, HOST, () => {
      logger.success(`Servidor rodando na porta ${PORT}`, undefined, 'BOOT');
      logger.info(`Ambiente: ${config.nodeEnv}`, undefined, 'BOOT');
      logger.info(`URL Local: http://localhost:${PORT}`, undefined, 'BOOT');
      logger.info(`URL Rede: http://${localIP}:${PORT}`, undefined, 'BOOT');
      logger.info(`API: http://${localIP}:${PORT}/api`, undefined, 'BOOT');
      logger.info(`Health: http://${localIP}:${PORT}/health`, undefined, 'BOOT');
      logger.info(`WebSocket: ws://${localIP}:${PORT}/ws`, undefined, 'BOOT');
      SatelliteInboundPoller.start();
      setTimeout(() => {
        SatelliteSyncService.pushAllPublishedSnapshots().catch((err) => {
          logger.error('SatelliteSyncService.pushAllPublishedSnapshots', err, 'SATELLITE');
        });
      }, 5000);
    });

    // Inicializar WebSocket
    initializeWebSocket(server);
  } catch (error: any) {
    const usePostgres = config.database.usePostgres;
    const isSqliteCorrupt = !usePostgres && (error?.code === 'SQLITE_CORRUPT' || (error?.message && String(error.message).includes('malformed')));
    if (isSqliteCorrupt) {
      const dbPath = path.isAbsolute(config.database.path)
        ? config.database.path
        : path.resolve(process.cwd(), config.database.path);
      logger.error('Banco de dados SQLite corrompido', { dbPath }, 'BOOT');
      logger.error('Para recomeçar do zero: apague/renomeie o arquivo e reinicie o servidor.', undefined, 'BOOT');
      process.exit(1);
    }
    logger.error('Erro ao iniciar servidor', error, 'BOOT');
    process.exit(1);
  }
}

// Promises em background (notificações, etc.) não devem derrubar o processo
process.on('unhandledRejection', (reason, promise) => {
  logger.error('unhandledRejection', reason, 'PROCESS');
  if (typeof (promise as any)?.catch === 'function') {
    (promise as Promise<unknown>).catch(() => {});
  }
});

// Inicializar servidor
startServer();

// Tratamento de sinais para encerramento graceful
process.on('SIGTERM', () => {
  logger.warn('SIGTERM recebido. Encerrando servidor...', undefined, 'PROCESS');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.warn('SIGINT recebido. Encerrando servidor...', undefined, 'PROCESS');
  process.exit(0);
});

export default app;
