// ============================================================
// CRM Vittus — TypeScript Type Definitions
// ============================================================

// ---- Database Row Types ----

export type UserRole = 'admin' | 'gestor' | 'vendedor' | 'consultor';

export interface Profile {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  role: UserRole;
  avatar_url: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type LeadStatus =
  | 'novo'
  | 'qualificado'
  | 'agendado'
  | 'em_reuniao'
  | 'proposta'
  | 'fechado'
  | 'perdido';

export type LeadOrigem =
  | 'quiz-instagram'
  | 'site'
  | 'manual'
  | 'indicacao'
  | 'google'
  | 'outro';

export interface Lead {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  origem: LeadOrigem;
  status: LeadStatus;
  responsavel_id?: string | null;
  respostas_quiz?: QuizAnswer[] | null;
  empresa?: string | null;
  segmento?: string | null;
  notas?: string | null;
  valor_estimado?: number | null;
  motivo_perda?: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  responsavel?: Profile;
  bookings?: Booking[];
  activities?: Activity[];
}

export interface QuizAnswer {
  pergunta: string;
  resposta: string;
}

export type BookingStatus = 'confirmado' | 'realizado' | 'cancelado' | 'remarcado';
export type BookingTipo = 'diagnostico' | 'proposta' | 'followup' | 'google_event';

export interface Booking {
  id: string;
  lead_id?: string;
  consultor_id: string;
  data: string; // YYYY-MM-DD
  horario_inicio: string; // HH:MM
  horario_fim: string; // HH:MM
  status: BookingStatus;
  tipo: BookingTipo;
  notas?: string;
  zoom_link?: string;
  created_at?: string;
  updated_at?: string;
  title?: string;
  isGoogleCalendar?: boolean;
  // Joined fields
  lead?: Lead;
  consultor?: Profile;
}

export interface Task {
  id: string;
  lead_id?: string | null;
  responsavel_id?: string | null;
  data: string; // YYYY-MM-DD
  titulo: string;
  descricao?: string | null;
  status: 'pendente' | 'concluida';
  created_at?: string;
  updated_at?: string;
  // Joined fields
  lead?: Lead;
  responsavel?: Profile;
}

export interface ScheduleConfig {
  id: string;
  user_id: string;
  dia_semana: number; // 0=Dom, 1=Seg, ..., 6=Sab
  hora_inicio: string; // HH:MM
  hora_fim: string; // HH:MM
  ativo: boolean;
}

export type SaleStatus = 'proposta' | 'negociacao' | 'fechado' | 'cancelado';

export interface Sale {
  id: string;
  lead_id: string | null;
  vendedor_id: string | null;
  servico_id: string | null;
  servico_nome: string | null;
  valor: number;
  parcelas: number;
  status: SaleStatus;
  data_fechamento: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  lead?: Lead;
  vendedor?: Profile;
  servico?: Service;
}

export type GoalTipo = 'vendas' | 'faturamento' | 'leads_convertidos';
export type GoalPeriodo = 'semanal' | 'mensal' | 'trimestral';

export interface Goal {
  id: string;
  user_id: string | null; // null = meta coletiva
  tipo: GoalTipo;
  meta_valor: number;
  valor_atual: number;
  periodo: GoalPeriodo;
  data_inicio: string;
  data_fim: string;
  created_at: string;
  // Joined
  user?: Profile;
}

export interface Service {
  id: string;
  nome: string;
  descricao: string | null;
  valor_base: number | null;
  ativo: boolean;
  created_at: string;
}

export type ActivityTipo = 'nota' | 'ligacao' | 'email' | 'whatsapp' | 'reuniao' | 'status_change';

export interface Activity {
  id: string;
  lead_id: string;
  user_id: string | null;
  tipo: ActivityTipo;
  descricao: string;
  created_at: string;
  // Joined
  user?: Profile;
}

// ---- API Types ----

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateLeadPayload {
  nome: string;
  email?: string;
  telefone?: string;
  origem?: LeadOrigem;
  respostas_quiz?: QuizAnswer[];
  empresa?: string;
  segmento?: string;
}

export interface CreateBookingPayload {
  lead_id?: string;
  nome?: string;
  email?: string;
  telefone?: string;
  origem?: LeadOrigem;
  data: string; // YYYY-MM-DD
  horario: string; // HH:MM
  consultor_id?: string;
  tipo?: BookingTipo;
  notas?: string;
}

export interface SlotsResponse {
  date: string;
  slots: string[]; // Array of HH:MM times
  timezone: string;
}

// ---- UI Types ----

export interface KanbanColumn {
  id: LeadStatus;
  title: string;
  color: string;
  leads: Lead[];
}

export interface DashboardKPIs {
  leadsHoje: number;
  leadsSemana: number;
  leadsMes: number;
  agendamentosHoje: number;
  agendamentosSemana: number;
  taxaConversao: number;
  faturamentoMes: number;
  faturamentoMesAnterior: number;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

export type CalendarView = 'month' | 'week' | 'day';
