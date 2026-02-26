import { dbRun, dbAll, dbGet } from './connection';
import { logger } from '../../shared/utils/logger';

/**
 * Script de migração para adicionar novas permissões ao sistema
 * Execute este script uma vez para adicionar todas as novas permissões
 */
async function migrateAddPermissions() {
  try {
    logger.info('🔄 Iniciando migração de permissões...', {}, 'MIGRATION');

    // Lista de novas permissões a serem adicionadas
    const newPermissions = [
      // Sistema de Chamados - Anexos e Arquivos
      { name: 'Visualizar Anexos', code: 'tickets.attachments.view', module: 'tickets', description: 'Permite visualizar anexos de chamados' },
      { name: 'Fazer Upload de Anexos', code: 'tickets.attachments.upload', module: 'tickets', description: 'Permite fazer upload de anexos em chamados' },
      { name: 'Excluir Anexos', code: 'tickets.attachments.delete', module: 'tickets', description: 'Permite excluir anexos de chamados' },
      
      // Sistema de Chamados - Mensagens e Comentários
      { name: 'Visualizar Mensagens', code: 'tickets.messages.view', module: 'tickets', description: 'Permite visualizar mensagens e comentários em chamados' },
      { name: 'Criar Mensagens', code: 'tickets.messages.create', module: 'tickets', description: 'Permite criar mensagens e comentários em chamados' },
      { name: 'Editar Mensagens', code: 'tickets.messages.edit', module: 'tickets', description: 'Permite editar mensagens próprias' },
      { name: 'Excluir Mensagens', code: 'tickets.messages.delete', module: 'tickets', description: 'Permite excluir mensagens de chamados' },
      
      // Sistema de Chamados - Histórico e Auditoria
      { name: 'Visualizar Histórico', code: 'tickets.history.view', module: 'tickets', description: 'Permite visualizar histórico de alterações de chamados' },
      { name: 'Exportar Chamados', code: 'tickets.export', module: 'tickets', description: 'Permite exportar chamados (Excel, PDF, CSV)' },
      
      // Sistema de Chamados - Ações Avançadas
      { name: 'Ações em Massa', code: 'tickets.bulk_actions', module: 'tickets', description: 'Permite executar ações em massa em chamados' },
      { name: 'Gerenciar Prioridades', code: 'tickets.priority.manage', module: 'tickets', description: 'Permite gerenciar prioridades de chamados' },
      { name: 'Visualizar SLA', code: 'tickets.sla.view', module: 'tickets', description: 'Permite visualizar informações de SLA' },
      { name: 'Gerenciar SLA', code: 'tickets.sla.manage', module: 'tickets', description: 'Permite gerenciar configurações de SLA' },
      
      // Sistema de Cadastros - Ações Avançadas
      { name: 'Exportar Cadastros', code: 'registrations.export', module: 'registrations', description: 'Permite exportar cadastros (Excel, PDF, CSV)' },
      { name: 'Aprovar Cadastros', code: 'registrations.approve', module: 'registrations', description: 'Permite aprovar cadastros pendentes' },
      { name: 'Rejeitar Cadastros', code: 'registrations.reject', module: 'registrations', description: 'Permite rejeitar cadastros' },
      { name: 'Visualizar Análise de Crédito', code: 'registrations.analise_credito.view', module: 'registrations', description: 'Permite visualizar análise de crédito' },
      { name: 'Gerenciar Análise de Crédito', code: 'registrations.analise_credito.manage', module: 'registrations', description: 'Permite gerenciar análise de crédito' },
      { name: 'Visualizar Informações Financeiras', code: 'registrations.financial.view', module: 'registrations', description: 'Permite visualizar informações financeiras' },
      { name: 'Editar Informações Financeiras', code: 'registrations.financial.edit', module: 'registrations', description: 'Permite editar informações financeiras' },
      { name: 'Visualizar Histórico de Cadastros', code: 'registrations.history.view', module: 'registrations', description: 'Permite visualizar histórico de alterações de cadastros' },
      
      // Notificações
      { name: 'Visualizar Notificações', code: 'notifications.view', module: 'notifications', description: 'Permite visualizar notificações' },
      { name: 'Gerenciar Notificações', code: 'notifications.manage', module: 'notifications', description: 'Permite gerenciar notificações (marcar como lida, excluir)' },
      { name: 'Gerenciar Configurações de Notificações', code: 'notifications.settings.manage', module: 'notifications', description: 'Permite gerenciar configurações de notificações' },
      
      // Relatórios - Permissões Adicionais
      { name: 'Editar Relatórios', code: 'reports.edit', module: 'administration', description: 'Permite editar relatórios existentes' },
      { name: 'Excluir Relatórios', code: 'reports.delete', module: 'administration', description: 'Permite excluir relatórios' },
      { name: 'Executar Relatórios', code: 'reports.execute', module: 'administration', description: 'Permite executar relatórios' },
      { name: 'Exportar Relatórios', code: 'reports.export', module: 'administration', description: 'Permite exportar relatórios' },
      { name: 'Gerenciar Agendamento de Relatórios', code: 'reports.schedule.manage', module: 'administration', description: 'Permite gerenciar agendamento de relatórios' },
      
      // Dashboard e Visualizações
      { name: 'Acessar Dashboard', code: 'dashboard.view', module: 'administration', description: 'Permite acessar o dashboard principal' },
      { name: 'Personalizar Dashboard', code: 'dashboard.customize', module: 'administration', description: 'Permite personalizar o dashboard' },
      
      // Usuários - Permissões Adicionais
      { name: 'Fazer Login como Outro Usuário', code: 'users.impersonate', module: 'administration', description: 'Permite fazer login como outro usuário (para suporte)' },
      { name: 'Exportar Usuários', code: 'users.export', module: 'administration', description: 'Permite exportar lista de usuários' },
      { name: 'Visualizar Atividade de Usuários', code: 'users.activity.view', module: 'administration', description: 'Permite visualizar atividade de usuários' },
      { name: 'Redefinir Senhas', code: 'users.password.reset', module: 'administration', description: 'Permite redefinir senhas de usuários' },
      
      // Sistema - Permissões Adicionais
      { name: 'Visualizar Logs do Sistema', code: 'system.logs.view', module: 'administration', description: 'Permite visualizar logs do sistema' },
      { name: 'Gerenciar Backups', code: 'system.backup.manage', module: 'administration', description: 'Permite gerenciar backups do sistema' },
      { name: 'Criar Backup do Sistema', code: 'system.backup.create', module: 'administration', description: 'Permite gerar arquivo de backup (banco e storage)' },
      { name: 'Restaurar Backup do Sistema', code: 'system.backup.restore', module: 'administration', description: 'Permite restaurar sistema a partir de arquivo de backup' },
      { name: 'Manutenção do Sistema', code: 'system.maintenance', module: 'administration', description: 'Permite colocar sistema em manutenção' },
      { name: 'Visualizar Auditoria', code: 'system.audit.view', module: 'administration', description: 'Permite visualizar auditoria do sistema' },
      
      // Performance e Monitoramento
      { name: 'Gerenciar Performance', code: 'performance.manage', module: 'administration', description: 'Permite gerenciar configurações de performance' },
      { name: 'Gerenciar Alertas de Monitoramento', code: 'monitoring.alerts.manage', module: 'administration', description: 'Permite gerenciar alertas de monitoramento' }
    ];

    let added = 0;
    let skipped = 0;

    // Inserir cada permissão
    for (const perm of newPermissions) {
      try {
        // Verificar se a permissão já existe
        const existing = await dbGet(
          'SELECT id FROM permissions WHERE code = ?',
          [perm.code]
        ) as any;

        if (existing) {
          logger.debug(`Permissão já existe: ${perm.code}`, {}, 'MIGRATION');
          skipped++;
          continue;
        }

        // Inserir nova permissão
        await dbRun(
          `INSERT INTO permissions (name, code, module, description, created_at, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [perm.name, perm.code, perm.module, perm.description]
        );

        logger.debug(`Permissão adicionada: ${perm.code}`, {}, 'MIGRATION');
        added++;
      } catch (error: any) {
        if (error.message.includes('UNIQUE constraint')) {
          logger.debug(`Permissão já existe (constraint): ${perm.code}`, {}, 'MIGRATION');
          skipped++;
        } else {
          logger.error(`Erro ao adicionar permissão ${perm.code}:`, { error: error.message }, 'MIGRATION');
        }
      }
    }

    // Atribuir permissões padrão para roles
    logger.info('Atribuindo permissões aos roles...', {}, 'MIGRATION');

    // Admin - todas as permissões
    const allPermissions = await dbAll('SELECT id FROM permissions') as any[];
    for (const perm of allPermissions) {
      await dbRun(
        `INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
         VALUES ('admin', ?, 1)`,
        [perm.id]
      );
    }

    // Attendant - permissões específicas
    const attendantPermissions = [
      'tickets.view', 'tickets.create', 'tickets.edit', 'tickets.assign', 'tickets.close', 'tickets.reopen',
      'tickets.attachments.view', 'tickets.attachments.upload', 'tickets.messages.view', 'tickets.messages.create',
      'tickets.history.view', 'tickets.sla.view',
      'registrations.view', 'registrations.create', 'registrations.edit',
      'registrations.financial.view', 'registrations.history.view',
      'notifications.view', 'notifications.manage',
      'reports.view', 'reports.execute', 'reports.export',
      'dashboard.view'
    ];

    for (const code of attendantPermissions) {
      const perm = await dbGet('SELECT id FROM permissions WHERE code = ?', [code]) as any;
      if (perm) {
        await dbRun(
          `INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
           VALUES ('attendant', ?, 1)`,
          [perm.id]
        );
      }
    }

    // User - permissões básicas
    const userPermissions = [
      'tickets.view', 'tickets.create',
      'tickets.attachments.view', 'tickets.attachments.upload',
      'tickets.messages.view', 'tickets.messages.create',
      'tickets.history.view',
      'registrations.view',
      'notifications.view', 'notifications.manage',
      'dashboard.view'
    ];

    for (const code of userPermissions) {
      const perm = await dbGet('SELECT id FROM permissions WHERE code = ?', [code]) as any;
      if (perm) {
        await dbRun(
          `INSERT OR IGNORE INTO role_permissions (role, permission_id, granted)
           VALUES ('user', ?, 1)`,
          [perm.id]
        );
      }
    }

    logger.success(`✅ Migração concluída! Adicionadas: ${added}, Ignoradas: ${skipped}`, {}, 'MIGRATION');
    logger.info(`Total de permissões no sistema: ${allPermissions.length}`, {}, 'MIGRATION');

  } catch (error: any) {
    logger.error('❌ Erro durante a migração:', { error: error.message, stack: error.stack }, 'MIGRATION');
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  migrateAddPermissions()
    .then(() => {
      console.log('✅ Migração concluída com sucesso!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na migração:', error);
      process.exit(1);
    });
}

export { migrateAddPermissions };

