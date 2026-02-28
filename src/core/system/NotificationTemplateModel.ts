import { dbGet, dbAll, dbRun } from '../database/connection';
import { bindBoolean } from '../database/sql-dialect';
import type { NotificationEmailTemplate, NotificationTemplateKey } from '../../shared/types';
import {
  NOTIFICATION_TEMPLATE_DEFINITIONS,
  getNotificationTemplateDefinition,
} from './notificationTemplateCatalog';

const TABLE = 'notification_email_templates';

/**
 * Modelo de persistência dos templates de notificação por e-mail.
 * Os registros são criados sob demanda a partir do catálogo quando a tabela está vazia.
 */
export class NotificationTemplateModel {
  /**
   * Garante que exista um registro para cada chave do catálogo (seed).
   */
  static async ensureSeeded(): Promise<void> {
    const rows = await dbAll(`SELECT notification_key FROM ${TABLE}`) as { notification_key: string }[];
    const existingKeys = new Set(rows.map((r) => r.notification_key));
    for (const def of NOTIFICATION_TEMPLATE_DEFINITIONS) {
      if (!existingKeys.has(def.key)) {
        await dbRun(
          `INSERT INTO ${TABLE} (notification_key, enabled, subject_template, body_html, updated_at) VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)`,
          [def.key, def.default_subject, def.default_body_html]
        );
      }
    }
  }

  /**
   * Retorna todos os templates (do banco), com fallback nos defaults do catálogo.
   * Faz seed automático se a tabela estiver vazia.
   */
  static async getAll(): Promise<NotificationEmailTemplate[]> {
    await this.ensureSeeded();
    const rows = (await dbAll(
      `SELECT notification_key, enabled, subject_template, body_html, updated_at FROM ${TABLE} ORDER BY notification_key`
    )) as Array<{
      notification_key: string;
      enabled: number;
      subject_template: string;
      body_html: string;
      updated_at: string | null;
    }>;
    return rows.map((r) => ({
      notification_key: r.notification_key as NotificationTemplateKey,
      enabled: Boolean(r.enabled),
      subject_template: r.subject_template,
      body_html: r.body_html,
      updated_at: r.updated_at ?? undefined,
    }));
  }

  /**
   * Retorna um template pelo key. Retorna undefined se não existir.
   */
  static async getByKey(key: NotificationTemplateKey): Promise<NotificationEmailTemplate | undefined> {
    await this.ensureSeeded();
    const row = (await dbGet(
      `SELECT notification_key, enabled, subject_template, body_html, updated_at FROM ${TABLE} WHERE notification_key = ?`,
      [key]
    )) as {
      notification_key: string;
      enabled: number;
      subject_template: string;
      body_html: string;
      updated_at: string | null;
    } | undefined;
    if (!row) return undefined;
    return {
      notification_key: row.notification_key as NotificationTemplateKey,
      enabled: Boolean(row.enabled),
      subject_template: row.subject_template,
      body_html: row.body_html,
      updated_at: row.updated_at ?? undefined,
    };
  }

  /**
   * Atualiza um template. Cria o registro se não existir (a partir do catálogo).
   */
  static async update(
    key: NotificationTemplateKey,
    data: Partial<Pick<NotificationEmailTemplate, 'enabled' | 'subject_template' | 'body_html'>>
  ): Promise<NotificationEmailTemplate> {
    await this.ensureSeeded();
    const def = getNotificationTemplateDefinition(key);
    const current = await this.getByKey(key);
    const subject = data.subject_template ?? current?.subject_template ?? def?.default_subject ?? '';
    const body = data.body_html ?? current?.body_html ?? def?.default_body_html ?? '';
    const enabled = data.enabled !== undefined ? bindBoolean(data.enabled) : (current?.enabled ? bindBoolean(true) : bindBoolean(false));

    await dbRun(
      `INSERT INTO ${TABLE} (notification_key, enabled, subject_template, body_html, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(notification_key) DO UPDATE SET
         enabled = excluded.enabled,
         subject_template = excluded.subject_template,
         body_html = excluded.body_html,
         updated_at = CURRENT_TIMESTAMP`,
      [key, enabled, subject, body]
    );
    const updated = await this.getByKey(key);
    if (!updated) throw new Error(`Template ${key} not found after update`);
    return updated;
  }
}
