import crypto from 'crypto';
import { dbAll, dbGet, dbRun } from '../database/connection';
import { bindBoolean } from '../database/sql-dialect';
import { config } from '../../config/database';

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthSessionRow {
  session_id: string;
  user_id: number;
  refresh_token_hash: string;
  user_agent: string | null;
  ip_address: string | null;
  remember_me: boolean | number;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  revoked_at: string | null;
  replaced_by_session_id: string | null;
}

export interface PublicAuthSession {
  sessionId: string;
  current: boolean;
  rememberMe: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

function normalizeIpAddress(ip?: string): string | null {
  if (!ip) return null;
  return ip.replace('::ffff:', '').slice(0, 64);
}

function toBool(value: boolean | number): boolean {
  return value === true || value === 1;
}

function parseDurationToMs(input: string): number {
  const normalized = String(input || '').trim().toLowerCase();
  const match = normalized.match(/^(\d+)\s*([smhd])$/);
  if (!match) {
    throw new Error(`Formato de duração inválido: ${input}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * unitMs[unit];
}

function hashRefreshToken(refreshToken: string): string {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

function createRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

function getRefreshTtlMs(rememberMe: boolean): number {
  const duration = rememberMe
    ? config.jwt.refreshExpiresInRemember
    : config.jwt.refreshExpiresInSession;
  return parseDurationToMs(duration);
}

function getRefreshExpiresAt(rememberMe: boolean): Date {
  const now = Date.now();
  return new Date(now + getRefreshTtlMs(rememberMe));
}

function formatDbTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function createSessionRecord(
  userId: number,
  rememberMe: boolean,
  metadata: SessionMetadata
): Promise<{ sessionId: string; refreshToken: string; expiresAt: Date }> {
  const sessionId = crypto.randomUUID();
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = getRefreshExpiresAt(rememberMe);

  await dbRun(
    `INSERT INTO auth_sessions (
      session_id, user_id, refresh_token_hash, user_agent, ip_address, remember_me, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      userId,
      refreshTokenHash,
      metadata.userAgent?.slice(0, 500) || null,
      normalizeIpAddress(metadata.ipAddress),
      bindBoolean(rememberMe),
      formatDbTimestamp(expiresAt)
    ]
  );

  return { sessionId, refreshToken, expiresAt };
}

export class AuthSessionModel {
  static parseDurationToMs(duration: string): number {
    return parseDurationToMs(duration);
  }

  static async createSession(
    userId: number,
    rememberMe: boolean,
    metadata: SessionMetadata
  ): Promise<{ sessionId: string; refreshToken: string; refreshExpiresAt: Date }> {
    const created = await createSessionRecord(userId, rememberMe, metadata);
    return {
      sessionId: created.sessionId,
      refreshToken: created.refreshToken,
      refreshExpiresAt: created.expiresAt
    };
  }

  static async validateRefreshToken(refreshToken: string): Promise<AuthSessionRow | null> {
    const tokenHash = hashRefreshToken(refreshToken);

    const row = await dbGet(
      `SELECT session_id, user_id, refresh_token_hash, user_agent, ip_address, remember_me, created_at,
              last_used_at, expires_at, revoked_at, replaced_by_session_id
         FROM auth_sessions
        WHERE refresh_token_hash = ?
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    ) as AuthSessionRow | undefined;

    return row || null;
  }

  static async rotateRefreshToken(
    refreshToken: string,
    metadata: SessionMetadata
  ): Promise<{ userId: number; rememberMe: boolean; sessionId: string; newRefreshToken: string; refreshExpiresAt: Date } | null> {
    const currentSession = await this.validateRefreshToken(refreshToken);
    if (!currentSession) {
      return null;
    }

    const rememberMe = toBool(currentSession.remember_me);
    const created = await createSessionRecord(currentSession.user_id, rememberMe, metadata);

    await dbRun(
      `UPDATE auth_sessions
          SET revoked_at = CURRENT_TIMESTAMP,
              replaced_by_session_id = ?,
              last_used_at = CURRENT_TIMESTAMP
        WHERE session_id = ?
          AND revoked_at IS NULL`,
      [created.sessionId, currentSession.session_id]
    );

    return {
      userId: currentSession.user_id,
      rememberMe,
      sessionId: created.sessionId,
      newRefreshToken: created.refreshToken,
      refreshExpiresAt: created.expiresAt
    };
  }

  static async revokeSessionByRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await dbRun(
      `UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
              last_used_at = CURRENT_TIMESTAMP
        WHERE refresh_token_hash = ?
          AND revoked_at IS NULL`,
      [tokenHash]
    );
  }

  static async revokeSessionById(userId: number, sessionId: string): Promise<boolean> {
    const result = await dbRun(
      `UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
              last_used_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND session_id = ?
          AND revoked_at IS NULL`,
      [userId, sessionId]
    );
    return result.changes > 0;
  }

  static async revokeAllUserSessions(userId: number, keepSessionId?: string): Promise<number> {
    if (keepSessionId) {
      const result = await dbRun(
        `UPDATE auth_sessions
            SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
                last_used_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
            AND session_id <> ?
            AND revoked_at IS NULL`,
        [userId, keepSessionId]
      );
      return result.changes;
    }

    const result = await dbRun(
      `UPDATE auth_sessions
          SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP),
              last_used_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND revoked_at IS NULL`,
      [userId]
    );
    return result.changes;
  }

  static async listUserSessions(userId: number, currentSessionId?: string): Promise<PublicAuthSession[]> {
    const rows = await dbAll(
      `SELECT session_id, user_id, refresh_token_hash, user_agent, ip_address, remember_me, created_at,
              last_used_at, expires_at, revoked_at, replaced_by_session_id
         FROM auth_sessions
        WHERE user_id = ?
        ORDER BY created_at DESC`,
      [userId]
    ) as AuthSessionRow[];

    return rows.map((row) => ({
      sessionId: row.session_id,
      current: !!currentSessionId && row.session_id === currentSessionId,
      rememberMe: toBool(row.remember_me),
      userAgent: row.user_agent,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at
    }));
  }
}

export default AuthSessionModel;
