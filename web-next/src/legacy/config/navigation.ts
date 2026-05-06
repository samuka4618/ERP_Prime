import type { LucideIcon } from 'lucide-react';
import {
  Ticket,
  Users,
  Settings,
  BarChart3,
  Building2,
  LayoutDashboard,
  FolderOpen,
  UserCheck,
  Shield,
  ShieldCheck,
  Tag,
  List,
  FileText,
  ShoppingCart,
  CheckCircle,
  Package,
  ClipboardList,
  ShoppingBag,
  Truck,
  Calendar,
  Warehouse,
  Database,
  History,
  LayoutGrid,
} from 'lucide-react';

export type NavItem = {
  id: string;
  name: string;
  href?: string;
  icon: LucideIcon;
  badge?: string | number;
  adminOnly?: boolean;
  /** Basta uma destas permissões (módulo). */
  permissionAny?: string[];
  permissionAll?: string[];
  items?: NavItem[];
};

export type NavSection = {
  id: string;
  name: string;
  icon: LucideIcon;
  items: NavItem[];
  adminOnly?: boolean;
  collapsible?: boolean;
};

const iamV2Enabled = String(process.env.NEXT_PUBLIC_FEATURE_IAM_V2 ?? 'true') !== 'false';

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      {
        id: 'nav-dashboard-overview',
        name: 'Visão Geral',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
    collapsible: false,
  },
  {
    id: 'modules',
    name: 'Módulos',
    icon: FolderOpen,
    items: [
      {
        id: 'nav-tickets',
        name: 'Chamados',
        href: '/tickets',
        icon: Ticket,
        permissionAny: ['tickets.view'],
      },
      {
        id: 'nav-registrations',
        name: 'Cadastros',
        href: '/client-registrations',
        icon: Building2,
        permissionAny: ['registrations.view'],
      },
      {
        id: 'nav-compras-group',
        name: 'Compras',
        icon: ShoppingCart,
        permissionAny: [
          'compras.solicitacoes.view',
          'compras.orcamentos.view',
          'compras.acompanhamento.view',
        ],
        items: [
          {
            id: 'nav-compras-solicitacoes',
            name: 'Todas as Solicitações',
            href: '/compras/solicitacoes',
            icon: ClipboardList,
            permissionAny: ['compras.solicitacoes.view'],
          },
          {
            id: 'nav-compras-orcamentos',
            name: 'Orçamentos Recebidos',
            href: '/compras/orcamentos',
            icon: FileText,
            permissionAny: ['compras.orcamentos.view'],
          },
          {
            id: 'nav-compras-minhas',
            name: 'Minhas Solicitações',
            href: '/compras/minhas-solicitacoes',
            icon: Package,
            permissionAny: ['compras.solicitacoes.view', 'compras.acompanhamento.view'],
          },
          {
            id: 'nav-compras-pendentes',
            name: 'Pendentes de Aprovação',
            href: '/compras/pendentes-aprovacao',
            icon: CheckCircle,
            permissionAny: ['compras.solicitacoes.view', 'compras.solicitacoes.approve'],
          },
        ],
      },
      {
        id: 'nav-descarga-group',
        name: 'Descarregamento',
        icon: Truck,
        permissionAny: [
          'descarregamento.agendamentos.view',
          'descarregamento.fornecedores.view',
          'descarregamento.docas.view',
          'descarregamento.motoristas.view',
        ],
        items: [
          {
            id: 'nav-descarga-agendamentos',
            name: 'Agendamentos',
            href: '/descarregamento/agendamentos',
            icon: Calendar,
            permissionAny: ['descarregamento.agendamentos.view'],
          },
          {
            id: 'nav-descarga-grade',
            name: 'Grade',
            href: '/descarregamento/grade',
            icon: Calendar,
            permissionAny: ['descarregamento.grade.view'],
          },
          {
            id: 'nav-descarga-fornecedores',
            name: 'Fornecedores',
            href: '/descarregamento/fornecedores',
            icon: Building2,
            permissionAny: ['descarregamento.fornecedores.view'],
          },
          {
            id: 'nav-descarga-docas',
            name: 'Docas',
            href: '/descarregamento/docas',
            icon: Warehouse,
            permissionAny: ['descarregamento.docas.view', 'descarregamento.docas.manage'],
          },
          {
            id: 'nav-descarga-motoristas',
            name: 'Motoristas no Pátio',
            href: '/descarregamento/motoristas-patio',
            icon: Users,
            permissionAny: ['descarregamento.motoristas.view'],
          },
          {
            id: 'nav-descarga-historico',
            name: 'Histórico',
            href: '/descarregamento/historico',
            icon: History,
            permissionAny: ['descarregamento.historico.view'],
          },
        ],
      },
    ],
    collapsible: true,
  },
  {
    id: 'administration',
    name: 'Administração',
    icon: Shield,
    adminOnly: true,
    items: [
      { id: 'nav-users', name: 'Usuários', href: '/users', icon: Users, permissionAny: ['users.view'] },
      {
        id: 'nav-permissions',
        name: 'Permissões',
        href: '/permissions',
        icon: Shield,
        permissionAny: ['permissions.manage'],
      },
      ...(iamV2Enabled
        ? [{
            id: 'nav-access-profiles',
            name: 'Perfis de Acesso',
            href: '/access-profiles',
            icon: ShieldCheck,
            permissionAny: ['profiles.manage'],
          }]
        : []),
      { id: 'nav-reports', name: 'Relatórios', href: '/reports', icon: BarChart3, permissionAny: ['reports.view'] },
      {
        id: 'nav-audit',
        name: 'Auditoria',
        href: '/audit',
        icon: FileText,
        permissionAny: ['system.audit.view'],
      },
      {
        id: 'nav-sessions',
        name: 'Sessões Ativas',
        href: '/sessions',
        icon: ShieldCheck,
        permissionAny: ['users.view'],
      },
      {
        id: 'nav-backup',
        name: 'Backup e Restore',
        href: '/backup',
        icon: Database,
        permissionAny: ['system.backup.create', 'system.backup.restore', 'system.backup.manage'],
      },
      {
        id: 'nav-settings-group',
        name: 'Configurações',
        icon: Settings,
        items: [
          {
            id: 'nav-system-settings',
            name: 'Configurações Gerais',
            href: '/system-settings',
            icon: Settings,
            permissionAny: ['system.config.manage'],
          },
          {
            id: 'nav-system-modules-config',
            name: 'Módulos e personalização',
            href: '/system-config',
            icon: LayoutGrid,
            permissionAny: ['system.config.manage'],
          },
          {
            id: 'nav-tickets-settings-group',
            name: 'Sistema de Chamados',
            icon: Ticket,
            items: [
              { id: 'nav-categories', name: 'Categorias', href: '/categories', icon: Tag, permissionAny: ['tickets.view'] },
              { id: 'nav-status', name: 'Status', href: '/status', icon: List, permissionAny: ['tickets.view'] },
              {
                id: 'nav-category-assignments',
                name: 'Atribuições',
                href: '/category-assignments',
                icon: UserCheck,
                permissionAny: ['tickets.view'],
              },
            ],
          },
          {
            id: 'nav-registrations-settings-group',
            name: 'Sistema de Cadastros',
            icon: Building2,
            items: [
              {
                id: 'nav-cadastros-config',
                name: 'Configurações',
                href: '/cadastros-config',
                icon: FileText,
                permissionAny: ['registrations.view'],
              },
            ],
          },
          {
            id: 'nav-compras-settings-group',
            name: 'Sistema de Compras',
            icon: ShoppingBag,
            items: [
              {
                id: 'nav-compras-config',
                name: 'Configurações',
                href: '/compras-config',
                icon: Settings,
                permissionAny: ['compras.solicitacoes.view'],
              },
            ],
          },
          {
            id: 'nav-descarga-settings-group',
            name: 'Sistema de Descarregamento',
            icon: Truck,
            items: [
              {
                id: 'nav-descarga-config',
                name: 'Configurações',
                href: '/descarregamento-config',
                icon: Settings,
                permissionAny: ['descarregamento.agendamentos.view'],
              },
            ],
          },
        ],
      },
    ],
    collapsible: true,
  },
];
