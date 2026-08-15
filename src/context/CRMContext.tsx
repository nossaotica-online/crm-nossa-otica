'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Booking, Sale, Goal, Profile, Task } from '@/types';
import { ClientRecord } from '@/types/clients';
import { createClient } from '@/lib/supabase/client';
import { getTodayISO } from '@/lib/utils';
import { sanitizeOptionalText, sanitizePlainText } from '@/lib/security';
import { teamMemberErrorMessage } from '@/lib/team-errors';
import type { PermissionKey } from '@/lib/permissions';

/** O que a administradora marcou na lista de acessos (migration 030). */
export interface TeamMemberPermissions {
  permissoes: PermissionKey[];
  podeExcluir: boolean;
  veTudo: boolean;
  admin: boolean;
}

export interface NewTeamMember extends TeamMemberPermissions {
  email: string;
  pass: string;
  nome: string;
  cargo: string;
}

interface CRMContextType {
  clients: ClientRecord[];
  bookings: Booking[];
  sales: Sale[];
  goals: Goal[];
  team: Profile[];
  addBooking: (booking: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; error?: string }>;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => void;
  deleteBooking: (bookingId: string) => Promise<boolean>;
  addTeamMember: (memberData: NewTeamMember) => Promise<{ success: boolean; error?: string }>;
  updateTeamMemberPermissions: (memberId: string, permissions: TeamMemberPermissions) => Promise<{ success: boolean; error?: string }>;
  addSale: (sale: Omit<Sale, 'id' | 'created_at' | 'updated_at'>) => void;
  updateGoalProgress: (goalId: string, value: number) => void;
  addGoal: (goal: Omit<Goal, 'id' | 'created_at'>) => void;
  updateGoalTarget: (goalId: string, targetValue: number) => void;
  deleteGoal: (goalId: string) => void;
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; error?: string }>;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;
  deleteTask: (taskId: string) => Promise<boolean>;
  toggleTeamMemberActive: (memberId: string, currentStatus: boolean) => Promise<boolean>;
  loading: boolean;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<ClientRecord[]>([]);
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
    const [teamRes, bookingsRes, salesRes, goalsRes, tasksRes, clientsRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('bookings').select('*').order('data', { ascending: true }),
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('goals').select('*'),
      supabase.from('tasks').select('*').order('data', { ascending: true }),
      supabase.from('clients').select('*').order('name', { ascending: true }),
    ]);

    if (clientsRes.data) setClients(clientsRes.data as ClientRecord[]);
    if (teamRes.data) setTeam(teamRes.data as Profile[]);
    if (salesRes.data) setSales(salesRes.data as Sale[]);
    if (goalsRes.data) setGoals(goalsRes.data as Goal[]);
    
    if (bookingsRes.data) setBookings(bookingsRes.data as Booking[]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    
    if (!silent) setLoading(false);
  };

  const reloadChangedTable = async (
    table: 'bookings' | 'sales' | 'goals' | 'tasks' | 'clients',
  ) => {
    if (table === 'bookings') {
      const { data } = await supabase.from('bookings').select('*').order('data', { ascending: true });
      if (data) setBookings(data as Booking[]);
    } else if (table === 'sales') {
      const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
      if (data) setSales(data as Sale[]);
    } else if (table === 'goals') {
      const { data } = await supabase.from('goals').select('*');
      if (data) setGoals(data as Goal[]);
    } else if (table === 'tasks') {
      const { data } = await supabase.from('tasks').select('*').order('data', { ascending: true });
      if (data) setTasks(data as Task[]);
    } else {
      const { data } = await supabase.from('clients').select('*').order('name', { ascending: true });
      if (data) setClients(data as ClientRecord[]);
    }
  };

  useEffect(() => {
    loadData();

    // Set up realtime subscriptions
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => void reloadChangedTable('bookings'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => void reloadChangedTable('sales'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => void reloadChangedTable('goals'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => void reloadChangedTable('tasks'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => void reloadChangedTable('clients'))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const addBooking = async (bookingData: Omit<Booking, 'id' | 'created_at' | 'updated_at'>) => {
    const safeBookingData = {
      ...bookingData,
      zoom_link: sanitizeOptionalText(bookingData.zoom_link, 2048),
      notas: sanitizeOptionalText(bookingData.notas, 5000),
    };
    const { data, error } = await supabase.from('bookings').insert([safeBookingData]).select();
    if (data && data.length > 0) {
      setBookings(prev => [...prev, data[0] as Booking]);
      return { success: true };
    } else if (error) {
      console.error('Erro ao adicionar booking:', error);
      return { success: false, error: 'Não foi possível salvar o agendamento.' };
    }
    return { success: false, error: 'O agendamento não foi confirmado pelo banco.' };
  };

  const updateBookingStatus = async (bookingId: string, status: Booking['status']) => {
    const { data, error } = await supabase.from('bookings').update({ status }).eq('id', bookingId).select();
    if (data && data.length > 0) {
      const updatedBooking = data[0] as Booking;
      setBookings(prev => prev.map(b => b.id === bookingId ? updatedBooking : b));
    } else if (error) {
      console.error('Erro ao atualizar booking:', error);
    }
  };

  const addSale = async (saleData: Omit<Sale, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: authData } = await supabase.auth.getUser();
    const safeSaleData = {
      ...saleData,
      vendedor_id: saleData.vendedor_id || authData.user?.id || null,
      servico_nome: sanitizeOptionalText(saleData.servico_nome, 200),
      notas: sanitizeOptionalText(saleData.notas, 5000),
    };
    const { data, error } = await supabase.from('sales').insert([safeSaleData]).select();
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

  const addTeamMember = async (memberData: NewTeamMember): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('create_team_member', {
        p_email: memberData.email,
        p_password: memberData.pass,
        p_nome: memberData.nome,
        p_cargo: memberData.cargo,
        p_permissoes: memberData.permissoes,
        p_pode_excluir: memberData.podeExcluir,
        p_ve_tudo: memberData.veTudo,
        p_admin: memberData.admin,
      });

      if (error) {
        // O motivo real vem do banco (senha curta, migration faltando...).
        return { success: false, error: teamMemberErrorMessage(error) };
      }

      if (data && data.success === false) {
        return { success: false, error: data.error };
      }

      // Reload team data
      const { data: teamRes } = await supabase.from('profiles').select('*');
      if (teamRes) setTeam(teamRes as Profile[]);

      return { success: true };
    } catch (err) {
      console.error('Erro ao adicionar membro da equipe:', err);
      return { success: false, error: 'Não foi possível criar o membro da equipe.' };
    }
  };

  const updateTeamMemberPermissions = async (
    memberId: string,
    permissions: TeamMemberPermissions,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.rpc('atualizar_permissoes', {
        p_user_id: memberId,
        p_permissoes: permissions.permissoes,
        p_pode_excluir: permissions.podeExcluir,
        p_ve_tudo: permissions.veTudo,
        p_admin: permissions.admin,
      });

      if (error) return { success: false, error: teamMemberErrorMessage(error) };
      if (data && data.success === false) return { success: false, error: data.error };

      const { data: teamRes } = await supabase.from('profiles').select('*');
      if (teamRes) setTeam(teamRes as Profile[]);

      return { success: true };
    } catch (err) {
      console.error('Erro ao salvar permissões:', err);
      return { success: false, error: 'Não foi possível salvar as permissões.' };
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
    const safeTaskData = {
      ...taskData,
      titulo: sanitizePlainText(taskData.titulo, 200).trim(),
      descricao: sanitizeOptionalText(taskData.descricao, 5000),
    };
    const { data, error } = await supabase.from('tasks').insert([safeTaskData]).select();
    if (data && data.length > 0) {
      setTasks(prev => [...prev, data[0] as Task]);
      return { success: true };
    } else if (error) {
      console.error('Erro ao adicionar tarefa:', error);
      return { success: false, error: 'Não foi possível salvar a tarefa.' };
    }
    return { success: false, error: 'A tarefa não foi confirmada pelo banco.' };
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

  return (
    <CRMContext.Provider
      value={{
        clients,
        bookings,
        tasks,
        sales,
        goals,
        team,
        addBooking,
        updateBookingStatus,
        deleteBooking,
        addTask,
        updateTaskStatus,
        deleteTask,
        addTeamMember,
        updateTeamMemberPermissions,
        toggleTeamMemberActive,
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
