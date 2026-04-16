import fs from 'fs';
import path from 'path';
import { config } from '../../../config/database';
import { db } from '../../database/connection';
import type { BackupDbArtifact, DatabaseBackupAdapter } from './DatabaseBackupAdapter';

function resolveDbPath(): string {
  return path.isAbsolute(config.database.path)
    ? config.database.path
    : path.join(process.cwd(), config.database.path);
}

async function checkpointWal(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    db.run('PRAGMA wal_checkpoint(TRUNCATE)', (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export class SqliteBackupAdapter implements DatabaseBackupAdapter {
  public readonly engine = 'sqlite' as const;

  public async createBackupArtifact(tempRoot: string): Promise<BackupDbArtifact> {
    const dbPath = resolveDbPath();
    if (!fs.existsSync(dbPath)) {
      throw new Error('Banco SQLite não encontrado para backup.');
    }

    await checkpointWal();
    const targetDir = path.join(tempRoot, 'database');
    fs.mkdirSync(targetDir, { recursive: true });
    const target = path.join(targetDir, 'chamados.db');
    fs.copyFileSync(dbPath, target);

    return {
      zipPath: 'database/chamados.db',
      absolutePath: target
    };
  }

  public async restoreFromArtifact(artifactPath: string): Promise<void> {
    if (!fs.existsSync(artifactPath)) {
      throw new Error('Arquivo de banco SQLite não encontrado dentro do backup.');
    }
    const dbPath = resolveDbPath();
    const dbDir = path.dirname(dbPath);
    fs.mkdirSync(dbDir, { recursive: true });
    fs.copyFileSync(artifactPath, dbPath + '.restored');
  }
}
