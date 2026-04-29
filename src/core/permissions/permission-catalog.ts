export interface PermissionCatalogEntry {
  name: string;
  code: string;
  module: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  { name: 'Visualizar Dashboard', code: 'dashboard.view', module: 'administration', description: 'Permite acessar o dashboard principal.' },
  { name: 'Visualizar Chamados', code: 'tickets.view', module: 'tickets', description: 'Permite visualizar chamados.' },
  { name: 'Criar Chamados', code: 'tickets.create', module: 'tickets', description: 'Permite criar chamados.' },
  { name: 'Editar Chamados', code: 'tickets.edit', module: 'tickets', description: 'Permite editar chamados.' },
  { name: 'Atribuir Chamados', code: 'tickets.assign', module: 'tickets', description: 'Permite atribuir chamados.' },
  { name: 'Visualizar Cadastros', code: 'registrations.view', module: 'registrations', description: 'Permite visualizar cadastros.' },
  { name: 'Criar Cadastros', code: 'registrations.create', module: 'registrations', description: 'Permite criar cadastros.' },
  { name: 'Editar Cadastros', code: 'registrations.edit', module: 'registrations', description: 'Permite editar cadastros.' },
  { name: 'Visualizar Configurações de Cadastros', code: 'registrations.config.view', module: 'registrations', description: 'Permite visualizar configurações do módulo de cadastros.' },
  { name: 'Gerenciar Configurações de Cadastros', code: 'registrations.config.manage', module: 'registrations', description: 'Permite gerenciar configurações do módulo de cadastros.' },
  { name: 'Visualizar Análise de Crédito', code: 'registrations.analise_credito.view', module: 'registrations', description: 'Permite visualizar análise de crédito.' },
  { name: 'Visualizar Compras', code: 'compras.modulo.view', module: 'compras', description: 'Permite visualizar o módulo de compras no menu.' },
  { name: 'Visualizar Solicitações de Compra', code: 'compras.solicitacoes.view', module: 'compras', description: 'Permite visualizar solicitações de compra.' },
  { name: 'Criar Solicitações de Compra', code: 'compras.solicitacoes.create', module: 'compras', description: 'Permite criar solicitações de compra.' },
  { name: 'Editar Solicitações de Compra', code: 'compras.solicitacoes.edit', module: 'compras', description: 'Permite editar solicitações de compra.' },
  { name: 'Visualizar Orçamentos', code: 'compras.orcamentos.view', module: 'compras', description: 'Permite visualizar orçamentos.' },
  { name: 'Criar Orçamentos', code: 'compras.orcamentos.create', module: 'compras', description: 'Permite criar orçamentos.' },
  { name: 'Editar Orçamentos', code: 'compras.orcamentos.edit', module: 'compras', description: 'Permite editar orçamentos.' },
  { name: 'Visualizar Descarregamento', code: 'descarregamento.modulo.view', module: 'descarregamento', description: 'Permite visualizar o módulo de descarregamento no menu.' },
  { name: 'Visualizar Agendamentos', code: 'descarregamento.agendamentos.view', module: 'descarregamento', description: 'Permite visualizar agendamentos.' },
  { name: 'Criar Agendamentos', code: 'descarregamento.agendamentos.create', module: 'descarregamento', description: 'Permite criar agendamentos.' },
  { name: 'Editar Agendamentos', code: 'descarregamento.agendamentos.edit', module: 'descarregamento', description: 'Permite editar agendamentos.' },
  { name: 'Visualizar Grade de Descarregamento', code: 'descarregamento.grade.view', module: 'descarregamento', description: 'Permite visualizar a grade de descarregamento.' },
  { name: 'Visualizar Fornecedores', code: 'descarregamento.fornecedores.view', module: 'descarregamento', description: 'Permite visualizar fornecedores.' },
  { name: 'Criar Fornecedores', code: 'descarregamento.fornecedores.create', module: 'descarregamento', description: 'Permite criar fornecedores.' },
  { name: 'Editar Fornecedores', code: 'descarregamento.fornecedores.edit', module: 'descarregamento', description: 'Permite editar fornecedores.' },
  { name: 'Visualizar Docas', code: 'descarregamento.docas.view', module: 'descarregamento', description: 'Permite visualizar docas.' },
  { name: 'Gerenciar Docas', code: 'descarregamento.docas.manage', module: 'descarregamento', description: 'Permite gerenciar docas.' },
  { name: 'Visualizar Motoristas no Pátio', code: 'descarregamento.motoristas.view', module: 'descarregamento', description: 'Permite visualizar motoristas no pátio.' },
  { name: 'Liberar Motoristas', code: 'descarregamento.motoristas.liberar', module: 'descarregamento', description: 'Permite liberar motorista para descarga/saída.' },
  { name: 'Visualizar Histórico de Descarregamento', code: 'descarregamento.historico.view', module: 'descarregamento', description: 'Permite visualizar histórico de descarregamento.' },
  { name: 'Visualizar Usuários', code: 'users.view', module: 'administration', description: 'Permite visualizar usuários.' },
  { name: 'Criar Usuários', code: 'users.create', module: 'administration', description: 'Permite criar usuários.' },
  { name: 'Editar Usuários', code: 'users.edit', module: 'administration', description: 'Permite editar usuários.' },
  { name: 'Excluir Usuários', code: 'users.delete', module: 'administration', description: 'Permite excluir usuários.' },
  { name: 'Gerenciar Permissões', code: 'permissions.manage', module: 'administration', description: 'Permite gerenciar permissões.' },
  { name: 'Gerenciar Perfis de Acesso', code: 'profiles.manage', module: 'administration', description: 'Permite criar e editar perfis de acesso.' },
  { name: 'Atribuir Perfis de Acesso', code: 'profiles.assign', module: 'administration', description: 'Permite atribuir perfis para usuários.' },
  { name: 'Visualizar Auditoria', code: 'system.audit.view', module: 'administration', description: 'Permite visualizar logs de auditoria.' }
];

export const PERMISSION_ALIAS: Record<string, string> = {
  'descarregamento.form_responses.release': 'descarregamento.motoristas.liberar',
  'descarregamento.formularios.view_responses': 'descarregamento.historico.view',
  'descarregamento.formularios.manage': 'descarregamento.agendamentos.edit'
};

