import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { Readable } from 'stream';
import { config } from '../../config/database';
import { db } from '../database/connection';

export const BACKUP_VERSION = 1;

export interface BackupManifest {
  backupVersion: number;
  appVersion: string;
  createdAt: string;
  contents: string[];
  databaseChecksum?: string;
}

const appVersion = ((): string => {
  try {
    const pkgPath = path.join(__dirname, '..', '..', '..', '..', 'package.json');
    const pkg = require(pkgPath);
    return (pkg && pkg.version) || '2.0.0';
  } catch {
    return '2.0.0';
  }
})();

/**
 * Executa checkpoint WAL para que o arquivo .db contenha todos os dados e possa ser copiado de forma consistente.
 */
export async function walCheckpoint(): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run('PRAGMA wal_checkpoint(TRUNCATE)', (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Gera um stream do ZIP de backup (banco + storage + manifest).
 * Deve ser chamado após walCheckpoint() para consistência.
 */
export function createBackupStream(): { stream: Readable; filename: string } {
  const now = new Date();
  const datePart = now.toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `erp-backup-${datePart}.zip`;

  const cwd = process.cwd();
  const dbPath = path.isAbsolute(config.database.path)
    ? config.database.path
    : path.join(cwd, config.database.path);
  const uploadsPath = path.isAbsolute(config.storage.uploads)
    ? config.storage.uploads
    : path.join(cwd, config.storage.uploads);
  const imagesPath = path.isAbsolute(config.storage.images)
    ? config.storage.images
    : path.join(cwd, config.storage.images);

  const contents: string[] = ['database/chamados.db'];
  if (fs.existsSync(uploadsPath)) contents.push('storage/uploads');
  if (fs.existsSync(imagesPath)) contents.push('storage/images');

  const manifest: BackupManifest = {
    backupVersion: BACKUP_VERSION,
    appVersion,
    createdAt: now.toISOString(),
    contents
  };

  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = archive as unknown as Readable;

  if (fs.existsSync(dbPath)) {
    archive.file(dbPath, { name: 'database/chamados.db' });
  }

  if (fs.existsSync(uploadsPath)) {
    archive.directory(uploadsPath, 'storage/uploads');
  }
  if (fs.existsSync(imagesPath)) {
    archive.directory(imagesPath, 'storage/images');
  }

  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  archive.finalize();

  return { stream, filename };
}

/**
 * Cria o backup completo: checkpoint WAL e retorna stream do ZIP.
 */
export async function createBackup(): Promise<{ stream: Readable; filename: string }> {
  await walCheckpoint();
  return createBackupStream();
}

/** Resultado da restauração. */
export interface RestoreResult {
  success: true;
  backupVersion: number;
  appVersion: string;
  createdAt: string;
  message: string;
}

const MAX_RESTORE_SIZE = 500 * 1024 * 1024; // 500 MB
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_MAGIC_EMPTY = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

function isZipBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf.slice(0, 4).equals(ZIP_MAGIC) || buf.slice(0, 4).equals(ZIP_MAGIC_EMPTY);
}

function safeJoin(base: string, ...segments: string[]): string {
  const resolved = path.join(base, ...segments);
  const normalized = path.normalize(resolved);
  if (!normalized.startsWith(path.normalize(base))) return '';
  return normalized;
}

/**
 * Restaura o sistema a partir de um arquivo ZIP de backup.
 * Substitui o banco e o storage. Recomenda-se reiniciar o servidor após o restore.
 */
export async function restoreBackup(zipBuffer: Buffer): Promise<RestoreResult> {
  if (zipBuffer.length > MAX_RESTORE_SIZE) {
    throw new Error('Arquivo de backup muito grande. Máximo: 500 MB.');
  }
  if (!isZipBuffer(zipBuffer)) {
    throw new Error('Arquivo inválido. Esperado um ZIP de backup do ERP.');
  }

  const zip = new AdmZip(zipBuffer);
  const cwd = process.cwd();
  const tempDir = path.join(cwd, 'data', 'backups', 'restore-temp');

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  let manifest: BackupManifest;

  try {
    zip.extractAllTo(tempDir, true);

    const manifestPath = path.join(tempDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Backup inválido: manifest.json não encontrado.');
    }

    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (
      typeof manifest.backupVersion !== 'number' ||
      manifest.backupVersion > BACKUP_VERSION
    ) {
      throw new Error(
        `Backup incompatível. Versão do backup: ${manifest.backupVersion}; suportada: até ${BACKUP_VERSION}.`
      );
    }
    if (!manifest.createdAt || !manifest.contents) {
      throw new Error('Backup inválido: manifest incompleto.');
    }

    const dbPath = path.isAbsolute(config.database.path)
      ? config.database.path
      : path.join(cwd, config.database.path);
    const dbDir = path.dirname(dbPath);
    const extractedDb = path.join(tempDir, 'database', 'chamados.db');
    const dbRestoredPath = dbPath + '.restored';

    if (fs.existsSync(extractedDb)) {
      if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
      fs.copyFileSync(extractedDb, dbRestoredPath);
    }

    const uploadsDest = path.isAbsolute(config.storage.uploads)
      ? config.storage.uploads
      : path.join(cwd, config.storage.uploads);
    const imagesDest = path.isAbsolute(config.storage.images)
      ? config.storage.images
      : path.join(cwd, config.storage.images);

    const uploadsSrc = path.join(tempDir, 'storage', 'uploads');
    const imagesSrc = path.join(tempDir, 'storage', 'images');

    const copyDir = (src: string, dest: string) => {
      if (!fs.existsSync(src)) return;
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const e of entries) {
        const destPath = safeJoin(dest, e.name);
        if (!destPath) continue;
        const srcPath = path.join(src, e.name);
        if (e.isDirectory()) copyDir(srcPath, destPath);
        else fs.copyFileSync(srcPath, destPath);
      }
    };

    copyDir(uploadsSrc, uploadsDest);
    copyDir(imagesSrc, imagesDest);
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  }

  return {
    success: true,
    backupVersion: manifest.backupVersion,
    appVersion: manifest.appVersion,
    createdAt: manifest.createdAt,
    message:
      'Restauração concluída. Reinicie o servidor para aplicar o banco restaurado (storage já foi atualizado).'
  };
}
