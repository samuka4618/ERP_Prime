export type DatabaseEngine = 'sqlite' | 'postgresql';

export interface BackupDbArtifact {
  zipPath: string;
  absolutePath: string;
}

export interface DatabaseBackupAdapter {
  readonly engine: DatabaseEngine;
  createBackupArtifact(tempRoot: string): Promise<BackupDbArtifact>;
  restoreFromArtifact(artifactPath: string): Promise<void>;
}
