import dotenv from 'dotenv';
import path from 'path';

// Garantir que o .env da raiz do projeto seja carregado (independente do cwd)
const envPath = path.resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });
dotenv.config(); // fallback: .env no cwd atual

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    path: process.env.DB_PATH || './data/database/chamados.db'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'sua_chave_secreta_jwt_aqui',
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
  }
};
