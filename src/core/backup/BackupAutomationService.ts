import fs from 'fs';
import path from 'path';
import { createBackupToFile } from './BackupService';

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return value === 'true';
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function enforceRetention(directory: string, maxFiles: number): void {
  if (!fs.existsSync(directory)) return;
  const files = fs
    .readdirSync(directory)
    .map((name) => ({ name, full: path.join(directory, name), stat: fs.statSync(path.join(directory, name)) }))
    .filter((f) => f.stat.isFile() && f.name.endsWith('.zip'))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  for (const file of files.slice(maxFiles)) {
    fs.rmSync(file.full, { force: true });
  }
}

function copyToOffsite(localFile: string): void {
  const offsitePath = process.env.BACKUP_OFFSITE_PATH?.trim();
  if (!offsitePath) return;
  fs.mkdirSync(offsitePath, { recursive: true });
  const target = path.join(offsitePath, path.basename(localFile));
  fs.copyFileSync(localFile, target);
}

export class BackupAutomationService {
  private static timer: NodeJS.Timeout | null = null;
  private static running = false;
  private static lastRunAt: string | null = null;
  private static lastSuccessAt: string | null = null;
  private static lastError: string | null = null;
  private static lastOutputFile: string | null = null;
  private static lastDurationMs: number | null = null;
  private static lastRetentionLocal: number | null = null;
  private static lastRetentionOffsite: number | null = null;
  private static lastLocalCount: number | null = null;
  private static lastOffsiteCount: number | null = null;

  public static getHealth() {
    return {
      enabled: parseBoolean(process.env.BACKUP_AUTO_ENABLED, false),
      running: this.running,
      everyMinutes: parseNumber(process.env.BACKUP_AUTO_EVERY_MINUTES, 720),
      retentionLocal: parseNumber(process.env.BACKUP_RETENTION_COUNT, 30),
      retentionOffsite: parseNumber(
        process.env.BACKUP_OFFSITE_RETENTION_COUNT,
        parseNumber(process.env.BACKUP_RETENTION_COUNT, 30)
      ),
      offsitePathConfigured: !!process.env.BACKUP_OFFSITE_PATH?.trim(),
      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      lastError: this.lastError,
      lastOutputFile: this.lastOutputFile,
      lastDurationMs: this.lastDurationMs,
      lastRetentionLocal: this.lastRetentionLocal,
      lastRetentionOffsite: this.lastRetentionOffsite,
      lastLocalCount: this.lastLocalCount,
      lastOffsiteCount: this.lastOffsiteCount
    };
  }

  public static start(): void {
    const enabled = parseBoolean(process.env.BACKUP_AUTO_ENABLED, false);
    if (!enabled || this.timer) return;

    const everyMinutes = parseNumber(process.env.BACKUP_AUTO_EVERY_MINUTES, 720); // 12h default
    const intervalMs = everyMinutes * 60 * 1000;
    this.timer = setInterval(() => {
      this.runOnce().catch((err) => {
        console.error('BackupAutomationService.runOnce:', err);
      });
    }, intervalMs);

    // Primeira execução atrasada para evitar impacto no boot.
    setTimeout(() => {
      this.runOnce().catch((err) => {
        console.error('BackupAutomationService first run:', err);
      });
    }, 45 * 1000);
  }

  public static stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  public static async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const startedAt = Date.now();
    this.lastRunAt = new Date().toISOString();
    try {
      const archiveDir = path.join(process.cwd(), 'data', 'backups', 'archives');
      fs.mkdirSync(archiveDir, { recursive: true });
      const filename = `scheduled-${Date.now()}.zip`;
      const outputFile = path.join(archiveDir, filename);
      await createBackupToFile(outputFile);
      this.lastOutputFile = outputFile;
      copyToOffsite(outputFile);
      const retention = parseNumber(process.env.BACKUP_RETENTION_COUNT, 30);
      enforceRetention(archiveDir, retention);
      this.lastRetentionLocal = retention;
      const offsiteRetention = parseNumber(process.env.BACKUP_OFFSITE_RETENTION_COUNT, retention);
      const offsitePath = process.env.BACKUP_OFFSITE_PATH?.trim();
      if (offsitePath) {
        enforceRetention(offsitePath, offsiteRetention);
        this.lastRetentionOffsite = offsiteRetention;
      }
      this.lastLocalCount = fs
        .readdirSync(archiveDir)
        .filter((name) => name.toLowerCase().endsWith('.zip')).length;
      if (offsitePath && fs.existsSync(offsitePath)) {
        this.lastOffsiteCount = fs
          .readdirSync(offsitePath)
          .filter((name) => name.toLowerCase().endsWith('.zip')).length;
      } else {
        this.lastOffsiteCount = null;
      }
      this.lastSuccessAt = new Date().toISOString();
      this.lastError = null;
      this.lastDurationMs = Date.now() - startedAt;
    } catch (error: any) {
      this.lastError = error?.message || 'Erro desconhecido';
      this.lastDurationMs = Date.now() - startedAt;
      throw error;
    } finally {
      this.running = false;
    }
  }
}
