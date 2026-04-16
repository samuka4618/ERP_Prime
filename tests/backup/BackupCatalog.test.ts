import { buildBackupCatalog } from '../../src/core/backup/BackupCatalog';

describe('BackupCatalog', () => {
  it('deve incluir diretórios principais de storage', () => {
    const entries = buildBackupCatalog({ includeLogs: false });
    const paths = entries.map((e) => e.zipPath);
    expect(paths).toContain('storage/uploads');
    expect(paths).toContain('storage/images');
    expect(paths).toContain('storage/avatars');
  });

  it('deve incluir logs quando habilitado', () => {
    const entries = buildBackupCatalog({ includeLogs: true });
    const paths = entries.map((e) => e.zipPath);
    expect(paths).toContain('logs');
  });
});
