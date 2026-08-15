import { type NavItem } from '@/types';

// ---- Navigation ----

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard' },
  { label: 'Clientes', href: '/clientes', icon: 'leads' },
  { label: 'Ordem de Serviço', href: '/ordens', icon: 'os' },
  { label: 'Calendário', href: '/calendario', icon: 'calendar' },
  { label: 'Equipe', href: '/equipe', icon: 'team' },
  { label: 'Orçamentos', href: '/vendas', icon: 'sales' },
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
