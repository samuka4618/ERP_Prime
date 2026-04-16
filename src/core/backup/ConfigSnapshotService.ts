import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface ConfigSnapshotArtifact {
  zipPath: string;
  absolutePath: string;
  encrypted: boolean;
}

const ENV_PREFIX_ALLOWLIST = [
  'JWT_',
  'SMTP_',
  'INFOBIP_',
  'DB_',
  'DATABASE_',
  'USE_POSTGRES',
  'ALLOWED_ORIGINS',
  'CLIENT_URL',
  'SYSTEM_',
  'UPLOAD',
  'IMAGES_',
  'UPLOADS_',
  'SLA_',
  'REOPEN_',
  'SATELLITE_',
  'SQLSERVER_',
  'ATAK_',
  'TESS_',
  'CNPJ_',
  'NODE_ENV',
  'PORT',
  'HOST',
  'PUBLIC_URL'
];

function normalizeEncryptionKey(raw: string): Buffer {
  return crypto.createHash('sha256').update(raw).digest();
}

function shouldKeepEnvKey(key: string): boolean {
  return ENV_PREFIX_ALLOWLIST.some((prefix) => key.startsWith(prefix));
}

export function collectEnvironmentSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (shouldKeepEnvKey(key)) {
      out[key] = value;
    }
  }
  return out;
}

function encryptJson(plainJson: string, secret: string): string {
  const iv = crypto.randomBytes(12);
  const key = normalizeEncryptionKey(secret);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(plainJson, 'utf-8')), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64')
  });
}

export function decryptJson(payloadJson: string, secret: string): string {
  const payload = JSON.parse(payloadJson) as {
    algorithm: string;
    iv: string;
    authTag: string;
    ciphertext: string;
  };
  if (payload.algorithm !== 'aes-256-gcm') {
    throw new Error('Snapshot de configuração usa algoritmo não suportado.');
  }

  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const key = normalizeEncryptionKey(secret);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}

export function createConfigSnapshotArtifact(tempRoot: string): ConfigSnapshotArtifact {
  const envSnapshot = collectEnvironmentSnapshot();
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
      variables: envSnapshot
    },
    null,
    2
  );

  const encryptionSecret = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  const configDir = path.join(tempRoot, 'config');
  fs.mkdirSync(configDir, { recursive: true });

  if (encryptionSecret) {
    const encrypted = encryptJson(body, encryptionSecret);
    const target = path.join(configDir, 'environment.snapshot.enc');
    fs.writeFileSync(target, encrypted, 'utf-8');
    return {
      zipPath: 'config/environment.snapshot.enc',
      absolutePath: target,
      encrypted: true
    };
  }

  const target = path.join(configDir, 'environment.snapshot.json');
  fs.writeFileSync(target, body, 'utf-8');
  return {
    zipPath: 'config/environment.snapshot.json',
    absolutePath: target,
    encrypted: false
  };
}
