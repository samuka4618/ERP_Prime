import fs from 'fs';
import path from 'path';
import { config } from '../../config/database';

export type BackupCategory = 'database' | 'storage' | 'config' | 'logs' | 'metadata';

export interface BackupCatalogEntry {
  category: BackupCategory;
  zipPath: string;
  absolutePath: string;
  required: boolean;
  type: 'file' | 'directory';
}

export interface BackupCatalogBuildOptions {
  includeLogs: boolean;
}

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

/**
 * Catálogo declarativo do que entra no backup.
 * O banco é tratado pelos adapters e não entra aqui.
 */
export function buildBackupCatalog(options: BackupCatalogBuildOptions): BackupCatalogEntry[] {
  const entries: BackupCatalogEntry[] = [
    {
      category: 'storage',
      zipPath: 'storage/uploads',
      absolutePath: resolvePath(config.storage.uploads),
      required: false,
      type: 'directory'
    },
    {
      category: 'storage',
      zipPath: 'storage/images',
      absolutePath: resolvePath(config.storage.images),
      required: false,
      type: 'directory'
    },
    {
      category: 'storage',
      zipPath: 'storage/avatars',
      absolutePath: resolvePath('./storage/avatars'),
      required: false,
      type: 'directory'
    }
  ];

  if (options.includeLogs) {
    entries.push({
      category: 'logs',
      zipPath: 'logs',
      absolutePath: resolvePath('./logs'),
      required: false,
      type: 'directory'
    });
  }

  return entries;
}

export function existingCatalogEntries(entries: BackupCatalogEntry[]): BackupCatalogEntry[] {
  return entries.filter((entry) => fs.existsSync(entry.absolutePath));
}
