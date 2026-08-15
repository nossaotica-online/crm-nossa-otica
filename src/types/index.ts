// ============================================================
// CRM Vittus — TypeScript Type Definitions
// ============================================================

// ---- Database Row Types ----

// Desde a migration 030 o acesso é marcado tela a tela em `permissoes`, e o
// cargo virou só o interruptor mestre: 'admin' pode tudo, o resto ('funcionario'
// nos acessos novos) depende da marcação. Os cargos antigos continuam válidos
// para quem foi criado antes — a 030 converteu cada um na marcação equivalente.
export type UserRole = 'admin' | 'gestor' | 'vendedor' | 'consultor' | 'funcionario';

export interface Profile {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string | null;
  role: UserRole;
  permissoes?: string[];
  pode_excluir?: boolean;
  ve_tudo?: boolean;
  avatar_url: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// O Pipeline de leads era do CRM antigo da agência e foi removido em
// 2026-08-15. As colunas `lead_id` continuam nas tabelas do banco (bookings,
// sales, activities) por causa dos registros antigos, mas nada no app grava
// ou lê lead nenhum.
export type LeadOrigem =
  | 'quiz-instagram'
  | 'site'
  | 'manual'
  | 'indicacao'
  | 'google'
  | 'outro';

export type BookingStatus = 'confirmado' | 'realizado' | 'cancelado' | 'remarcado';
export type BookingTipo = 'diagnostico' | 'proposta' | 'followup' | 'google_event';

export interface Booking {
  id: string;
  lead_id?: string;
  client_id?: string | null;
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
  consultor?: Profile;
}

export interface Task {
  id: string;
  lead_id?: string | null;
  client_id?: string | null;
  responsavel_id?: string | null;
  data: string; // YYYY-MM-DD
  titulo: string;
  descricao?: string | null;
  status: 'pendente' | 'concluida';
  created_at?: string;
  updated_at?: string;
  // Joined fields
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
  client_id?: string | null;
  service_order_id?: string | null;
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
