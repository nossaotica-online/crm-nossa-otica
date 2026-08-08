'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/context/CRMContext';
import { createClient } from '@/lib/supabase/client';

// Explicação em português do que cada acesso permite, para a escolha não
// depender de decorar o nome da função.
const ROLE_HELP: Record<string, string> = {
  funcionario: 'Cadastra O.S., atende qualquer cliente da ótica e cuida das tarefas. Não vê faturamento, metas, equipe nem o painel de início. Não exclui nada.',
  vendedor: 'Vê apenas os clientes, orçamentos e tarefas que ele mesmo cadastrou.',
  consultor: 'Mesmo alcance do vendedor: só os registros dele.',
  gestor: 'Vê tudo da operação, inclusive faturamento e metas. Não mexe na equipe.',
  admin: 'Acesso total, inclusive criar e desativar acessos.',
};

export default function TeamPage() {
  const { team, leads, bookings, sales, addTeamMember, toggleTeamMemberActive } = useCRM();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();
  }, []);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [role, setRole] = useState('funcionario');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const result = await addTeamMember({
      email,
      pass: password,
      nome,
      cargo,
      role
    });

    setIsSubmitting(false);

    if (result.success) {
      setIsAddModalOpen(false);
      setEmail('');
      setPassword('');
      setNome('');
      setCargo('');
      setRole('funcionario');
    } else {
      setErrorMsg(result.error || 'Erro ao criar usuário');
    }
  };

  if (!isMounted) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Nossa Ótica CRM</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Sua Equipe</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div className="mobile-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Nossa Ótica CRM</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Sua Equipe</h1>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn btn-primary"
          style={{ fontWeight: 700, padding: '10px 20px' }}
        >
          + Adicionar Membro
        </button>
      </div>

      {/* Team Cards Grid */}
      <div className="mobile-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {team.map((member) => {
          // Calculate specific member stats
          const memberLeads = leads.filter(l => l.responsavel_id === member.id);
          const memberBookings = bookings.filter(b => b.consultor_id === member.id);
          const memberSales = sales.filter(s => s.vendedor_id === member.id && s.status === 'fechado');
          const totalSalesValue = memberSales.reduce((sum, s) => sum + s.valor, 0);

          return (
            <div
              key={member.id}
              className="glass-card"
              style={{
                borderRadius: '20px',
                background: 'var(--bg-card)',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}
            >
              {/* Profile Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: member.role === 'admin' ? 'linear-gradient(135deg, #c9a96e 0%, #00d4ff 100%)' : 'linear-gradient(135deg, #002255 0%, #d8bd8a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  fontSize: '20px'
                }}>
                  {member.nome.charAt(0)}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{member.nome}</h3>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: member.ativo ? '#10b981' : '#ef4444',
                      boxShadow: member.ativo ? '0 0 8px #10b981' : '0 0 8px #ef4444'
                    }}></span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                    {member.cargo} {member.ativo ? '' : '(Inativo)'}
                  </span>
                </div>
              </div>

              {/* Contact Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <div>Email: <strong style={{ color: 'var(--text-primary)' }}>{member.email}</strong></div>
                <div>Whatsapp: <strong style={{ color: 'var(--text-primary)' }}>{member.telefone || 'Não informado'}</strong></div>
              </div>

              <hr style={{ border: 'none', height: '1px', background: 'var(--surface-hover)', margin: 0 }} />

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>Clientes</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{memberLeads.length}</div>
                </div>
                <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>Agenda</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{memberBookings.length}</div>
                </div>
                <div style={{ background: 'var(--surface-subtle)', padding: '12px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 600 }}>Orçamentos</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--status-success)', marginTop: '4px' }}>
                    R$ {totalSalesValue >= 1000 ? `${(totalSalesValue/1000).toFixed(0)}k` : totalSalesValue}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {member.id !== currentUserId && (
                <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', paddingTop: '10px' }}>
                  <button
                    onClick={() => toggleTeamMemberActive(member.id, member.ativo)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: member.ativo ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      color: member.ativo ? '#ef4444' : '#10b981',
                      border: member.ativo ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {member.ativo ? 'Desativar Acesso' : 'Ativar Acesso'}
                  </button>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Modal: Adicionar Membro da Equipe */}
      {isAddModalOpen && (
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
            onSubmit={handleSubmit}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border-strong)',
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
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Adicionar Membro da Equipe</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ color: 'var(--text-muted)', fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
                {errorMsg}
              </div>
            )}

            {/* Nome */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Nome *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: João Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              />
            </div>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                E-mail *
              </label>
              <input
                type="email"
                required
                placeholder="Ex: joao@nossaotica.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              />
            </div>

            {/* Senha */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Senha de Acesso *
              </label>
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              />
            </div>

            {/* Cargo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Cargo *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Closer de Vendas / SDR"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              />
            </div>

            {/* Permissão */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Nível de Acesso *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="funcionario">Funcionário de balcão (O.S., Clientes e Tarefas)</option>
                <option value="vendedor">Vendedor (só o que ele mesmo cadastrar)</option>
                <option value="consultor">Consultor (Entrega)</option>
                <option value="gestor">Gestor (Acesso Médio)</option>
                <option value="admin">Administrador (Total)</option>
              </select>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {ROLE_HELP[role] || ''}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  background: 'var(--surface-hover)',
                  color: 'var(--text-primary)',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: 'linear-gradient(135deg, #0052cc 0%, #ead7b1 100%)',
                  color: 'var(--text-primary)',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                {isSubmitting ? 'Salvando...' : 'Adicionar Membro'}
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
