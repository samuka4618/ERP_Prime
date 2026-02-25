/**
 * Configuração dinâmica por tipo de status do cadastro de cliente.
 * Usado no e-mail "Status do Cadastro Alterado" para preencher variáveis
 * status_title, status_message, status_color, status_badge_bg, status_badge_text.
 */

export interface ClientRegistrationStatusTheme {
  status_title: string;
  status_message: string;
  status_color: string;
  status_badge_bg: string;
  status_badge_text: string;
}

const STATUS_THEMES: Record<string, ClientRegistrationStatusTheme> = {
  // Aprovado / Finalizado
  cadastro_finalizado: {
    status_title: 'Cadastro Aprovado',
    status_message: 'Seu cadastro foi analisado e aprovado com sucesso.',
    status_color: '#198754',
    status_badge_bg: '#d1e7dd',
    status_badge_text: '#0f5132',
  },
  // Em análise
  aguardando_analise_credito: {
    status_title: 'Cadastro em Análise',
    status_message: 'Seu cadastro está sendo analisado por nossa equipe.',
    status_color: '#ffc107',
    status_badge_bg: '#fff3cd',
    status_badge_text: '#664d03',
  },
  // Enviado (aguardando)
  cadastro_enviado: {
    status_title: 'Cadastro Enviado',
    status_message: 'Seu cadastro foi recebido e em breve será analisado.',
    status_color: '#0d6efd',
    status_badge_bg: '#cfe2ff',
    status_badge_text: '#084298',
  },
  // Reprovado (para uso futuro, se o schema incluir)
  cadastro_reprovado: {
    status_title: 'Cadastro Não Aprovado',
    status_message: 'Após análise, seu cadastro não foi aprovado. Consulte o sistema para mais detalhes.',
    status_color: '#dc3545',
    status_badge_bg: '#f8d7da',
    status_badge_text: '#842029',
  },
  // Bloqueado / Suspenso (para uso futuro)
  cadastro_bloqueado: {
    status_title: 'Cadastro Bloqueado',
    status_message: 'O cadastro foi temporariamente bloqueado. Acesse o sistema para verificar o motivo.',
    status_color: '#0d6efd',
    status_badge_bg: '#e7f1ff',
    status_badge_text: '#084298',
  },
};

const FALLBACK_THEME: ClientRegistrationStatusTheme = {
  status_title: 'Status do Cadastro Atualizado',
  status_message: 'O status do seu cadastro foi alterado. Acesse o sistema para mais detalhes.',
  status_color: '#6c757d',
  status_badge_bg: '#e9ecef',
  status_badge_text: '#495057',
};

export function getClientRegistrationStatusTheme(newStatus: string): ClientRegistrationStatusTheme {
  return STATUS_THEMES[newStatus] ?? FALLBACK_THEME;
}

const STATUS_LABELS: Record<string, string> = {
  cadastro_enviado: 'Cadastro Enviado',
  aguardando_analise_credito: 'Aguardando Análise de Crédito',
  cadastro_finalizado: 'Cadastro Finalizado',
  cadastro_reprovado: 'Cadastro Não Aprovado',
  cadastro_bloqueado: 'Cadastro Bloqueado',
};

export function getClientRegistrationStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}
