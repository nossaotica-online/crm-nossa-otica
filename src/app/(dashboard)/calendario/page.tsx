'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/context/CRMContext';
import { WEEKDAY_SHORT, MONTH_LABELS } from '@/lib/constants';
import { Booking, BookingStatus, BookingTipo, Task } from '@/types';

const formatPhone = (value?: string | null) => {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || '';
};

export default function CalendarPage() {
  const { bookings, clients, team, addBooking, updateBookingStatus, deleteBooking, tasks, addTask, updateTaskStatus, deleteTask } = useCRM();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'calls' | 'tasks'>('calls');
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  // New Booking Form State
  const [newClientId, setNewClientId] = useState('');
  const [newConsultorId, setNewConsultorId] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('10:00');
  const [newType, setNewType] = useState<BookingTipo>('diagnostico');
  const [newZoomLink, setNewZoomLink] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // New Task Form State
  const [newTaskClientId, setNewTaskClientId] = useState('');
  const [newTaskResponsavelId, setNewTaskResponsavelId] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('WhatsApp');
  const [newTaskCustomTitle, setNewTaskCustomTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskDescription, setNewTaskDescription] = useState('');

  // Sync default dates when selectedDate changes
  useEffect(() => {
    setNewDate(selectedDate);
    setNewTaskDate(selectedDate);
  }, [selectedDate]);

  // Calendar navigation state
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-indexed

  // Get active bookings for the selected date
  const selectedDateBookings = bookings.filter(b => b.data === selectedDate);
  const selectedDateTasks = tasks ? tasks.filter(t => t.data === selectedDate) : [];
  const activeClients = clients.filter(c => c.status === 'active');

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId) return;

    // Calculate end time (duration 30 mins)
    const [hours, minutes] = newTime.split(':').map(Number);
    const endMinutes = minutes + 30;
    const endHours = hours + Math.floor(endMinutes / 60);
    const formattedEndMinutes = String(endMinutes % 60).padStart(2, '0');
    const formattedEndHours = String(endHours % 24).padStart(2, '0');
    const newEndTime = `${formattedEndHours}:${formattedEndMinutes}`;

    addBooking({
      client_id: newClientId,
      consultor_id: newConsultorId || (team.length > 0 ? team[0].id : ''),
      data: newDate,
      horario_inicio: newTime,
      horario_fim: newEndTime,
      status: 'confirmado',
      tipo: newType,
      zoom_link: newZoomLink,
      notas: newNotes || 'Reunião agendada pelo painel administrativo.'
    });

    // Reset and Close
    setNewClientId('');
    setNewConsultorId('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewTime('10:00');
    setNewType('diagnostico');
    setNewNotes('');
    setIsNewBookingModalOpen(false);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = newTaskTitle === 'Outro' ? newTaskCustomTitle : newTaskTitle;
    if (!finalTitle.trim()) return;

    addTask({
      client_id: newTaskClientId || null,
      responsavel_id: newTaskResponsavelId || (team.length > 0 ? team[0].id : null),
      data: newTaskDate,
      titulo: finalTitle,
      descricao: newTaskDescription || null,
      status: 'pendente'
    });

    // Reset and Close
    setNewTaskClientId('');
    setNewTaskResponsavelId('');
    setNewTaskTitle('WhatsApp');
    setNewTaskCustomTitle('');
    setNewTaskDescription('');
    setIsNewTaskModalOpen(false);
  };

  if (!isMounted) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Nossa Ótica CRM</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Calendário & Agendamentos</h1>
        </div>
      </div>
    );
  }

  // Helper: Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper: Get first day of month (day of week: 0=Sun, 1=Mon...)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // Build calendar matrix (days array)
  const calendarCells = [];
  // Fill blank padding cells for first week
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(null);
  }
  // Fill days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Nossa Ótica CRM</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Agenda & Diagnósticos</h1>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => {
              setNewTaskDate(selectedDate);
              setIsNewTaskModalOpen(true);
            }}
            className="btn btn-secondary"
            style={{ fontWeight: 700, padding: '10px 20px' }}
          >
            + Nova Tarefa
          </button>
          <button 
            onClick={() => {
              setNewDate(selectedDate);
              setIsNewBookingModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ fontWeight: 700, padding: '10px 20px' }}
          >
            + Novo Agendamento
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '32px', alignItems: 'start' }}>
        
        {/* Left Side: Calendar Month View */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '24px' }}>
          
          {/* Calendar Month Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>
              {MONTH_LABELS[currentMonth]} {currentYear}
            </h3>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => navigateMonth('prev')}
                style={{ 
                  padding: '8px 12px', 
                  background: '#16161d', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '100px',
                  color: 'white'
                }}
              >
                &larr;
              </button>
              <button 
                onClick={() => navigateMonth('next')}
                style={{ 
                  padding: '8px 12px', 
                  background: '#16161d', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: '100px',
                  color: 'white'
                }}
              >
                &rarr;
              </button>
            </div>
          </div>

          {/* Weekday Titles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '12px' }}>
            {WEEKDAY_SHORT.map(w => (
              <div key={w} style={{ padding: '8px 0' }}>{w}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {calendarCells.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} style={{ aspectRatio: '1.2' }}></div>;
              }

              // Build date string YYYY-MM-DD
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = dateStr === selectedDate;
              const dateBookings = bookings.filter(b => b.data === dateStr);
              const hasBookings = dateBookings.length > 0;
              const dateTasks = tasks ? tasks.filter(t => t.data === dateStr) : [];
              const hasTasks = dateTasks.length > 0;
              
              // Check if date is today
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    aspectRatio: '1.2',
                    borderRadius: '12px',
                    background: isSelected ? 'var(--accent-primary)' : isToday ? '#212128' : 'rgba(255,255,255,0.01)',
                    border: isToday ? '1px solid rgba(201, 169, 110, 0.4)' : '1px solid rgba(255,255,255,0.03)',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = isToday ? '#212128' : 'rgba(255,255,255,0.01)';
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: isToday || isSelected ? 700 : 500 }}>
                    {day}
                  </span>
                  
                  {/* Indicator Dots */}
                  <div style={{ display: 'flex', gap: '4px', position: 'absolute', bottom: '6px' }}>
                    {hasBookings && (
                      <span style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: isSelected ? 'white' : 'linear-gradient(135deg, #c9a96e 0%, #00d4ff 100%)'
                      }}></span>
                    )}
                    {hasTasks && (
                      <span style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: isSelected ? 'white' : 'linear-gradient(135deg, #a855f7 0%, #d8b4fe 100%)'
                      }}></span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* Right Side: Booking Panel for Selected Date */}
        <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1.5px' }}>
              Compromissos
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginTop: '4px' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
          </div>

          {/* Tabs para Reuniões e Tarefas */}
          <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px', paddingBottom: '4px' }}>
            <button 
              onClick={() => setActiveTab('calls')}
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: activeTab === 'calls' ? 'white' : 'rgba(255,255,255,0.4)',
                padding: '6px 0 10px 0',
                borderBottom: activeTab === 'calls' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              Reuniões ({selectedDateBookings.length})
            </button>
            <button 
              onClick={() => setActiveTab('tasks')}
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: activeTab === 'tasks' ? 'white' : 'rgba(255,255,255,0.4)',
                padding: '6px 0 10px 0',
                borderBottom: activeTab === 'tasks' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              Tarefas ({selectedDateTasks.length})
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {activeTab === 'calls' ? (
              <>
                {selectedDateBookings.map((booking) => {
                  const client = clients.find(c => c.id === booking.client_id);
                  const consultor = team.find(t => t.id === booking.consultor_id);
                  
                  // Status badges
                  const getStatusBadge = (status: BookingStatus, isGoogleCalendar?: boolean) => {
                    if (isGoogleCalendar) return { bg: 'rgba(234, 67, 53, 0.15)', color: '#ea4335', text: 'Google Agenda' };
                    switch(status) {
                      case 'confirmado':
                        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', text: 'Confirmado' };
                      case 'realizado':
                        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', text: 'Realizado' };
                      case 'cancelado':
                        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', text: 'Cancelado' };
                      default:
                        return { bg: 'rgba(255, 255, 255, 0.1)', color: '#fff', text: status };
                    }
                  };

                  const badge = getStatusBadge(booking.status, booking.isGoogleCalendar);

                  return (
                    <div 
                      key={booking.id}
                      onClick={() => setSelectedBooking(booking)}
                      style={{
                        background: '#16161d',
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '16px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(201, 169, 110, 0.4)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>
                            {booking.horario_inicio} &mdash; {booking.horario_fim}
                          </span>
                          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginTop: '4px' }}>
                            {booking.isGoogleCalendar ? booking.title : (client?.name || 'Cliente externo')}
                          </h4>
                          {!booking.isGoogleCalendar && (client?.whatsapp || client?.secondary_phone) && (
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0 0' }}>
                              {formatPhone(client.whatsapp || client.secondary_phone)}
                            </p>
                          )}
                          {booking.isGoogleCalendar && booking.notas && (
                            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {booking.notas}
                            </p>
                          )}
                        </div>

                        <span style={{
                          background: badge.bg,
                          color: badge.color,
                          fontSize: '9.5px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '100px',
                          textTransform: 'uppercase'
                        }}>
                          {badge.text}
                        </span>
                      </div>

                      {booking.zoom_link && (
                        <a 
                          href={booking.zoom_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            background: 'rgba(201, 169, 110, 0.1)',
                            color: 'var(--accent-primary)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            textDecoration: 'none'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M23 7l-7 5 7 5V7z" />
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                          </svg>
                          Entrar no Zoom
                        </a>
                      )}

                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                        <span>Consultor: <strong>{consultor?.nome}</strong></span>
                        
                        {/* Status updater quick buttons */}
                        {booking.status === 'confirmado' && !booking.isGoogleCalendar && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'realizado'); }}
                              style={{ color: '#10b981', fontWeight: 600 }}
                            >
                              Concluir
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'cancelado'); }}
                              style={{ color: '#ef4444', fontWeight: 600 }}
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {selectedDateBookings.length === 0 && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px dashed rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    color: 'rgba(255,255,255,0.2)',
                    padding: '40px 20px',
                    textAlign: 'center'
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h21" />
                    </svg>
                    <p style={{ fontSize: '13px', margin: 0 }}>Sem reuniões agendadas para este dia.</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {selectedDateTasks.map((task) => {
                  const client = clients.find(c => c.id === task.client_id);
                  const responsavel = team.find(t => t.id === task.responsavel_id);
                  const isConcluida = task.status === 'concluida';

                  return (
                    <div 
                      key={task.id}
                      style={{
                        background: '#16161d',
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '16px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        transition: 'border-color 0.15s ease',
                        opacity: isConcluida ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(201, 169, 110, 0.4)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
                          {/* Quick status check button */}
                          <button
                            type="button"
                            onClick={() => updateTaskStatus(task.id, isConcluida ? 'pendente' : 'concluida')}
                            style={{
                              marginTop: '2px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: isConcluida ? 'none' : '2px solid rgba(255,255,255,0.3)',
                              background: isConcluida ? 'var(--status-success)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            {isConcluida && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                          
                          <div style={{ flex: 1 }}>
                            <h4 style={{ 
                              fontSize: '14px', 
                              fontWeight: 700, 
                              color: 'white',
                              textDecoration: isConcluida ? 'line-through' : 'none',
                              margin: 0
                            }}>
                              {task.titulo}
                            </h4>
                            {client && (
                              <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                                Cliente: <strong>{client.name}</strong>
                              </p>
                            )}
                            {task.descricao && (
                              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                                {task.descricao}
                              </p>
                            )}
                          </div>
                        </div>

                        <span style={{
                          background: isConcluida ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isConcluida ? 'var(--status-success)' : 'var(--status-warning)',
                          fontSize: '9.5px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '100px',
                          textTransform: 'uppercase'
                        }}>
                          {isConcluida ? 'Concluída' : 'Pendente'}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', alignItems: 'center' }}>
                        <span>Responsável: <strong>{responsavel?.nome || 'Não designado'}</strong></span>
                        
                        <button 
                          type="button"
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            if (confirm('Deseja excluir esta tarefa?')) {
                              await deleteTask(task.id);
                            }
                          }}
                          style={{ color: '#ef4444', fontWeight: 600, fontSize: '11px' }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}

                {selectedDateTasks.length === 0 && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px dashed rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    color: 'rgba(255,255,255,0.2)',
                    padding: '40px 20px',
                    textAlign: 'center'
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    <p style={{ fontSize: '13px', margin: 0 }}>Sem tarefas criadas para este dia.</p>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

      </div>

      {/* --- MODAL: Create Booking --- */}
      {isNewBookingModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <form 
            onSubmit={handleCreateBooking}
            style={{
              background: '#16161d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              padding: '32px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>Agendar Diagnóstico / Reunião</h3>
              <button 
                type="button"
                onClick={() => setIsNewBookingModalOpen(false)}
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            {/* Lead selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                Selecionar Cliente *
              </label>
              <select
                required
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="">-- Escolha um Cliente --</option>
                {activeClients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} — {formatPhone(client.whatsapp || client.secondary_phone)}
                  </option>
                ))}
              </select>
              {activeClients.length === 0 && (
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                  Nenhum cliente cadastrado ainda. Cadastre primeiro na aba <strong>Clientes</strong>.
                </p>
              )}
            </div>

            {/* Consultor / Responsável selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                Consultor Responsável
              </label>
              <select
                value={newConsultorId}
                onChange={(e) => setNewConsultorId(e.target.value)}
                style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
              >
                {team.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.nome} - {member.cargo}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Data *
                </label>
                <input 
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Horário de Início *
                </label>
                <input 
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
                />
              </div>
            </div>

            {/* Meeting Type & Zoom */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Tipo de Reunião
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as BookingTipo)}
                  style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
                >
                  <option value="diagnostico">Exame de vista</option>
                  <option value="proposta">Entrega / Orçamento de óculos</option>
                  <option value="followup">Retorno / Acompanhamento</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Zoom Link
                </label>
                <input 
                  type="url"
                  value={newZoomLink}
                  onChange={(e) => setNewZoomLink(e.target.value)}
                  style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
                />
              </div>
            </div>

            {/* Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                Observações
              </label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Detalhes sobre a conversa comercial..."
                style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button 
                type="button"
                onClick={() => setIsNewBookingModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #0052cc 0%, #ead7b1 100%)',
                  color: 'white',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                Salvar Agendamento
              </button>
            </div>

          </form>
        </div>
      )}

      {/* --- MODAL: Create Task --- */}
      {isNewTaskModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <form 
            onSubmit={handleCreateTask}
            style={{
              background: '#16161d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              padding: '32px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>Criar Nova Tarefa</h3>
              <button 
                type="button"
                onClick={() => setIsNewTaskModalOpen(false)}
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            {/* Lead selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                Selecionar Cliente
              </label>
              <select
                value={newTaskClientId}
                onChange={(e) => setNewTaskClientId(e.target.value)}
                style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="">-- Sem Cliente Associado --</option>
                {activeClients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} — {formatPhone(client.whatsapp || client.secondary_phone)}
                  </option>
                ))}
              </select>
            </div>

            {/* Responsável selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                Atribuir Responsável
              </label>
              <select
                value={newTaskResponsavelId}
                onChange={(e) => setNewTaskResponsavelId(e.target.value)}
                style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="">-- Não Atribuído --</option>
                {team.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.nome} - {member.cargo}
                  </option>
                ))}
              </select>
            </div>

            {/* Task Title Selector / Custom Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                Qual tarefa que é? *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <select
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
                >
                  <option value="WhatsApp">WhatsApp (Falar com Cliente)</option>
                  <option value="Ligar">Ligar para o Cliente</option>
                  <option value="Enviar Proposta">Enviar Proposta Comercial</option>
                  <option value="Acompanhar">Acompanhar / Follow-up</option>
                  <option value="Preparar Reunião">Preparar Material para Reunião</option>
                  <option value="Outro">Outro (Digitar personalizado...)</option>
                </select>

                {newTaskTitle === 'Outro' && (
                  <input
                    type="text"
                    required
                    placeholder="Digite o título da tarefa..."
                    value={newTaskCustomTitle}
                    onChange={(e) => setNewTaskCustomTitle(e.target.value)}
                    style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
                  />
                )}
              </div>
            </div>

            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                Data da Tarefa *
              </label>
              <input 
                type="date"
                required
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
                style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none' }}
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                Descrição explicativa
              </label>
              <textarea
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Explique o que precisa ser feito nesta tarefa..."
                style={{ background: '#1c1c24', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', color: 'white', fontSize: '13.5px', outline: 'none', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button 
                type="button"
                onClick={() => setIsNewTaskModalOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #0052cc 0%, #ead7b1 100%)',
                  color: 'white',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                Salvar Tarefa
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- MODAL: Booking Details --- */}
      {selectedBooking && (() => {
        const client = clients.find(c => c.id === selectedBooking.client_id);
        const consultor = team.find(t => t.id === selectedBooking.consultor_id);
        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: '#16161d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '560px',
              padding: '32px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', margin: 0 }}>Detalhes do Agendamento</h3>
                <button 
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  style={{ color: 'rgba(255,255,255,0.4)', fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Lead Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Informações do Cliente
                </span>
                <div style={{ background: '#1c1c24', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>{client?.name || 'Cliente externo'}</div>
                  {(client?.whatsapp || client?.secondary_phone) && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Telefone: <strong style={{ color: 'white' }}>{formatPhone(client.whatsapp || client.secondary_phone)}</strong></div>}
                  {client?.email && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>E-mail: <strong style={{ color: 'white' }}>{client.email}</strong></div>}
                  {client?.notes && <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Observações: <strong style={{ color: 'white' }}>{client.notes}</strong></div>}
                </div>
              </div>

              {/* Booking Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Detalhes da Reunião
                </span>
                <div style={{ background: '#1c1c24', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Data: <strong style={{ color: 'white' }}>{selectedBooking.data.split('-').reverse().join('/')}</strong></div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Horário: <strong style={{ color: 'white' }}>{selectedBooking.horario_inicio} - {selectedBooking.horario_fim}</strong></div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Consultor: <strong style={{ color: 'white' }}>{consultor?.nome || 'Não definido'}</strong></div>
                  {selectedBooking.zoom_link && (
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Zoom: <a href={selectedBooking.zoom_link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Entrar na Reunião</a></div>
                  )}
                  {selectedBooking.notas && (
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '2px' }}>Observações:</span>
                      <span style={{ color: 'white', whiteSpace: 'pre-wrap' }}>{selectedBooking.notas}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('Tem certeza que deseja EXCLUIR este agendamento permanentemente?')) {
                      const ok = await deleteBooking(selectedBooking.id);
                      if (ok) {
                        setSelectedBooking(null);
                      } else {
                        alert('Não foi possível excluir este agendamento.\n\nA exclusão é permitida apenas para usuários administradores logados. Faça login como administrador (não use o modo de desenvolvimento sem sessão) e tente novamente.');
                      }
                    }
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '100px',
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Excluir Agendamento
                </button>
                
                <button 
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  style={{
                    background: 'var(--accent-primary)',
                    color: 'white',
                    borderRadius: '100px',
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
