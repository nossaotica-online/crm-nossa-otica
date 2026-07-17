import { type LeadStatus, type LeadOrigem, type NavItem } from '@/types';

// ---- Lead Status Configuration ----

export const LEAD_STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; bgColor: string }
> = {
  novo: { label: 'Novo cliente', color: '#94a3b8', bgColor: 'rgba(148, 163, 184, 0.14)' },
  qualificado: { label: 'Contato feito', color: '#38bdf8', bgColor: 'rgba(56, 189, 248, 0.14)' },
  agendado: { label: 'Exame agendado', color: '#a78bfa', bgColor: 'rgba(167, 139, 250, 0.14)' },
  em_reuniao: { label: 'Atendimento', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.14)' },
  proposta: { label: 'Orçamento', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.14)' },
  fechado: { label: 'Venda concluída', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.14)' },
  perdido: { label: 'Não avançou', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.14)' },
};

export const LEAD_ORIGEM_LABELS: Record<LeadOrigem, string> = {
  'quiz-instagram': 'Quiz Instagram',
  site: 'Site Institucional',
  manual: 'Manual',
  indicacao: 'Indicação',
  google: 'Google',
  outro: 'Outro',
};

export const KANBAN_COLUMN_ORDER: LeadStatus[] = [
  'novo',
  'qualificado',
  'agendado',
  'em_reuniao',
  'proposta',
  'fechado',
  'perdido',
];

// ---- Navigation ----

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard' },
  { label: 'Clientes', href: '/clientes', icon: 'leads' },
  { label: 'Ordem de Serviço', href: '/ordens', icon: 'os' },
  { label: 'Calendário', href: '/calendario', icon: 'calendar' },
  { label: 'Equipe', href: '/equipe', icon: 'team' },
  { label: 'Vendas', href: '/vendas', icon: 'sales' },
  { label: 'Metas', href: '/metas', icon: 'goals' },
  { label: 'Configurações', href: '/configuracoes', icon: 'settings' },
];

// ---- Schedule Defaults ----

export const DEFAULT_MEETING_DURATION = 30; // minutes
export const DEFAULT_BUFFER_BETWEEN_MEETINGS = 15; // minutes
export const DEFAULT_MAX_MEETINGS_PER_DAY = 8;

export const DEFAULT_WORK_HOURS = {
  start: '09:00',
  end: '18:00',
};

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5]; // Mon-Fri

// ---- Date/Time Formatting ----

export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const MONTH_LABELS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
