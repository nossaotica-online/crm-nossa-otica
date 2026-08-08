'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/context/CRMContext';
import { Goal, GoalTipo, GoalPeriodo } from '@/types';
import { formatLocalDateISO } from '@/lib/utils';
import { useConfirm } from '@/components/ConfirmDialog';

export default function GoalsPage() {
  const { goals, addGoal, updateGoalProgress, updateGoalTarget, deleteGoal } = useCRM();
  const { confirm, confirmDialog } = useConfirm();

  // Modal State for new goal
  const [isNewGoalModalOpen, setIsNewGoalModalOpen] = useState(false);
  const [newGoalType, setNewGoalType] = useState<GoalTipo>('faturamento');
  const [newGoalValue, setNewGoalValue] = useState<number>(10000);
  const [newGoalPeriod, setNewGoalPeriod] = useState<GoalPeriodo>('mensal');
  const [newGoalStart, setNewGoalStart] = useState('');
  const [newGoalEnd, setNewGoalEnd] = useState('');

  // Editing state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editType, setEditType] = useState<'progress' | 'target' | null>(null);
  const [editingValue, setEditingValue] = useState<number>(0);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    // Set default dates (start of current month to end of current month)
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    setNewGoalStart(formatLocalDateISO(startOfMonth));
    setNewGoalEnd(formatLocalDateISO(endOfMonth));
  }, []);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    addGoal({
      user_id: null, // Collective goal
      tipo: newGoalType,
      meta_valor: Number(newGoalValue),
      valor_atual: 0,
      periodo: newGoalPeriod,
      data_inicio: newGoalStart,
      data_fim: newGoalEnd
    });
    setIsNewGoalModalOpen(false);
    // Reset values
    setNewGoalValue(newGoalType === 'faturamento' ? 10000 : 10);
  };

  const handleSaveEdit = (goalId: string) => {
    if (editType === 'progress') {
      updateGoalProgress(goalId, Number(editingValue));
    } else if (editType === 'target') {
      updateGoalTarget(goalId, Number(editingValue));
    }
    setEditingGoalId(null);
    setEditType(null);
  };

  const handleDeleteGoal = async (goalId: string) => {
    const confirmed = await confirm({
      title: 'Excluir esta meta?',
      message: 'A meta sai do painel e o histórico dela não pode ser recuperado.',
      confirmLabel: 'Sim, excluir meta',
    });
    if (!confirmed) return;
    deleteGoal(goalId);
  };

  if (!isMounted) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Nossa Ótica CRM</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Metas & Performance</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Header */}
      <div className="mobile-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Nossa Ótica CRM</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Metas & Performance</h1>
        </div>
        <button
          onClick={() => setIsNewGoalModalOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #0052cc 0%, #ead7b1 100%)',
            color: 'var(--text-primary)',
            borderRadius: '100px',
            padding: '12px 24px',
            fontSize: '13.5px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--glow-gold)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>+ Nova Meta</span>
        </button>
      </div>

      {/* Goals Empty State */}
      {goals.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          background: 'var(--bg-card)',
          border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: '24px',
          textAlign: 'center',
          gap: '16px',
          marginTop: '20px'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(201, 169, 110, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ead7b1'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Nenhuma meta definida</h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '400px', margin: 0 }}>
              Crie metas de faturamento, clientes convertidos ou vendas para acompanhar o progresso comercial da ótica.
            </p>
          </div>
          <button
            onClick={() => setIsNewGoalModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #0052cc 0%, #ead7b1 100%)',
              color: 'var(--text-primary)',
              borderRadius: '100px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            Definir Primeira Meta
          </button>
        </div>
      ) : (
        /* Goals grid */
        <div className="mobile-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
          {goals.map((goal) => {
            const percentage = Math.min(Math.round((goal.valor_atual / goal.meta_valor) * 100), 100);

            return (
              <div
                key={goal.id}
                className="glass-card"
                style={{
                  borderRadius: '20px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--glass-border)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  position: 'relative'
                }}
              >
                {/* Delete Goal Button */}
                <button
                  onClick={() => void handleDeleteGoal(goal.id)}
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  title="Excluir Meta"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: '24px' }}>
                  <div>
                    <span style={{
                      background: 'rgba(201, 169, 110, 0.1)',
                      color: 'var(--accent-primary)',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '100px',
                      textTransform: 'uppercase'
                    }}>
                      Meta Coletiva ({goal.periodo})
                    </span>

                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
                      {goal.tipo === 'faturamento'
                        ? 'Meta de Faturamento'
                        : goal.tipo === 'leads_convertidos'
                        ? 'Clientes Convertidos'
                        : 'Meta de Vendas'}
                    </h3>
                  </div>

                  <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {percentage}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div>
                  <div style={{ height: '8px', background: 'var(--surface-subtle)', borderRadius: '100px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: 'linear-gradient(135deg, #c9a96e 0%, #00d4ff 100%)',
                      borderRadius: '100px',
                      boxShadow: 'var(--glow-gold)',
                      transition: 'width 0.4s ease'
                    }}></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    <span>
                      Progresso: <strong>
                        {goal.tipo === 'faturamento' ? `R$ ${goal.valor_atual.toLocaleString('pt-BR')}` : `${goal.valor_atual}`}
                      </strong>
                    </span>
                    <span>
                      Alvo: <strong>
                        {goal.tipo === 'faturamento' ? `R$ ${goal.meta_valor.toLocaleString('pt-BR')}` : `${goal.meta_valor}`}
                      </strong>
                    </span>
                  </div>
                </div>

                <hr style={{ border: 'none', height: '1px', background: 'var(--surface-hover)', margin: 0 }} />

                {/* Edit Section */}
                <div>
                  {editingGoalId === goal.id && editType ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {editType === 'progress' ? 'Novo Valor Atual' : 'Novo Alvo da Meta'}
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="number"
                          value={editingValue}
                          onChange={(e) => setEditingValue(Number(e.target.value))}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--glass-border-strong)',
                            borderRadius: '8px',
                            padding: '8px 12px',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            flex: 1,
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={() => handleSaveEdit(goal.id)}
                          style={{
                            background: '#10b981',
                            color: 'var(--text-primary)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => {
                            setEditingGoalId(null);
                            setEditType(null);
                          }}
                          style={{
                            background: 'var(--surface-hover)',
                            color: 'var(--text-primary)',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => {
                          setEditingGoalId(goal.id);
                          setEditType('progress');
                          setEditingValue(goal.valor_atual);
                        }}
                        style={{
                          background: 'var(--surface-subtle)',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--text-primary)',
                          borderRadius: '8px',
                          padding: '10px',
                          flex: 1,
                          fontSize: '12.5px',
                          fontWeight: 600,
                          textAlign: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        Ajustar Progresso
                      </button>
                      <button
                        onClick={() => {
                          setEditingGoalId(goal.id);
                          setEditType('target');
                          setEditingValue(goal.meta_valor);
                        }}
                        style={{
                          background: 'rgba(201, 169, 110, 0.05)',
                          border: '1px solid rgba(201, 169, 110, 0.1)',
                          color: '#ead7b1',
                          borderRadius: '8px',
                          padding: '10px',
                          flex: 1,
                          fontSize: '12.5px',
                          fontWeight: 600,
                          textAlign: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        Ajustar Alvo
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* --- MODAL: Create Goal --- */}
      {isNewGoalModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <form
            onSubmit={handleCreateGoal}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border-strong)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '450px',
              padding: '32px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Definir Nova Meta</h3>
              <button
                type="button"
                onClick={() => setIsNewGoalModalOpen(false)}
                style={{ color: 'var(--text-secondary)', fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Tipo de Meta
              </label>
              <select
                value={newGoalType}
                onChange={(e) => {
                  const type = e.target.value as GoalTipo;
                  setNewGoalType(type);
                  setNewGoalValue(type === 'faturamento' ? 10000 : 10);
                }}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="faturamento">Faturamento (R$)</option>
                <option value="leads_convertidos">Clientes Convertidos (Quantidade)</option>
                <option value="vendas">Contratos Fechados (Quantidade)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Valor Alvo (Meta)
              </label>
              <input
                type="number"
                required
                value={newGoalValue}
                onChange={(e) => setNewGoalValue(Number(e.target.value))}
                placeholder={newGoalType === 'faturamento' ? 'Ex: 20000' : 'Ex: 50'}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Período
              </label>
              <select
                value={newGoalPeriod}
                onChange={(e) => setNewGoalPeriod(e.target.value as GoalPeriodo)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Data de Início
                </label>
                <input
                  type="date"
                  required
                  value={newGoalStart}
                  onChange={(e) => setNewGoalStart(e.target.value)}
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Data Limite
                </label>
                <input
                  type="date"
                  required
                  value={newGoalEnd}
                  onChange={(e) => setNewGoalEnd(e.target.value)}
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsNewGoalModalOpen(false)}
                style={{
                  background: 'var(--surface-hover)',
                  color: 'var(--text-primary)',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #0052cc 0%, #ead7b1 100%)',
                  color: 'var(--text-primary)',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                Definir Meta
              </button>
            </div>

          </form>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
