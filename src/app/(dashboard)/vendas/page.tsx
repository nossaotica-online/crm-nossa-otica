'use client';

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/context/CRMContext';

const opticalProductLabel = (serviceName: string | null) => {
  if (!serviceName) return 'Óculos completos';

  const legacyMarketingServices = [
    'Assessoria de Tráfego Pago',
    'Estruturação Comercial (CRM/Processos)',
    'Funil de Vendas de Alta Conversão',
    'Consultoria Comercial Estratégica',
  ];

  return legacyMarketingServices.includes(serviceName) ? 'Óculos completos' : serviceName;
};

export default function SalesPage() {
  const { sales, leads, team, addSale } = useCRM();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);

  // Form State
  const [leadId, setLeadId] = useState('');
  const [vendedorId, setVendedorId] = useState('prof-2'); // Default to Vitória
  const [serviceName, setServiceName] = useState('Óculos completos');
  const [value, setValue] = useState(0);
  const [installments, setInstallments] = useState(1);
  const [status, setStatus] = useState<'fechado' | 'negociacao' | 'proposta'>('fechado');
  const [notes, setNotes] = useState('');

  const handleCreateSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;

    addSale({
      lead_id: leadId,
      vendedor_id: vendedorId,
      servico_id: 'serv-generic',
      servico_nome: serviceName,
      valor: Number(value),
      parcelas: Number(installments),
      status: status,
      data_fechamento: status === 'fechado' ? new Date().toISOString().split('T')[0] : null,
      notes: notes
    } as any);

    // Reset Form
    setLeadId('');
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
            Contratos assinados e fechados
          </span>
        </div>

        <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>Ticket Médio</span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--text-primary)' }}>
            R$ {averageTicket.toLocaleString('pt-BR')}
          </h2>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: '8px' }}>
            Valor médio por cliente fechado
          </span>
        </div>

        <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px' }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500 }}>Pipeline em Negociação</span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '8px 0 0 0', color: 'var(--accent-primary)' }}>
            R$ {potentialRevenue.toLocaleString('pt-BR')}
          </h2>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: '8px' }}>
            Propostas abertas com chance de fechamento
          </span>
        </div>

      </div>

      {/* Sales List Table */}
      <div className="glass-card" style={{ borderRadius: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>Contratos & Transações</h3>

        <div className="table-scroll">
        <table className="table" style={{ fontSize: '13.5px' }}>
          <thead>
            <tr>
              <th style={{ paddingLeft: 0 }}>Cliente / Empresa</th>
              <th>Produto vendido</th>
              <th>Responsável</th>
              <th>Parcelas</th>
              <th>Status</th>
              <th style={{ textAlign: 'right', paddingRight: 0 }}>Valor do Contrato</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => {
              const lead = leads.find(l => l.id === sale.lead_id);
              const seller = team.find(t => t.id === sale.vendedor_id);

              return (
                <tr key={sale.id}>
                  <td style={{ paddingLeft: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead?.nome || 'Cliente Manual'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {lead?.empresa || 'Individual'}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-primary)' }}>{opticalProductLabel(sale.servico_nome)}</td>
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
                  Nenhuma transação comercial registrada.
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
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Registrar Venda / Contrato</h3>
              <button
                type="button"
                onClick={() => setIsNewSaleModalOpen(false)}
                style={{ color: 'var(--text-muted)', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            {/* Lead selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Selecionar Cliente *
              </label>
              <select
                required
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              >
                <option value="">-- Escolha o Cliente --</option>
                {leads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.nome} {lead.empresa ? `(${lead.empresa})` : ''}
                  </option>
                ))}
              </select>
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
                <option value="Óculos completos">Óculos completos</option>
                <option value="Lentes">Lentes</option>
                <option value="Armações">Armações</option>
                <option value="Óculos de sol">Óculos de sol</option>
                <option value="Manutenção">Manutenção</option>
              </select>
            </div>

            {/* Vendedor selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Vendedor / Responsável
              </label>
              <select
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', padding: '12px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13.5px', outline: 'none' }}
              >
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
                  Valor do Contrato (R$) *
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
                Status da Transação
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
