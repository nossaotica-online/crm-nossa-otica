'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Lead, Booking, Sale, Goal, Profile, LeadStatus, LeadOrigem, Task } from '@/types';
import { createClient } from '@/lib/supabase/client';

interface CRMContextType {
  leads: Lead[];
  bookings: Booking[];
  sales: Sale[];
  goals: Goal[];
  team: Profile[];
  addLead: (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => void;
  updateLeadStatus: (leadId: string, status: LeadStatus, vendedor_id?: string) => void;
  addBooking: (booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) => void;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => void;
  deleteBooking: (bookingId: string) => Promise<boolean>;
  addTeamMember: (memberData: { email: string; pass: string; nome: string; cargo: string; role: string }) => Promise<{ success: boolean; error?: string }>;
  addSale: (sale: Omit<Sale, 'id' | 'created_at' | 'updated_at'>) => void;
  updateGoalProgress: (goalId: string, value: number) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'created_at'>) => void;
  updateGoalTarget: (goalId: string, targetValue: number) => void;
  deleteGoal: (goalId: string) => void;
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  deleteTask: (taskId: string) => Promise<boolean>;
  toggleTeamMemberActive: (memberId: string, currentStatus: boolean) => Promise<boolean>;
  deleteTeamMember: (memberId: string) => Promise<boolean>;
  loading: boolean;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    
    // Buscar dados reais do Supabase
    const [leadsRes, teamRes, bookingsRes, salesRes, goalsRes, tasksRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
      supabase.from('bookings').select('*').order('data', { ascending: true }),
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('goals').select('*'),
      supabase.from('tasks').select('*').order('data', { ascending: true }),
    ]);

    if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
    if (teamRes.data) setTeam(teamRes.data as Profile[]);
    if (salesRes.data) setSales(salesRes.data as Sale[]);
    if (goalsRes.data) setGoals(goalsRes.data as Goal[]);
    
    if (bookingsRes.data) setBookings(bookingsRes.data as Booking[]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData();

    // Set up realtime subscriptions
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => loadData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addLead = async (leadData: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('leads').insert([leadData]).select();
    if (data && data.length > 0) {
      setLeads(prev => [data[0] as Lead, ...prev]);
    } else if (error) {
      console.error('Erro ao adicionar lead:', error);
    }
  };

  const updateLeadStatus = async (leadId: string, status: LeadStatus, vendedor_id?: string) => {
    const { data, error } = await supabase.from('leads').update({ status }).eq('id', leadId).select();
    if (data && data.length > 0) {
      const updatedLead = data[0] as Lead;
      setLeads(prev => prev.map(l => l.id === leadId ? updatedLead : l));
      
      // Auto-gerar venda
      if (status === 'fechado') {
        setSales(prevSales => {
          const existingSale = prevSales.find((s) => s.lead_id === leadId);
          if (!existingSale) {
            setLeads(prevLeads => {
              const lead = prevLeads.find((l) => l.id === leadId);
              addSale({
                lead_id: leadId,
                vendedor_id: vendedor_id || lead?.responsavel_id || '00000000-0000-0000-0000-000000000002',
                servico_id: 'serv-generic',
                servico_nome: lead?.segmento === 'E-commerce / Varejo' ? 'Assessoria de Tráfego Pago' : 'Estruturação Comercial (CRM/Processos)',
                valor: lead?.valor_estimado || 4000,
                parcelas: 1,
                status: 'fechado',
                data_fechamento: new Date().toISOString().split('T')[0],
                notas: `Faturamento automático após lead ser marcado como ganho/fechado no pipeline.`
              });
              return prevLeads;
            });
          }
          return prevSales;
        });
      }
    } else if (error) {
      console.error('Erro ao atualizar lead:', error);
    }
  };

  const addBooking = async (bookingData: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('bookings').insert([bookingData]).select();
    if (data && data.length > 0) {
      setBookings(prev => [...prev, data[0] as Booking]);
      if (bookingData.lead_id) {
        updateLeadStatus(bookingData.lead_id, 'agendado');
      }
    } else if (error) {
      console.error('Erro ao adicionar booking:', error);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: Booking['status']) => {
    const { data, error } = await supabase.from('bookings').update({ status }).eq('id', bookingId).select();
    if (data && data.length > 0) {
      const updatedBooking = data[0] as Booking;
      setBookings(prev => prev.map(b => b.id === bookingId ? updatedBooking : b));
      if (status === 'realizado' && updatedBooking.lead_id) {
        updateLeadStatus(updatedBooking.lead_id, 'em_reuniao');
      }
    } else if (error) {
      console.error('Erro ao atualizar booking:', error);
    }
  };

  const addSale = async (saleData: Omit<Sale, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('sales').insert([saleData]).select();
    if (data && data.length > 0) {
      const newSale = data[0] as Sale;
      setSales(prev => [newSale, ...prev]);
      
      if (newSale.status === 'fechado') {
        setGoals(prevGoals => {
          const faturamentoGoal = prevGoals.find((g) => g.tipo === 'faturamento');
          if (faturamentoGoal) {
            updateGoalProgress(faturamentoGoal.id, faturamentoGoal.valor_atual + newSale.valor);
          }
          const leadsGoal = prevGoals.find((g) => g.tipo === 'leads_convertidos');
          if (leadsGoal) {
            updateGoalProgress(leadsGoal.id, leadsGoal.valor_atual + 1);
          }
          return prevGoals;
        });
      }
    } else if (error) {
      console.error('Erro ao adicionar venda:', error);
    }
  };

  const updateGoalProgress = async (goalId: string, value: number) => {
    const { data, error } = await supabase.from('goals').update({ valor_atual: value }).eq('id', goalId).select();
    if (data && data.length > 0) {
      setGoals(prev => prev.map(g => g.id === goalId ? data[0] as Goal : g));
    } else if (error) {
      console.error('Erro ao atualizar meta:', error);
    }
  };

  const addGoal = async (goalData: Omit<Goal, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('goals').insert([goalData]).select();
    if (data && data.length > 0) {
      setGoals(prev => [...prev, data[0] as Goal]);
    } else if (error) {
      console.error('Erro ao adicionar meta:', error);
    }
  };

  const updateGoalTarget = async (goalId: string, targetValue: number) => {
    const { data, error } = await supabase.from('goals').update({ meta_valor: targetValue }).eq('id', goalId).select();
    if (data && data.length > 0) {
      setGoals(prev => prev.map(g => g.id === goalId ? data[0] as Goal : g));
    } else if (error) {
      console.error('Erro ao atualizar valor da meta:', error);
    }
  };

  const deleteBooking = async (bookingId: string): Promise<boolean> => {
    const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
    if (!error) {
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      return true;
    } else {
      console.error('Erro ao deletar booking:', error);
      return false;
    }
  };

  const addTeamMember = async (memberData: { email: string; pass: string; nome: string; cargo: string; role: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('create_team_member', {
        p_email: memberData.email,
        p_password: memberData.pass,
        p_nome: memberData.nome,
        p_cargo: memberData.cargo,
        p_role: memberData.role
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data && data.success === false) {
        return { success: false, error: data.error };
      }

      // Reload team data
      const { data: teamRes } = await supabase.from('profiles').select('*');
      if (teamRes) setTeam(teamRes as Profile[]);

      return { success: true };
    } catch (err: any) {
      console.error('Erro ao adicionar membro da equipe:', err);
      return { success: false, error: err.message || 'Erro desconhecido' };
    }
  };

  const deleteGoal = async (goalId: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', goalId);
    if (!error) {
      setGoals(prev => prev.filter(g => g.id !== goalId));
    } else if (error) {
      console.error('Erro ao deletar meta:', error);
    }
  };

  const addTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase.from('tasks').insert([taskData]).select();
    if (data && data.length > 0) {
      setTasks(prev => [...prev, data[0] as Task]);
    } else if (error) {
      console.error('Erro ao adicionar tarefa:', error);
    }
  };

  const updateTaskStatus = async (taskId: string, status: Task['status']) => {
    const { data, error } = await supabase.from('tasks').update({ status }).eq('id', taskId).select();
    if (data && data.length > 0) {
      setTasks(prev => prev.map(t => t.id === taskId ? data[0] as Task : t));
    } else if (error) {
      console.error('Erro ao atualizar status da tarefa:', error);
    }
  };

  const deleteTask = async (taskId: string): Promise<boolean> => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      return true;
    } else {
      console.error('Erro ao deletar tarefa:', error);
      return false;
    }
  };

  const toggleTeamMemberActive = async (memberId: string, currentStatus: boolean): Promise<boolean> => {
    const { data, error } = await supabase.from('profiles').update({ ativo: !currentStatus }).eq('id', memberId).select();
    if (data && data.length > 0) {
      setTeam(prev => prev.map(m => m.id === memberId ? (data[0] as Profile) : m));
      return true;
    } else {
      console.error('Erro ao atualizar status do colaborador:', error);
      return false;
    }
  };

  const deleteTeamMember = async (memberId: string): Promise<boolean> => {
    const { error } = await supabase.from('profiles').delete().eq('id', memberId);
    if (!error) {
      setTeam(prev => prev.filter(m => m.id !== memberId));
      return true;
    } else {
      console.error('Erro ao deletar colaborador:', error);
      return false;
    }
  };

  return (
    <CRMContext.Provider
      value={{
        leads,
        bookings,
        tasks,
        sales,
        goals,
        team,
        addLead,
        updateLeadStatus,
        addBooking,
        updateBookingStatus,
        deleteBooking,
        addTask,
        updateTaskStatus,
        deleteTask,
        addTeamMember,
        toggleTeamMemberActive,
        deleteTeamMember,
        addSale,
        updateGoalProgress,
        addGoal,
        updateGoalTarget,
        deleteGoal,
        loading
      }}
    >
      {children}
    </CRMContext.Provider>
  );
};

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};
