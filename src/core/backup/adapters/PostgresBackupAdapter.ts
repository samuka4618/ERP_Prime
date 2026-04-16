import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { config } from '../../../config/database';
import type { BackupDbArtifact, DatabaseBackupAdapter } from './DatabaseBackupAdapter';

function runCommand(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} falhou (${code}): ${stderr || 'sem detalhes'}`));
    });
  });
}

function ensureDatabaseUrl(): string {
  const url = config.database.databaseUrl?.trim() || '';
  if (!url) {
    throw new Error('DATABASE_URL é obrigatório para backup/restore PostgreSQL.');
  }
  return url;
}

export class PostgresBackupAdapter implements DatabaseBackupAdapter {
  public readonly engine = 'postgresql' as const;

  public async createBackupArtifact(tempRoot: string): Promise<BackupDbArtifact> {
    const databaseUrl = ensureDatabaseUrl();
    const targetDir = path.join(tempRoot, 'database');
    fs.mkdirSync(targetDir, { recursive: true });
    const dumpPath = path.join(targetDir, 'postgres.dump');

    await runCommand(
      'pg_dump',
      [databaseUrl, '--format=custom', '--no-owner', '--no-acl', '--file', dumpPath],
      process.env
    );

    return {
      zipPath: 'database/postgres.dump',
      absolutePath: dumpPath
    };
  }

  public async restoreFromArtifact(artifactPath: string): Promise<void> {
    const databaseUrl = ensureDatabaseUrl();
    if (!fs.existsSync(artifactPath)) {
      throw new Error('Dump PostgreSQL não encontrado dentro do backup.');
    }

    await runCommand(
      'pg_restore',
      [
        '--dbname',
        databaseUrl,
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
        '--single-transaction',
        artifactPath
      ],
      process.env
    );
  }
}
