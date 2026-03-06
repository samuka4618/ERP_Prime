import dotenv from 'dotenv';
import path from 'path';

// Garantir que o .env da raiz do projeto seja carregado (independente do cwd)
const envPath = path.resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });
dotenv.config(); // fallback: .env no cwd atual

/** true quando USE_POSTGRES=true e DATABASE_URL está definido; usa PostgreSQL (ex.: Railway). */
const usePostgres = process.env.USE_POSTGRES === 'true' && !!process.env.DATABASE_URL?.trim();
const databaseUrl = (process.env.DATABASE_URL || '').trim();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET?.trim();
if (nodeEnv === 'production' && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error('Em produção, JWT_SECRET é obrigatório e deve ter no mínimo 32 caracteres. Defina a variável de ambiente JWT_SECRET.');
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv,
  database: {
    path: process.env.DB_PATH || './data/database/chamados.db',
    usePostgres,
    databaseUrl
  },
  jwt: {
    secret: jwtSecret || 'sua_chave_secreta_jwt_aqui',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'ERP PRIME <noreply@erpprime.com>'
  },
  upload: {
    path: process.env.UPLOAD_PATH || './storage/uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png').split(',')
  },
  storage: {
    images: process.env.IMAGES_PATH || './storage/images',
    uploads: process.env.UPLOADS_PATH || './storage/uploads'
  },
  sla: {
    firstResponseHours: parseInt(process.env.SLA_FIRST_RESPONSE || '4'),
    resolutionHours: parseInt(process.env.SLA_RESOLUTION || '24'),
    reopenDays: parseInt(process.env.REOPEN_DAYS || '7')
  },
  sms: {
    baseUrl: (process.env.INFOBIP_BASE_URL || 'https://api.infobip.com').replace(/\/$/, ''),
    apiKey: process.env.INFOBIP_API_KEY || '',
    sender: process.env.INFOBIP_SENDER || ''
  },
  /** URL base do frontend (para links em e-mails, ex.: link "Ver detalhes do cadastro") */
  clientUrl: process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  /** Nome do sistema (e-mails, assuntos, etc.) */
  systemName: process.env.SYSTEM_NAME || 'ERP PRIME',
};
