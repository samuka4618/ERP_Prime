import fs from 'fs';
import path from 'path';
import {
  collectEnvironmentSnapshot,
  createConfigSnapshotArtifact,
  decryptJson
} from '../../src/core/backup/ConfigSnapshotService';

describe('ConfigSnapshotService', () => {
  const tempRoot = path.join(process.cwd(), 'data', 'backups', `jest-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(tempRoot, { recursive: true });
    process.env.JWT_SECRET = 'super-secret';
    process.env.SMTP_HOST = 'smtp.test.local';
  });

  afterEach(() => {
    delete process.env.BACKUP_ENCRYPTION_KEY;
    if (fs.existsSync(tempRoot)) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('deve coletar variáveis permitidas do ambiente', () => {
    const env = collectEnvironmentSnapshot();
    expect(env.JWT_SECRET).toBe('super-secret');
    expect(env.SMTP_HOST).toBe('smtp.test.local');
  });

  it('deve gerar snapshot criptografado quando BACKUP_ENCRYPTION_KEY estiver configurado', () => {
    process.env.BACKUP_ENCRYPTION_KEY = 'abc123';
    const artifact = createConfigSnapshotArtifact(tempRoot);
    expect(artifact.encrypted).toBe(true);
    const payload = fs.readFileSync(artifact.absolutePath, 'utf-8');
    const plain = decryptJson(payload, 'abc123');
    expect(plain).toContain('JWT_SECRET');
  });
});
