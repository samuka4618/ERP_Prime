import { dbGet, dbRun, dbAll } from '../database/connection';
import { SystemConfig } from '../types';

export class SystemConfigModel {
  static async getSystemConfig(): Promise<SystemConfig> {
    const configs = await dbAll('SELECT key, value FROM system_config') as Array<{ key: string; value: string }>;
    
    const config: Partial<SystemConfig> = {
      sla_first_response_hours: 4,
      sla_resolution_hours: 24,
      reopen_days: 7,
      max_file_size: 10485760,
      allowed_file_types: 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png',
      email_notifications: true,
      system_name: 'Sistema de Chamados Financeiro',
      system_version: '1.0.0'
    };

    // Mapear valores do banco para o objeto de configuração
    for (const item of configs) {
      switch (item.key) {
        case 'sla_first_response_hours':
          config.sla_first_response_hours = parseInt(item.value);
          break;
        case 'sla_resolution_hours':
          config.sla_resolution_hours = parseInt(item.value);
          break;
        case 'reopen_days':
          config.reopen_days = parseInt(item.value);
          break;
        case 'max_file_size':
          config.max_file_size = parseInt(item.value);
          break;
        case 'allowed_file_types':
          config.allowed_file_types = item.value;
          break;
        case 'email_notifications':
          config.email_notifications = item.value === '1' || item.value === 'true';
          break;
        case 'system_name':
          config.system_name = item.value;
          break;
        case 'system_version':
          config.system_version = item.value;
          break;
      }
    }

    return config as SystemConfig;
  }

  static async updateSystemConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
    const updateMap: { [key: string]: string } = {};

    if (updates.sla_first_response_hours !== undefined) {
      updateMap['sla_first_response_hours'] = updates.sla_first_response_hours.toString();
    }
    if (updates.sla_resolution_hours !== undefined) {
      updateMap['sla_resolution_hours'] = updates.sla_resolution_hours.toString();
    }
    if (updates.reopen_days !== undefined) {
      updateMap['reopen_days'] = updates.reopen_days.toString();
    }
    if (updates.max_file_size !== undefined) {
      updateMap['max_file_size'] = updates.max_file_size.toString();
    }
    if (updates.allowed_file_types !== undefined) {
      updateMap['allowed_file_types'] = updates.allowed_file_types;
    }
    if (updates.email_notifications !== undefined) {
      updateMap['email_notifications'] = updates.email_notifications ? '1' : '0';
    }
    if (updates.system_name !== undefined) {
      updateMap['system_name'] = updates.system_name;
    }
    if (updates.system_version !== undefined) {
      updateMap['system_version'] = updates.system_version;
    }

    // Atualizar cada configuração
    for (const [key, value] of Object.entries(updateMap)) {
      await dbRun(
        'INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
        [key, value]
      );
    }

    return this.getSystemConfig();
  }

  static async getSystemStats(): Promise<any> {
    const stats = await dbAll(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE is_active = 1) as total_users,
        (SELECT COUNT(*) FROM tickets) as total_tickets,
        (SELECT COUNT(*) FROM tickets WHERE status = 'open') as open_tickets,
        (SELECT COUNT(*) FROM ticket_categories WHERE is_active = 1) as total_categories
    `) as Array<{
      total_users: number;
      total_tickets: number;
      open_tickets: number;
      total_categories: number;
    }>;

    return stats[0] || {
      total_users: 0,
      total_tickets: 0,
      open_tickets: 0,
      total_categories: 0
    };
  }
}
