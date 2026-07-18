'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/context/CRMContext';

const PRODUCT_OPTIONS = ['Óculos completos', 'Lentes', 'Armações', 'Óculos de sol', 'Manutenção'];

const onlyDigits = (value: string) => value.replace(/\D/g, '');
const formatPhone = (value?: string | null) => {
  const digits = onlyDigits(value || '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || '';
};

export default function SalesPage() {
  const { sales, clients, team, addSale } = useCRM();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);

  // Form State
  const [clientId, setClientId] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [serviceName, setServiceName] = useState('Óculos completos');
  const [value, setValue] = useState(0);
  const [installments, setInstallments] = useState(1);
  const [status, setStatus] = useState<'fechado' | 'negociacao' | 'proposta'>('fechado');
  const [notes, setNotes] = useState('');

  const handleCreateSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) return;

    addSale({
      client_id: clientId,
      lead_id: null,
      vendedor_id: vendedorId || (team.length > 0 ? team[0].id : null),
      servico_id: null,
      servico_nome: serviceName,
      valor: Number(value),
      parcelas: Number(installments),
      status: status,
      data_fechamento: status === 'fechado' ? new Date().toISOString().split('T')[0] : null,
      notas: notes
    } as any);

    // Reset Form
    setClientId('');
    setServiceName('Óculos completos');
    setValue(0);
    setInstallments(1);
    setStatus('fechado');
    setNotes('');
    setIsNewSaleModalOpen(false);
  };

  if (!isMounted) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Nossa Ótica CRM</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Faturamento & Vendas</h1>
        </div>
      </div>
    );
  }

  // Calculations
  const closedSales = sales.filter(s => s.status === 'fechado');
  const totalRevenue = closedSales.reduce((sum, s) => sum + s.valor, 0);
  const averageTicket = closedSales.length > 0 ? totalRevenue / closedSales.length : 0;
  const negotiatingSales = sales.filter(s => s.status === 'negociacao');
  const potentialRevenue = negotiatingSales.reduce((sum, s) => sum + s.valor, 0);

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Header */}
      <div className="mobile-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Nossa Ótica CRM</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Faturamento & Vendas</h1>
        </div>

        <button
          onClick={() => setIsNewSaleModalOpen(true)}
          className="btn btn-primary"
          style={{ fontWeight: 700, padding: '10px 20px' }}
        >
          + Registrar Venda
        </button>
      </div>

      {/* KPI Cards */}
      <div className="mobile-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>

        <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>Faturamento Realizado</span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--status-success)' }}>
            R$ {totalRevenue.toLocaleString('pt-BR')}
          </h2>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: '8px' }}>
            Vendas fechadas
          </span>
        </div>

        <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>Ticket Médio</span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--text-primary)' }}>
            R$ {averageTicket.toLocaleString('pt-BR')}
          </h2>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: '8px' }}>
            Valor médio por venda
          </span>
        </div>

        <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>Orçamentos em Negociação</span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--accent-primary)' }}>
            R$ {potentialRevenue.toLocaleString('pt-BR')}
          </h2>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: '8px' }}>
            Orçamentos abertos com chance de fechar
          </span>
        </div>

      </div>

      {/* Sales List Table */}
      <div className="glass-card" style={{ borderRadius: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Vendas realizadas</h3>

        <div className="table-scroll">
        <table className="table" style={{ fontSize: '13.5px' }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: 0 }}>Cliente</th>
              <th>Produto</th>
              <th>Vendedor(a)</th>
              <th>Parcelas</th>
              <th>Status</th>
              <th style={{ textAlign: 'right', paddingRight: 0 }}>Valor da Venda</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const client = clients.find(c => c.id === sale.client_id);
              const seller = team.find(t => t.id === sale.vendedor_id);

              return (
                <tr key={sale.id}>
                  <td style={{ paddingLeft: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{client?.name || 'Cliente avulso'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatPhone(client?.whatsapp || client?.secondary_phone) || '—'}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-primary)' }}>{sale.servico_nome || 'Óculos completos'}</td>
                  <td>{seller?.nome}</td>
                  <td>{sale.parcelas}x</td>
                  <td>
                    <span style={{
                      background: sale.status === 'fechado' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: sale.status === 'fechado' ? '#10b981' : '#3b82f6',
                      padding: '4px 10px',
                      borderRadius: '100px',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {sale.status === 'fechado' ? 'Fechado' : 'Em Negociação'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                    R$ {sale.valor.toLocaleString('pt-BR')}
                  </td>
                </tr>
              );
            })}

            {sales.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '24px 0' }}>
                  Nenhuma venda registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* --- MODAL: Create Sale --- */}
      {isNewSaleModalOpen && (
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
            onSubmit={handleCreateSale}
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
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Registrar Venda</h3>
              <button
                type="button"
                onClick={() => setIsNewSaleModalOpen(false)}
                style={{ color: 'var(--text-muted)', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            {/* Client selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Selecionar Cliente *
              </label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="">-- Escolha o Cliente --</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} — {formatPhone(client.whatsapp || client.secondary_phone)}
                  </option>
                ))}
              </select>
              {clients.length === 0 && (
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                  Nenhum cliente cadastrado ainda. Cadastre primeiro na aba <strong>Clientes</strong> ou ao abrir uma <strong>Ordem de Serviço</strong>.
                </p>
              )}
            </div>

            {/* Service Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Produto vendido
              </label>
              <select
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              >
                {PRODUCT_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Vendedor selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Vendedor(a)
              </label>
              <select
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="">-- Selecione --</option>
                {team.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.nome} - {member.cargo}
                  </option>
                ))}
              </select>
            </div>

            {/* Value & Installments */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Valor da Venda (R$) *
                </label>
                <input
                  type="number"
                  required
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Número de Parcelas
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
                />
              </div>
            </div>

            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Status da Venda
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="fechado">Venda concluída</option>
                <option value="negociacao">Em Negociação</option>
                <option value="proposta">Orçamento</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsNewSaleModalOpen(false)}
                style={{
                  background: 'var(--surface-hover)',
                  color: 'var(--text-primary)',
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
                  color: 'var(--text-primary)',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 700
                }}
              >
                Salvar Venda
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
}
