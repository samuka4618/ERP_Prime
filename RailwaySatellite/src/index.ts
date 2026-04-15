import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { getPool, runMigrations } from './db';
import internalRoutes from './routes/internal';
import publicApiRoutes from './routes/publicApi';
import { renderFormPage, renderTrackingPage } from './publicPages';

async function main(): Promise<void> {
  if (!config.databaseUrl) {
    console.error('DATABASE_URL é obrigatória');
    process.exit(1);
  }
  if (!config.internalAuthToken) {
    console.warn('⚠️  INTERNAL_AUTH_TOKEN vazio — rotas /internal/* ficarão inutilizáveis até configurar.');
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await runMigrations(client);
  } finally {
    client.release();
  }
  console.log('✅ Migrações do satélite aplicadas');

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '512kb' }));

  const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'railway-satellite' });
  });

  app.use('/internal', internalRoutes);
  app.use('/api/public', publicLimiter, publicApiRoutes);

  const webDist = path.resolve(__dirname, '../web/dist');
  const webIndex = path.join(webDist, 'index.html');
  if (fs.existsSync(webIndex)) {
    app.use(express.static(webDist));
    app.get('/d/:publicSlug', publicLimiter, (_req, res) => {
      res.sendFile(webIndex);
    });
    app.get('/t/:trackingToken', publicLimiter, (_req, res) => {
      res.sendFile(webIndex);
    });
    console.log('✅ UI motorista (React) servida de web/dist');
  } else {
    console.warn('⚠️  web/dist não encontrado — UI legado HTML. Execute: npm run build:web');
    app.get('/d/:publicSlug', publicLimiter, renderFormPage);
    app.get('/t/:trackingToken', publicLimiter, renderTrackingPage);
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Não encontrado' });
  });

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`🛰️  Railway Satellite na porta ${config.port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
