import { dbAll, dbGet, dbRun } from '../database/connection';
import { bindBoolean } from '../database/sql-dialect';

export interface AccessProfile {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export class AccessProfileModel {
  static async findAll(): Promise<AccessProfile[]> {
    return await dbAll('SELECT * FROM access_profiles ORDER BY is_system DESC, name ASC');
  }

  static async findById(id: number): Promise<AccessProfile | null> {
    return await dbGet('SELECT * FROM access_profiles WHERE id = ?', [id]) as AccessProfile | null;
  }

  static async create(input: { name: string; slug: string; description?: string | null; is_system?: boolean }): Promise<AccessProfile> {
    await dbRun(
      `INSERT INTO access_profiles (name, slug, description, is_system, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [input.name, input.slug, input.description || null, bindBoolean(!!input.is_system), bindBoolean(true)]
    );
    const created = await dbGet('SELECT * FROM access_profiles WHERE slug = ?', [input.slug]) as AccessProfile | null;
    if (!created) throw new Error('Falha ao criar perfil');
    return created;
  }

  static async update(id: number, input: { name?: string; description?: string | null; is_active?: boolean }): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      values.push(input.description || null);
    }
    if (input.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(bindBoolean(!!input.is_active));
    }
    if (!fields.length) return;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    await dbRun(`UPDATE access_profiles SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  static async replaceProfilePermissions(profileId: number, permissions: Array<{ permissionId: number; granted: boolean }>): Promise<void> {
    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun('DELETE FROM profile_permissions WHERE profile_id = ?', [profileId]);
      const deduped = new Map<number, boolean>();
      for (const p of permissions) {
        const permissionId = Number(p.permissionId);
        if (!Number.isInteger(permissionId) || permissionId <= 0) continue;
        deduped.set(permissionId, !!p.granted);
      }
      for (const [permissionId, granted] of deduped.entries()) {
        await dbRun(
          `INSERT INTO profile_permissions (profile_id, permission_id, granted)
           VALUES (?, ?, ?)
           ON CONFLICT(profile_id, permission_id) DO UPDATE SET granted = ?`,
          [profileId, permissionId, bindBoolean(granted), bindBoolean(granted)]
        );
      }
      await dbRun('COMMIT');
    } catch (e) {
      await dbRun('ROLLBACK');
      throw e;
    }
  }

  static async getProfilePermissions(profileId: number): Promise<Array<{ permission_id: number; granted: boolean }>> {
    return await dbAll('SELECT permission_id, granted FROM profile_permissions WHERE profile_id = ?', [profileId]);
  }

  static async assignProfileToUser(userId: number, profileId: number, assignedBy?: number): Promise<void> {
    await dbRun(
      `INSERT INTO user_access_profiles (user_id, profile_id, assigned_by)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, profile_id) DO NOTHING`,
      [userId, profileId, assignedBy || null]
    );
  }

  static async setUserProfiles(userId: number, profileIds: number[], assignedBy?: number): Promise<void> {
    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun('DELETE FROM user_access_profiles WHERE user_id = ?', [userId]);
      for (const profileId of profileIds) {
        await dbRun(
          `INSERT INTO user_access_profiles (user_id, profile_id, assigned_by) VALUES (?, ?, ?)`,
          [userId, profileId, assignedBy || null]
        );
      }
      await dbRun('COMMIT');
    } catch (e) {
      await dbRun('ROLLBACK');
      throw e;
    }
  }

  static async getUserProfiles(userId: number): Promise<AccessProfile[]> {
    return await dbAll(
      `SELECT ap.*
       FROM user_access_profiles uap
       JOIN access_profiles ap ON ap.id = uap.profile_id
       WHERE uap.user_id = ?
       ORDER BY ap.name ASC`,
      [userId]
    );
  }
}

