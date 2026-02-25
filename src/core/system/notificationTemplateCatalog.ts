import type { NotificationTemplateDefinition, NotificationTemplateKey } from '../../shared/types';

const defaultHtmlStyle = `
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
`.trim();

/**
 * Catálogo de todas as notificações por e-mail do sistema.
 * Cada entrada define: chave, rótulo, descrição, assunto padrão, corpo HTML padrão e placeholders disponíveis.
 */
export const NOTIFICATION_TEMPLATE_DEFINITIONS: NotificationTemplateDefinition[] = [
  {
    key: 'ticket_created_admin',
    label: 'Novo chamado criado (administradores)',
    description: 'Enviado aos administradores quando um novo chamado é criado.',
    default_subject: 'Novo Chamado Criado',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 12px 0; } .label { font-weight: 600; color: #555; }</style></head>
<body>
  <p>Um novo chamado foi criado no sistema.</p>
  <div class="box">
    <p><span class="label">Assunto:</span> {{ticket.subject}}</p>
    <p><span class="label">Categoria:</span> {{ticket.category}}</p>
    <p><span class="label">Prioridade:</span> {{ticket.priority}}</p>
    <p><span class="label">Criado por:</span> {{ticket.user_name}}</p>
  </div>
  <p>Acesse o sistema para visualizar o chamado.</p>
</body>
</html>`,
    placeholders: ['{{ticket.subject}}', '{{ticket.category}}', '{{ticket.priority}}', '{{ticket.user_name}}'],
  },
  {
    key: 'ticket_created_attendant_high_priority',
    label: 'Novo chamado alta prioridade (atendentes)',
    description: 'Enviado aos atendentes quando um chamado de prioridade alta ou urgente é criado.',
    default_subject: 'Novo Chamado - Alta Prioridade',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #fff3cd; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #ffc107; } .label { font-weight: 600; color: #856404; }</style></head>
<body>
  <p>Um novo chamado de <strong>alta prioridade</strong> foi criado.</p>
  <div class="box">
    <p><span class="label">Assunto:</span> {{ticket.subject}}</p>
    <p><span class="label">Categoria:</span> {{ticket.category}}</p>
    <p><span class="label">Prioridade:</span> {{ticket.priority}}</p>
    <p><span class="label">Criado por:</span> {{ticket.user_name}}</p>
  </div>
  <p>Acesse o sistema para atender o chamado.</p>
</body>
</html>`,
    placeholders: ['{{ticket.subject}}', '{{ticket.category}}', '{{ticket.priority}}', '{{ticket.user_name}}'],
  },
  {
    key: 'status_change',
    label: 'Alteração de status do chamado',
    description: 'Enviado ao solicitante quando o status do chamado é alterado.',
    default_subject: 'Status do Chamado Alterado',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #e7f3ff; padding: 16px; border-radius: 8px; margin: 12px 0; } .label { font-weight: 600; color: #0d6efd; }</style></head>
<body>
  <p>O status do seu chamado foi atualizado.</p>
  <div class="box">
    <p><span class="label">Assunto do chamado:</span> {{ticket.subject}}</p>
    <p><span class="label">Status anterior:</span> {{old_status}}</p>
    <p><span class="label">Novo status:</span> {{new_status}}</p>
  </div>
  <p>Acesse o sistema para mais detalhes.</p>
</body>
</html>`,
    placeholders: ['{{ticket.subject}}', '{{old_status}}', '{{new_status}}'],
  },
  {
    key: 'new_message',
    label: 'Nova mensagem no chamado',
    description: 'Enviado quando há uma nova mensagem no chamado (ao usuário ou atendente, conforme o autor).',
    default_subject: 'Nova Mensagem no Chamado',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 12px 0; }</style></head>
<body>
  <p>Há uma nova mensagem no chamado:</p>
  <div class="box">
    <p><strong>{{ticket.subject}}</strong></p>
  </div>
  <p>Acesse o sistema para visualizar a mensagem.</p>
</body>
</html>`,
    placeholders: ['{{ticket.subject}}'],
  },
  {
    key: 'sla_alert_first_response',
    label: 'Alerta de SLA - Primeira resposta',
    description: 'Enviado ao atendente e administradores quando o chamado está próximo de violar o SLA de primeira resposta.',
    default_subject: 'Alerta de SLA - Primeira Resposta',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #f8d7da; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #dc3545; } .label { font-weight: 600; color: #721c24; }</style></head>
<body>
  <p>O chamado abaixo está próximo de violar o SLA de <strong>primeira resposta</strong>.</p>
  <div class="box">
    <p><span class="label">Assunto:</span> {{ticket.subject}}</p>
    <p><span class="label">Categoria:</span> {{ticket.category}}</p>
  </div>
  <p>Priorize a primeira resposta no sistema.</p>
</body>
</html>`,
    placeholders: ['{{ticket.subject}}', '{{ticket.category}}'],
  },
  {
    key: 'sla_alert_resolution',
    label: 'Alerta de SLA - Resolução',
    description: 'Enviado ao atendente e administradores quando o chamado está próximo de violar o SLA de resolução.',
    default_subject: 'Alerta de SLA - Resolução',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #f8d7da; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #dc3545; } .label { font-weight: 600; color: #721c24; }</style></head>
<body>
  <p>O chamado abaixo está próximo de violar o SLA de <strong>resolução</strong>.</p>
  <div class="box">
    <p><span class="label">Assunto:</span> {{ticket.subject}}</p>
    <p><span class="label">Categoria:</span> {{ticket.category}}</p>
  </div>
  <p>Priorize a resolução no sistema.</p>
</body>
</html>`,
    placeholders: ['{{ticket.subject}}', '{{ticket.category}}'],
  },
  {
    key: 'ticket_reopened',
    label: 'Chamado reaberto',
    description: 'Enviado ao atendente e administradores quando o usuário reabre um chamado.',
    default_subject: 'Chamado Reaberto',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #fff3cd; padding: 16px; border-radius: 8px; margin: 12px 0; }</style></head>
<body>
  <p>O chamado abaixo foi <strong>reaberto</strong> pelo usuário.</p>
  <div class="box">
    <p><strong>{{ticket.subject}}</strong></p>
  </div>
  <p>Acesse o sistema para visualizar e atender novamente.</p>
</body>
</html>`,
    placeholders: ['{{ticket.subject}}'],
  },
  {
    key: 'approval_required',
    label: 'Chamado aguardando sua confirmação',
    description: 'Enviado ao solicitante quando o atendente finaliza o chamado e aguarda confirmação.',
    default_subject: 'Chamado Finalizado - Confirmação Necessária',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #e7f3ff; padding: 16px; border-radius: 8px; margin: 12px 0; }</style></head>
<body>
  <p>Seu chamado foi finalizado pelo atendente e precisa da sua confirmação.</p>
  <div class="box">
    <p><strong>{{ticket.subject}}</strong></p>
    <p>Status: Aguardando sua aprovação</p>
  </div>
  <p>Por favor, acesse o sistema para confirmar se o problema foi realmente resolvido.</p>
</body>
</html>`,
    placeholders: ['{{ticket.subject}}'],
  },
  {
    key: 'approval_received',
    label: 'Chamado aprovado ou rejeitado pelo solicitante',
    description: 'Enviado ao atendente quando o solicitante aprova ou rejeita a resolução do chamado.',
    default_subject: 'Chamado Aprovado/Rejeitado pelo Solicitante',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 12px 0; }</style></head>
<body>
  <p>O chamado foi <strong>{{approval_action}}</strong> pelo solicitante.</p>
  <div class="box">
    <p><strong>{{ticket.subject}}</strong></p>
    <p>Status: {{approval_status}}</p>
  </div>
  <p>Acesse o sistema para mais detalhes.</p>
</body>
</html>`,
    placeholders: ['{{ticket.subject}}', '{{approval_action}}', '{{approval_status}}'],
  },
  {
    key: 'client_registration_created',
    label: 'Novo cadastro de cliente',
    description: 'Enviado aos administradores e ao usuário que enviou o cadastro.',
    default_subject: 'Novo Cadastro de Cliente / Cadastro Enviado',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #d1e7dd; padding: 16px; border-radius: 8px; margin: 12px 0; }</style></head>
<body>
  <p>{{registration_message}}</p>
  <p>Um novo cadastro de cliente foi enviado e está aguardando análise.</p>
  <p>Acesse o sistema para visualizar.</p>
</body>
</html>`,
    placeholders: ['{{registration_message}}'],
  },
  {
    key: 'client_registration_status_change',
    label: 'Status do cadastro de cliente alterado',
    description: 'Enviado ao usuário quando o status do cadastro de cliente é alterado. Use as variáveis inteligentes para título, mensagem e cores conforme o status (aprovado, em análise, reprovado, bloqueado).',
    default_subject: 'Status do Cadastro Alterado',
    default_body_html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body { ${defaultHtmlStyle} } .box { background: #e7f3ff; padding: 16px; border-radius: 8px; margin: 12px 0; }</style></head>
<body>
  <p>O status do seu cadastro de cliente foi alterado.</p>
  <div class="box">
    <p><span class="label">Status anterior:</span> {{old_status}}</p>
    <p><span class="label">Novo status:</span> {{new_status}}</p>
  </div>
  <p>Acesse o sistema para mais detalhes.</p>
</body>
</html>`,
    placeholders: [
      '{{status_title}}',
      '{{status_message}}',
      '{{status_color}}',
      '{{status_badge_bg}}',
      '{{status_badge_text}}',
      '{{old_status}}',
      '{{new_status}}',
      '{{client.url}}',
      '{{current_year}}',
    ],
  },
];

const definitionsByKey = new Map<NotificationTemplateKey, NotificationTemplateDefinition>(
  NOTIFICATION_TEMPLATE_DEFINITIONS.map((d) => [d.key, d])
);

export function getNotificationTemplateDefinition(key: NotificationTemplateKey): NotificationTemplateDefinition | undefined {
  return definitionsByKey.get(key);
}

export function getAllNotificationTemplateKeys(): NotificationTemplateKey[] {
  return NOTIFICATION_TEMPLATE_DEFINITIONS.map((d) => d.key);
}
