import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { config } from '../../config/database';
import { dbGet } from '../database/connection';
import { buildBackupCatalog, existingCatalogEntries } from './BackupCatalog';
import { createConfigSnapshotArtifact, decryptJson } from './ConfigSnapshotService';
import type { DatabaseBackupAdapter, DatabaseEngine } from './adapters/DatabaseBackupAdapter';
import { SqliteBackupAdapter } from './adapters/SqliteBackupAdapter';
import { PostgresBackupAdapter } from './adapters/PostgresBackupAdapter';

export const BACKUP_VERSION = 2;
const MAX_RESTORE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_ZIP_ENTRIES = 15000;
const MAX_UNCOMPRESSED_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_MAGIC_EMPTY = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

export interface BackupItem {
  path: string;
  category: 'database' | 'storage' | 'config' | 'logs' | 'metadata';
  type: 'file' | 'directory';
  required: boolean;
  size: number;
  checksum?: string;
}

export interface BackupManifest {
  backupVersion: number;
  appVersion: string;
  createdAt: string;
  engine: DatabaseEngine;
  contents: string[];
  items: BackupItem[];
  warnings: string[];
  integrity: {
    algorithm: 'sha256';
    manifestHmac?: string;
  };
}

export interface ValidateBackupResult {
  valid: boolean;
  manifest?: BackupManifest;
  warnings: string[];
  entryCount: number;
  uncompressedBytes: number;
}

/** Resultado da restauração. */
export interface RestoreResult {
  success: true;
  backupVersion: number;
  appVersion: string;
  createdAt: string;
  message: string;
  warnings: string[];
  checks: PostRestoreChecklistReport;
}

export interface PostRestoreCheckItem {
  name: string;
  ok: boolean;
  details?: string;
}

export interface PostRestoreChecklistReport {
  executedAt: string;
  summary: {
    passed: number;
    failed: number;
  };
  items: PostRestoreCheckItem[];
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

function isZipBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf.slice(0, 4).equals(ZIP_MAGIC) || buf.slice(0, 4).equals(ZIP_MAGIC_EMPTY);
}

function safeJoin(base: string, ...segments: string[]): string {
  const resolved = path.join(base, ...segments);
  const normalizedBase = path.resolve(base);
  const normalized = path.resolve(resolved);
  if (!normalized.startsWith(normalizedBase)) return '';
  return normalized;
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileSize(filePath: string): number {
  return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
}

function hashFile(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function computeDirectoryStats(dirPath: string): { bytes: number; fileCount: number } {
  if (!fs.existsSync(dirPath)) return { bytes: 0, fileCount: 0 };
  let bytes = 0;
  let fileCount = 0;
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        fileCount += 1;
        bytes += fs.statSync(full).size;
      }
    }
  }
  return { bytes, fileCount };
}

function signManifest(manifest: BackupManifest): string | undefined {
  const hmacKey = process.env.BACKUP_HMAC_KEY?.trim();
  if (!hmacKey) return undefined;

  const manifestToSign = {
    ...manifest,
    integrity: { ...manifest.integrity, manifestHmac: undefined }
  };
  return crypto.createHmac('sha256', hmacKey).update(JSON.stringify(manifestToSign)).digest('hex');
}

function verifyManifestSignature(manifest: BackupManifest): { ok: boolean; warning?: string } {
  if (!manifest.integrity.manifestHmac) {
    return { ok: true, warning: 'Backup sem assinatura HMAC; integridade forte não verificada.' };
  }

  const hmacKey = process.env.BACKUP_HMAC_KEY?.trim();
  if (!hmacKey) {
    return {
      ok: false,
      warning:
        'Backup assinado, mas BACKUP_HMAC_KEY não está configurado neste ambiente para validação.'
    };
  }
  const expected = signManifest(manifest);
  const ok = !!expected && expected === manifest.integrity.manifestHmac;
  return {
    ok,
    warning: ok ? undefined : 'Assinatura HMAC do manifest inválida.'
  };
}

function selectAdapter(): DatabaseBackupAdapter {
  if (config.database.usePostgres) return new PostgresBackupAdapter();
  return new SqliteBackupAdapter();
}

function writeZipToFile(zipStream: Readable, outputFile: string): Promise<void> {
  ensureDir(path.dirname(outputFile));
  const out = fs.createWriteStream(outputFile);
  zipStream.pipe(out);
  return finished(out);
}

function validateZipStructure(zip: AdmZip): { entryCount: number; uncompressedBytes: number } {
  const entries = (zip as any).getEntries() as Array<{ entryName: string; header: { size: number } }>;
  if (entries.length === 0) {
    throw new Error('Backup inválido: ZIP vazio.');
  }
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(`Backup inválido: número de entradas excede o limite (${MAX_ZIP_ENTRIES}).`);
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    const name = entry.entryName || '';
    if (name.startsWith('/') || name.includes('..\\') || name.includes('../')) {
      throw new Error(`Backup inválido: caminho inseguro detectado (${name}).`);
    }
    totalUncompressed += entry.header.size;
    if (totalUncompressed > MAX_UNCOMPRESSED_SIZE) {
      throw new Error('Backup inválido: tamanho descomprimido excede o limite permitido.');
    }
  }

  return { entryCount: entries.length, uncompressedBytes: totalUncompressed };
}

function extractZipSafely(zip: AdmZip, tempDir: string): void {
  ensureDir(tempDir);
  const entries = (zip as any).getEntries() as Array<{
    entryName: string;
    isDirectory: boolean;
    getData: () => Buffer;
  }>;
  for (const entry of entries) {
    const entryName = entry.entryName;
    const target = safeJoin(tempDir, entryName);
    if (!target) {
      throw new Error(`Backup inválido: entrada fora do diretório permitido (${entryName}).`);
    }
    if (entry.isDirectory) {
      ensureDir(target);
      continue;
    }

    ensureDir(path.dirname(target));
    fs.writeFileSync(target, entry.getData());
  }
}

function syncDirectoryAtomic(sourceDir: string, destinationDir: string): () => void {
  const restoreId = Date.now().toString();
  const rollbackDir = `${destinationDir}.pre-restore-${restoreId}`;

  if (fs.existsSync(rollbackDir)) {
    fs.rmSync(rollbackDir, { recursive: true, force: true });
  }

  if (fs.existsSync(destinationDir)) {
    fs.renameSync(destinationDir, rollbackDir);
  }

  if (fs.existsSync(sourceDir)) {
    fs.cpSync(sourceDir, destinationDir, { recursive: true, force: true });
  } else {
    ensureDir(destinationDir);
  }

  return () => {
    if (fs.existsSync(destinationDir)) fs.rmSync(destinationDir, { recursive: true, force: true });
    if (fs.existsSync(rollbackDir)) fs.renameSync(rollbackDir, destinationDir);
  };
}

function commitSyncDirectory(destinationDir: string): void {
  const parent = path.dirname(destinationDir);
  const base = path.basename(destinationDir);
  if (!fs.existsSync(parent)) return;
  const siblings = fs.readdirSync(parent);
  for (const s of siblings) {
    if (s.startsWith(`${base}.pre-restore-`)) {
      fs.rmSync(path.join(parent, s), { recursive: true, force: true });
    }
  }
}

function parseManifest(tempDir: string): BackupManifest {
  const manifestPath = path.join(tempDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Backup inválido: manifest.json não encontrado.');
  }

  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Partial<BackupManifest>;
  if (
    typeof parsed.backupVersion !== 'number' ||
    parsed.backupVersion > BACKUP_VERSION ||
    !parsed.createdAt ||
    !parsed.appVersion
  ) {
    throw new Error('Backup inválido: manifest incompatível ou incompleto.');
  }
  const inferredEngine: DatabaseEngine =
    parsed.engine ||
    (fs.existsSync(path.join(tempDir, 'database', 'postgres.dump')) ? 'postgresql' : 'sqlite');
  return {
    backupVersion: parsed.backupVersion,
    appVersion: parsed.appVersion,
    createdAt: parsed.createdAt,
    engine: inferredEngine,
    contents: parsed.contents || [],
    items: parsed.items || [],
    warnings: parsed.warnings || [],
    integrity: parsed.integrity || { algorithm: 'sha256' }
  };
}

function maybeRestoreConfigSnapshot(tempDir: string): void {
  const configDir = path.join(tempDir, 'config');
  if (!fs.existsSync(configDir)) return;

  const encPath = path.join(configDir, 'environment.snapshot.enc');
  const jsonPath = path.join(configDir, 'environment.snapshot.json');
  const outputPath = path.join(process.cwd(), 'data', 'backups', '.env.restore.suggested');
  ensureDir(path.dirname(outputPath));

  if (fs.existsSync(encPath)) {
    const key = process.env.BACKUP_ENCRYPTION_KEY?.trim();
    if (!key) return;
    const plain = decryptJson(fs.readFileSync(encPath, 'utf-8'), key);
    fs.writeFileSync(outputPath, plain, 'utf-8');
    return;
  }

  if (fs.existsSync(jsonPath)) {
    fs.writeFileSync(outputPath, fs.readFileSync(jsonPath, 'utf-8'), 'utf-8');
  }
}

async function checkTableCount(tableName: string): Promise<PostRestoreCheckItem> {
  try {
    const row = await dbGet(`SELECT COUNT(*) as total FROM ${tableName}`);
    const total =
      row && typeof row.total === 'number'
        ? row.total
        : row && typeof row.total === 'string'
          ? Number(row.total)
          : NaN;
    if (!Number.isFinite(total)) {
      return { name: `table:${tableName}`, ok: false, details: 'Contagem não pôde ser validada.' };
    }
    return { name: `table:${tableName}`, ok: true, details: `Registros: ${total}` };
  } catch (error: any) {
    return { name: `table:${tableName}`, ok: false, details: error?.message || 'Tabela indisponível' };
  }
}

export async function runPostRestoreChecklist(): Promise<PostRestoreChecklistReport> {
  const items: PostRestoreCheckItem[] = [];
  try {
    await dbGet('SELECT 1 as ok');
    items.push({ name: 'database:connectivity', ok: true, details: 'Conexão ativa.' });
  } catch (error: any) {
    items.push({
      name: 'database:connectivity',
      ok: false,
      details: error?.message || 'Falha de conectividade'
    });
  }

  const tableChecks = await Promise.all([
    checkTableCount('users'),
    checkTableCount('tickets'),
    checkTableCount('report_schedules'),
    checkTableCount('audit_log')
  ]);
  items.push(...tableChecks);

  const uploadsPath = path.isAbsolute(config.storage.uploads)
    ? config.storage.uploads
    : path.join(process.cwd(), config.storage.uploads);
  const imagesPath = path.isAbsolute(config.storage.images)
    ? config.storage.images
    : path.join(process.cwd(), config.storage.images);
  const avatarsPath = path.join(process.cwd(), 'storage', 'avatars');
  const configSuggestionPath = path.join(process.cwd(), 'data', 'backups', '.env.restore.suggested');

  const storageChecks: Array<[string, string]> = [
    ['storage:uploads', uploadsPath],
    ['storage:images', imagesPath],
    ['storage:avatars', avatarsPath]
  ];
  for (const [name, p] of storageChecks) {
    const ok = fs.existsSync(p);
    items.push({
      name,
      ok,
      details: ok ? `Diretório disponível: ${p}` : `Diretório ausente: ${p}`
    });
  }

  items.push({
    name: 'config:snapshotSuggestion',
    ok: fs.existsSync(configSuggestionPath),
    details: `Arquivo: ${configSuggestionPath}`
  });

  const passed = items.filter((i) => i.ok).length;
  const failed = items.length - passed;
  return {
    executedAt: new Date().toISOString(),
    summary: { passed, failed },
    items
  };
}

export async function createBackup(): Promise<{ stream: Readable; filename: string }> {
  const now = new Date();
  const datePart = now.toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `erp-backup-${datePart}.zip`;
  const adapter = selectAdapter();
  const tempRoot = path.join(process.cwd(), 'data', 'backups', `temp-${Date.now()}`);
  ensureDir(tempRoot);

  try {
    const includeLogs = process.env.BACKUP_INCLUDE_LOGS !== 'false';
    const dbArtifact = await adapter.createBackupArtifact(tempRoot);
    const configArtifact = createConfigSnapshotArtifact(tempRoot);
    const storageEntries = existingCatalogEntries(buildBackupCatalog({ includeLogs }));

    const warnings: string[] = [];
    const items: BackupItem[] = [];
    items.push({
      path: dbArtifact.zipPath,
      category: 'database',
      type: 'file',
      required: true,
      size: fileSize(dbArtifact.absolutePath),
      checksum: hashFile(dbArtifact.absolutePath)
    });
    items.push({
      path: configArtifact.zipPath,
      category: 'config',
      type: 'file',
      required: false,
      size: fileSize(configArtifact.absolutePath),
      checksum: hashFile(configArtifact.absolutePath)
    });
    for (const entry of storageEntries) {
      const stats = computeDirectoryStats(entry.absolutePath);
      items.push({
        path: entry.zipPath,
        category: entry.category,
        type: entry.type,
        required: entry.required,
        size: stats.bytes,
        checksum: hashString(`${stats.bytes}:${stats.fileCount}`)
      });
    }

    const manifest: BackupManifest = {
      backupVersion: BACKUP_VERSION,
      appVersion,
      createdAt: now.toISOString(),
      engine: adapter.engine,
      contents: items.map((i) => i.path),
      items,
      warnings,
      integrity: {
        algorithm: 'sha256'
      }
    };
    const signature = signManifest(manifest);
    if (signature) {
      manifest.integrity.manifestHmac = signature;
    } else {
      warnings.push('BACKUP_HMAC_KEY não configurado; assinatura de manifest desabilitada.');
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = archive as unknown as Readable;

    archive.file(dbArtifact.absolutePath, { name: dbArtifact.zipPath });
    archive.file(configArtifact.absolutePath, { name: configArtifact.zipPath });
    for (const entry of storageEntries) {
      if (entry.type === 'directory') archive.directory(entry.absolutePath, entry.zipPath);
      else archive.file(entry.absolutePath, { name: entry.zipPath });
    }
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    (archive as any).on('end', () => {
      if (fs.existsSync(tempRoot)) fs.rmSync(tempRoot, { recursive: true, force: true });
    });
    (archive as any).on('error', () => {
      if (fs.existsSync(tempRoot)) fs.rmSync(tempRoot, { recursive: true, force: true });
    });
    archive.finalize();

    return { stream, filename };
  } catch (error: any) {
    if (fs.existsSync(tempRoot)) fs.rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(error?.message || 'Erro ao gerar backup');
  }
}

export async function createBackupToFile(outputFile: string): Promise<{ filename: string; outputFile: string }> {
  const { stream, filename } = await createBackup();
  await writeZipToFile(stream, outputFile);
  return { filename, outputFile };
}

export async function validateBackupBuffer(zipBuffer: Buffer): Promise<ValidateBackupResult> {
  if (zipBuffer.length > MAX_RESTORE_SIZE) {
    throw new Error('Arquivo de backup muito grande. Máximo: 500 MB.');
  }
  if (!isZipBuffer(zipBuffer)) {
    throw new Error('Arquivo inválido. Esperado um ZIP de backup do ERP.');
  }

  const zip = new AdmZip(zipBuffer);
  const { entryCount, uncompressedBytes } = validateZipStructure(zip);

  const tempDir = path.join(process.cwd(), 'data', 'backups', `validate-${Date.now()}`);
  ensureDir(tempDir);
  try {
    extractZipSafely(zip, tempDir);
    const manifest = parseManifest(tempDir);
    const warnings = [...(manifest.warnings || [])];
    const signCheck = verifyManifestSignature(manifest);
    if (signCheck.warning) warnings.push(signCheck.warning);
    return {
      valid: signCheck.ok,
      manifest,
      warnings,
      entryCount,
      uncompressedBytes
    };
  } finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function restoreBackup(zipBuffer: Buffer): Promise<RestoreResult> {
  const validation = await validateBackupBuffer(zipBuffer);
  if (!validation.manifest) {
    throw new Error('Manifest do backup não pôde ser validado.');
  }
  if (!validation.valid) {
    throw new Error('Backup rejeitado por falha de integridade/assinatura.');
  }

  const zip = new AdmZip(zipBuffer);
  const tempDir = path.join(process.cwd(), 'data', 'backups', `restore-${Date.now()}`);
  ensureDir(tempDir);

  const warnings = [...validation.warnings];
  let rollbackUploads: (() => void) | null = null;
  let rollbackImages: (() => void) | null = null;
  let rollbackAvatars: (() => void) | null = null;

  try {
    extractZipSafely(zip, tempDir);
    const manifest = parseManifest(tempDir);
    const currentAdapter = selectAdapter();
    if (manifest.engine !== currentAdapter.engine) {
      throw new Error(
        `Engine incompatível para restore. Backup: ${manifest.engine}; ambiente atual: ${currentAdapter.engine}.`
      );
    }

    const uploadsDest = path.isAbsolute(config.storage.uploads)
      ? config.storage.uploads
      : path.join(process.cwd(), config.storage.uploads);
    const imagesDest = path.isAbsolute(config.storage.images)
      ? config.storage.images
      : path.join(process.cwd(), config.storage.images);
    const avatarsDest = path.join(process.cwd(), 'storage', 'avatars');

    rollbackUploads = syncDirectoryAtomic(path.join(tempDir, 'storage', 'uploads'), uploadsDest);
    rollbackImages = syncDirectoryAtomic(path.join(tempDir, 'storage', 'images'), imagesDest);
    rollbackAvatars = syncDirectoryAtomic(path.join(tempDir, 'storage', 'avatars'), avatarsDest);

    const dbArtifactPath =
      manifest.engine === 'postgresql'
        ? path.join(tempDir, 'database', 'postgres.dump')
        : path.join(tempDir, 'database', 'chamados.db');
    await currentAdapter.restoreFromArtifact(dbArtifactPath);

    maybeRestoreConfigSnapshot(tempDir);
    commitSyncDirectory(uploadsDest);
    commitSyncDirectory(imagesDest);
    commitSyncDirectory(avatarsDest);

    warnings.push(
      'Snapshot de configuração salvo em data/backups/.env.restore.suggested (não aplicado automaticamente).'
    );
    const checks = await runPostRestoreChecklist();
    if (checks.summary.failed > 0) {
      warnings.push(`Checklist pós-restore com ${checks.summary.failed} falha(s).`);
    }

    return {
      success: true,
      backupVersion: manifest.backupVersion,
      appVersion: manifest.appVersion,
      createdAt: manifest.createdAt,
      message:
        'Restauração concluída com sucesso. Reinicie o servidor para aplicar completamente o banco restaurado.',
      warnings,
      checks
    };
  } catch (error: any) {
    rollbackAvatars?.();
    rollbackImages?.();
    rollbackUploads?.();
    throw new Error(error?.message || 'Erro ao restaurar backup');
  } finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
