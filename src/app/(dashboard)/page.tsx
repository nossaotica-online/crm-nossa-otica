'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCRM } from '@/context/CRMContext';
import { createClient } from '@/lib/supabase/client';
import { LEAD_STATUS_CONFIG, LEAD_ORIGEM_LABELS } from '@/lib/constants';
import { Lead, LeadStatus, LeadOrigem } from '@/types';
import Link from 'next/link';
import { formatLocalDateISO, getTodayISO } from '@/lib/utils';

export default function DashboardPage() {
  const { leads, clients, bookings, sales, goals, addLead, team } = useCRM();
  const router = useRouter();
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };
  const [timeFilter, setTimeFilter] = useState<'today' | 'week'>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);

  const [activeDayIndex, setActiveDayIndex] = useState(2); // Default to Wednesday

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Form State for new lead
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadCompany, setNewLeadCompany] = useState('');
  const [newLeadSegment, setNewLeadSegment] = useState('');
  const [newLeadValue, setNewLeadValue] = useState(3000);
  const [newLeadOrigin, setNewLeadOrigin] = useState<LeadOrigem>('quiz-instagram');
  const [newLeadResponsavelId, setNewLeadResponsavelId] = useState('');

  // Calculate dynamic stats
  const totalLeads = leads.length;
  const closedLeads = leads.filter(l => l.status === 'fechado');
  const totalRevenue = sales.filter(s => s.status === 'fechado').reduce((acc, curr) => acc + curr.valor, 0);

  // Status counts mapped to Behance donut chart legend
  const countSuccess = leads.filter(l => l.status === 'fechado').length;
  const countWaiting = leads.filter(l => l.status === 'agendado').length;
  const countCancel = leads.filter(l => l.status === 'perdido').length;
  const countProcessing = leads.filter(l => ['novo', 'qualificado', 'em_reuniao', 'proposta'].includes(l.status)).length;

  const maxCount = Math.max(countSuccess, countWaiting, countProcessing, countCancel, 1);
  const hSuccess = (countSuccess / maxCount) * 160; // max height 160px
  const hWaiting = (countWaiting / maxCount) * 160;
  const hProcessing = (countProcessing / maxCount) * 160;
  const hCancel = (countCancel / maxCount) * 160;

  // Calculate dynamic sales value for each origin
  const quizInstagramSales = sales
    .filter(s => s.status === 'fechado')
    .reduce((acc, s) => {
      const lead = leads.find(l => l.id === s.lead_id);
      return lead?.origem === 'quiz-instagram' ? acc + s.valor : acc;
    }, 0);

  const siteSales = sales
    .filter(s => s.status === 'fechado')
    .reduce((acc, s) => {
      const lead = leads.find(l => l.id === s.lead_id);
      return lead?.origem === 'site' ? acc + s.valor : acc;
    }, 0);

  const indicacaoSales = sales
    .filter(s => s.status === 'fechado')
    .reduce((acc, s) => {
      const lead = leads.find(l => l.id === s.lead_id);
      return lead?.origem === 'indicacao' ? acc + s.valor : acc;
    }, 0);

  const outrasSales = sales
    .filter(s => s.status === 'fechado')
    .reduce((acc, s) => {
      const lead = leads.find(l => l.id === s.lead_id);
      return (lead && ['manual', 'google', 'outro'].includes(lead.origem)) ? acc + s.valor : acc;
    }, 0);

  // Total faturamento closed
  const totalClosedSalesVal = sales
    .filter(s => s.status === 'fechado')
    .reduce((acc, curr) => acc + curr.valor, 0);

  // Representation percentage
  const quizShare = totalClosedSalesVal > 0 ? (quizInstagramSales / totalClosedSalesVal) * 100 : 0;
  const siteShare = totalClosedSalesVal > 0 ? (siteSales / totalClosedSalesVal) * 100 : 0;
  const indicacaoShare = totalClosedSalesVal > 0 ? (indicacaoSales / totalClosedSalesVal) * 100 : 0;
  const outrasShare = totalClosedSalesVal > 0 ? (outrasSales / totalClosedSalesVal) * 100 : 0;

  // Clientes por origem (ramo ótica): conta o cadastro de Clientes — mexe a cada cliente novo.
  const totalClientsCount = clients.length;
  const clientsIndicacao = clients.filter((c) => c.source === 'indicacao').length;
  const clientsMidia = clients.filter((c) => ['meta', 'google', 'instagram'].includes(c.source)).length;
  const clientsLoja = clients.filter((c) => c.source === 'loja').length;
  const clientsOutras = totalClientsCount - clientsIndicacao - clientsMidia - clientsLoja;
  const clientShare = (count: number) => (totalClientsCount > 0 ? (count / totalClientsCount) * 100 : 0);

  const CLIENT_SOURCE_LABELS: Record<string, string> = {
    meta: 'Meta / Tráfego pago', google: 'Google', instagram: 'Instagram',
    indicacao: 'Indicação', loja: 'Passou na loja', cliente_antigo: 'Cliente antigo',
    whatsapp: 'WhatsApp', outro: 'Outro',
  };
  const PRODUCT_LABELS: Record<string, string> = {
    oculos_completo: 'Óculos completos', lentes: 'Lentes', armacao: 'Armação',
    oculos_sol: 'Óculos de sol', manutencao: 'Manutenção',
  };
  const fmtPhone = (value?: string | null) => {
    const digits = (value || '').replace(/\D/g, '');
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return value || '';
  };

  // --- Real Chart Data Calculation ---
  // X coordinates for 7 points
  const xCoords = [20, 146.7, 273.3, 400, 526.7, 653.3, 780];

  // Weekly data (last 7 days)
  const weeklyPoints = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = formatLocalDateISO(d);
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Sum sales for this day
    const daySales = sales.filter(s => s.status === 'fechado' && (s.data_fechamento === dateStr || (s.created_at && s.created_at.startsWith(dateStr))));
    const value = daySales.reduce((acc, curr) => acc + curr.valor, 0);

    return {
      day: dayNames[d.getDay()],
      date: `${d.getDate()} ${d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}`,
      value,
      x: xCoords[i],
      y: 200 // Default, will calculate below
    };
  });

  // Today data (grouped by hours)
  const todayStr = getTodayISO();
  const todaySales = sales.filter(s => s.status === 'fechado' && s.created_at && s.created_at.startsWith(todayStr));

  const hourlyIntervals = [9, 11, 13, 15, 17, 19, 21];
  const todayPoints = hourlyIntervals.map((hour, i) => {
    // Sum sales that happened before this hour (cumulative or just in that bucket? let's do bucket)
    const bucketSales = todaySales.filter(s => {
      const saleHour = new Date(s.created_at!).getHours();
      const prevHour = i === 0 ? 0 : hourlyIntervals[i - 1];
      return saleHour >= prevHour && saleHour < hour;
    });
    const value = bucketSales.reduce((acc, curr) => acc + curr.valor, 0);

    return {
      day: `${hour.toString().padStart(2, '0')}h`,
      date: 'Hoje',
      value,
      x: xCoords[i],
      y: 200
    };
  });

  const activePoints = timeFilter === 'today' ? todayPoints : weeklyPoints;

  // Calculate Y coordinates based on max value in the active view
  const maxValue = Math.max(...activePoints.map(p => p.value), 1); // Avoid division by zero
  activePoints.forEach(p => {
    // y = 200 is bottom (0 value), y = 20 is top (max value)
    p.y = 200 - (p.value / maxValue) * 160;
  });

  const activePoint = activePoints[activeDayIndex];

  // Total value to display
  const displayedValue = timeFilter === 'today'
    ? todayPoints.reduce((acc, curr) => acc + curr.value, 0)
    : totalRevenue; // Total revenue of all time, or just weekly? Let's show all time for weekly to match old behavior.

  const chartPath = activePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
  const areaPath = `${chartPath} L ${activePoints[activePoints.length - 1].x},220 L ${activePoints[0].x},220 Z`;

  // --- Variação real período-a-período (antes era um "24%" fixo/fake) ---
  const revenueBetween = (startStr: string, endStr: string) => sales
    .filter(s => s.status === 'fechado')
    .reduce((acc, s) => {
      const ref = s.data_fechamento || (s.created_at ? s.created_at.slice(0, 10) : null);
      if (!ref) return acc;
      return ref >= startStr && ref < endStr ? acc + s.valor : acc;
    }, 0);

  const dayStr = (d: Date) => formatLocalDateISO(d);
  const refToday = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;
  let currentPeriodRev = 0;
  let previousPeriodRev = 0;
  if (timeFilter === 'today') {
    const yesterday = new Date(refToday.getTime() - oneDayMs);
    currentPeriodRev = revenueBetween(dayStr(refToday), dayStr(new Date(refToday.getTime() + oneDayMs)));
    previousPeriodRev = revenueBetween(dayStr(yesterday), dayStr(refToday));
  } else {
    const start7 = new Date(refToday.getTime() - 6 * oneDayMs);
    const startPrev = new Date(refToday.getTime() - 13 * oneDayMs);
    currentPeriodRev = revenueBetween(dayStr(start7), dayStr(new Date(refToday.getTime() + oneDayMs)));
    previousPeriodRev = revenueBetween(dayStr(startPrev), dayStr(start7));
  }
  const growthPct = previousPeriodRev > 0
    ? ((currentPeriodRev - previousPeriodRev) / previousPeriodRev) * 100
    : (currentPeriodRev > 0 ? 100 : 0);
  const hasGrowthData = currentPeriodRev > 0 || previousPeriodRev > 0;
  const growthUp = growthPct >= 0;

  // Interactive mouse/touch dragging handler for line chart
  const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clientX / width;

    let index = Math.round(percentage * 6);
    if (index < 0) index = 0;
    if (index > 6) index = 6;
    setActiveDayIndex(index);
  };

  const handleChartTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches[0].clientX - rect.left;
    const width = rect.width;
    const percentage = clientX / width;

    let index = Math.round(percentage * 6);
    if (index < 0) index = 0;
    if (index > 6) index = 6;
    setActiveDayIndex(index);
  };


  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadName.trim()) return;

    addLead({
      nome: newLeadName,
      email: newLeadEmail || null,
      telefone: newLeadPhone || null,
      origem: newLeadOrigin,
      status: 'novo',
      responsavel_id: newLeadResponsavelId || (team.length > 0 ? team[0].id : null),
      respostas_quiz: null,
      empresa: newLeadCompany || null,
      segmento: newLeadSegment || null,
      notas: 'Cliente cadastrado manualmente a partir do painel.',
      valor_estimado: Number(newLeadValue),
      motivo_perda: null
    });

    // Reset Form
    setNewLeadName('');
    setNewLeadEmail('');
    setNewLeadPhone('');
    setNewLeadCompany('');
    setNewLeadSegment('');
    setNewLeadValue(3000);
    setNewLeadOrigin('quiz-instagram');
    setNewLeadResponsavelId('');
    setIsNewLeadModalOpen(false);
  };

  // Clientes recentes (cadastro de Clientes), com filtro da busca do topo
  const searchDigits = searchQuery.replace(/\D/g, '');
  const recentClients = [...clients]
    .filter((client) => {
      if (!searchQuery.trim()) return true;
      if (client.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
      return searchDigits.length >= 3 && ((client.whatsapp || '').includes(searchDigits) || (client.secondary_phone || '').includes(searchDigits));
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5);

  if (!isMounted) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div>
          <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>Olá Equipe,</span>
          <h1 style={{ fontSize: '36px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.8px', color: 'var(--text-primary)' }}>Carregando painel...</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Header section mirroring mockup */}
      <div className="mobile-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '320px' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Pesquisar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: '100px',
              padding: '14px 16px 14px 48px',
              color: 'var(--text-primary)',
              fontSize: '13.5px',
              outline: 'none'
            }}
          />
        </div>

        {/* Sair */}
        <button
          onClick={() => void handleLogout()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
            padding: '11px 18px', borderRadius: '100px',
            border: '1px solid var(--glass-border)', background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sair
        </button>

      </div>

      {/* Greeting and Filters */}
      <div className="mobile-page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '-10px' }}>
        <div>
          <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>Olá Equipe,</span>
          <h1 style={{ fontSize: '36px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.8px', color: 'var(--text-primary)' }}>Bem-vindo de volta! 👋</h1>
        </div>

        {/* Today / Week filter buttons from mockup */}
        <div style={{
          background: 'var(--bg-secondary)',
          padding: '4px',
          borderRadius: '100px',
          display: 'flex',
          gap: '4px',
          border: '1px solid var(--glass-border)'
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
              <button
                className={`tab-btn ${timeFilter === 'week' ? 'active' : ''}`}
                onClick={() => setTimeFilter('week')}
                style={{
                  padding: '8px 24px',
                  borderRadius: '100px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: timeFilter === 'week' ? 'var(--bg-card-hover)' : 'transparent',
                  color: timeFilter === 'week' ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                7 Dias
              </button>
              <button
                className={`tab-btn ${timeFilter === 'today' ? 'active' : ''}`}
                onClick={() => setTimeFilter('today')}
                style={{
                  padding: '8px 24px',
                  borderRadius: '100px',
                  fontSize: '13px',
                  fontWeight: 700,
                  background: timeFilter === 'today' ? 'var(--bg-card-hover)' : 'transparent',
                  color: timeFilter === 'today' ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                Hoje
              </button>
            </div>

          <button style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h21" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Balance / Chart Card */}
      <div className="glass-card" style={{
        padding: '32px',
        borderRadius: '24px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--glass-border)',
        position: 'relative'
      }}>

        {/* Metric Title & Chart Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>{timeFilter === 'week' ? 'Vendas Totais' : 'Vendas Hoje'}</span>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '4px' }}>
              <h2 style={{ fontSize: '32px', fontWeight: 800, margin: 0, letterSpacing: '-1px' }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayedValue)}
              </h2>
              {hasGrowthData && (
                <span style={{
                  background: growthUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: growthUp ? '#10b981' : '#ef4444',
                  padding: '4px 10px',
                  borderRadius: '100px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: growthUp ? 'none' : 'rotate(180deg)' }}>
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                  {growthUp ? '+' : ''}{growthPct.toFixed(0).replace('-', '−')}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Premium Interactive SVG Line Chart */}
        <div style={{ position: 'relative', width: '100%', height: '220px', marginBottom: '32px' }}>

          {/* Dynamic Tooltip */}
          {activePoint && (
            <div style={{
              position: 'absolute',
              left: `calc(${(activePoint.x / 800) * 100}% - 65px)`,
              top: `${activePoint.y - 75}px`,
              background: '#ffffff',
              color: '#000000',
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '12px',
              boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
              zIndex: 10,
              transition: 'all 0.15s ease',
              pointerEvents: 'none'
            }}>
              <div style={{ color: '#8e8e93', fontSize: '10px', fontWeight: 600 }}>{activePoint.day}, {activePoint.date}</div>
              <div style={{ fontWeight: 800, marginTop: '2px', fontSize: '14px', color: '#000000' }}>
                R$ {activePoint.value.toLocaleString('pt-BR')}
              </div>
              {/* Tooltip triangle */}
              <div style={{
                position: 'absolute',
                bottom: '-4px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
                width: '8px',
                height: '8px',
                background: '#ffffff'
              }}></div>
            </div>
          )}

          {/* SVG Canvas */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 800 220"
            preserveAspectRatio="none"
            onMouseMove={handleChartMouseMove}
            onTouchMove={handleChartTouchMove}
            style={{ cursor: 'crosshair', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#gradientArea)" />
            <path d={chartPath} fill="none" stroke="var(--accent-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Active Anchor Dot */}
            {activePoint && (
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6"
                fill="var(--text-primary)"
                stroke="#ead7b1"
                strokeWidth="3"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(0,102,255,0.8))',
                  transition: 'all 0.15s ease'
                }}
              />
            )}
          </svg>
        </div>

        {/* Dynamic bottom labels (Weekdays or Hours) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, padding: '0 8px', marginTop: '-20px', marginBottom: '32px' }}>
          {activePoints.map((p, idx) => (
            <span key={idx} style={{ minWidth: '32px', textAlign: 'center' }}>{p.day}</span>
          ))}
        </div>

        <hr style={{ border: 'none', height: '1px', background: 'var(--glass-border)', margin: '0 0 24px 0' }} />

        {/* Clientes por origem (ramo ótica) — atualiza a cada cliente cadastrado */}
        <div className="mobile-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {[
            { label: 'Indicações', count: clientsIndicacao },
            { label: 'Mídia / Tráfego pago', count: clientsMidia },
            { label: 'Passaram na loja', count: clientsLoja },
            { label: 'Outras origens', count: clientsOutras },
          ].map((item, index) => (
            <div key={item.label} style={index < 3 ? { borderRight: '1px solid var(--glass-border)', paddingRight: '20px' } : undefined}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {item.label}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {item.count} {item.count === 1 ? 'cliente' : 'clientes'}
                </span>
                <span style={{ fontSize: '11px', color: item.count > 0 ? '#10b981' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 700 }}>
                  {item.count > 0 && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 15l-6-6-6 6"/></svg>
                  )}
                  {clientShare(item.count).toFixed(1).replace('.', ',')}%
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Bottom Grid: Donut Status + Recent leads */}
      <div className="mobile-stack-grid" style={{ display: 'grid', gridTemplateColumns: '520px 1fr', gap: '32px' }}>

        {/* Left Column: Concentric Donut Status */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '28px', borderRadius: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '32px', height: '100%' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#ead7b1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Nossa Ótica Analytics</span>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px', letterSpacing: '-0.5px' }}>Status dos Clientes</h3>
            </div>
            <Link href="/leads" style={{ fontSize: '13px', color: '#ead7b1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              Detalhes
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', padding: '10px 0', flex: 1 }}>

            {/* Legend grid - Premium Cards */}
            <div className="mobile-kpi-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

              <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', transition: 'all 0.2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00e676' }}></div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Fechado</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{countSuccess}</span>
                  <span style={{ fontSize: '12px', color: '#00e676', fontWeight: 700 }}>{Math.round((countSuccess / (totalLeads || 1)) * 100)}%</span>
                </div>
                {/* Horizontal Progress Bar */}
                <div style={{ height: '4px', background: 'var(--surface-subtle)', borderRadius: '100px', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((countSuccess / (totalLeads || 1)) * 100)}%`, height: '100%', background: '#00e676', borderRadius: '100px' }}></div>
                </div>
              </div>

              <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', transition: 'all 0.2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffb300' }}></div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Agendado</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{countWaiting}</span>
                  <span style={{ fontSize: '12px', color: '#ffb300', fontWeight: 700 }}>{Math.round((countWaiting / (totalLeads || 1)) * 100)}%</span>
                </div>
                {/* Horizontal Progress Bar */}
                <div style={{ height: '4px', background: 'var(--surface-subtle)', borderRadius: '100px', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((countWaiting / (totalLeads || 1)) * 100)}%`, height: '100%', background: '#ffb300', borderRadius: '100px' }}></div>
                </div>
              </div>

              <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', transition: 'all 0.2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00e5ff' }}></div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Em Negoc.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{countProcessing}</span>
                  <span style={{ fontSize: '12px', color: '#00e5ff', fontWeight: 700 }}>{Math.round((countProcessing / (totalLeads || 1)) * 100)}%</span>
                </div>
                {/* Horizontal Progress Bar */}
                <div style={{ height: '4px', background: 'var(--surface-subtle)', borderRadius: '100px', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((countProcessing / (totalLeads || 1)) * 100)}%`, height: '100%', background: '#00e5ff', borderRadius: '100px' }}></div>
                </div>
              </div>

              <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', transition: 'all 0.2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff1744' }}></div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Perdido</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>{countCancel}</span>
                  <span style={{ fontSize: '12px', color: '#ff1744', fontWeight: 700 }}>{Math.round((countCancel / (totalLeads || 1)) * 100)}%</span>
                </div>
                {/* Horizontal Progress Bar */}
                <div style={{ height: '4px', background: 'var(--surface-subtle)', borderRadius: '100px', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((countCancel / (totalLeads || 1)) * 100)}%`, height: '100%', background: '#ff1744', borderRadius: '100px' }}></div>
                </div>
              </div>

            </div>

            {/* Gráfico de Colunas de Status dos Clientes */}
            <div style={{ width: '100%', height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="100%" height="220" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e676" />
                    <stop offset="100%" stopColor="#00b259" />
                  </linearGradient>
                  <linearGradient id="gradWaiting" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffb300" />
                    <stop offset="100%" stopColor="#cc8f00" />
                  </linearGradient>
                  <linearGradient id="gradProcessing" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00e5ff" />
                    <stop offset="100%" stopColor="#00b5cc" />
                  </linearGradient>
                  <linearGradient id="gradCancel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff1744" />
                    <stop offset="100%" stopColor="#cc1236" />
                  </linearGradient>
                </defs>

                {/* Horizontal reference lines */}
                <line x1="0" y1="20" x2="400" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4,4" />
                <line x1="0" y1="70" x2="400" y2="70" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4,4" />
                <line x1="0" y1="120" x2="400" y2="120" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4,4" />
                <line x1="0" y1="170" x2="400" y2="170" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                {/* Background bars for visual depth */}
                <rect x="50" y="10" width="40" height="160" rx="8" fill="#00e676" opacity="0.04" />
                <rect x="140" y="10" width="40" height="160" rx="8" fill="#ffb300" opacity="0.04" />
                <rect x="230" y="10" width="40" height="160" rx="8" fill="#00e5ff" opacity="0.04" />
                <rect x="320" y="10" width="40" height="160" rx="8" fill="#ff1744" opacity="0.04" />

                {/* Bar 1: Fechado (Vibrant Green) */}
                <rect x="50" y={170 - hSuccess} width="40" height={hSuccess} rx="8" fill="url(#gradSuccess)" style={{ transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                {countSuccess > 0 && (
                  <text x="70" y={162 - hSuccess} textAnchor="middle" fill="var(--text-primary)" style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'inherit' }}>
                    {countSuccess}
                  </text>
                )}
                <text x="70" y="195" textAnchor="middle" fill="var(--text-secondary)" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Fech
                </text>

                {/* Bar 2: Agendado (Vibrant Yellow/Amber) */}
                <rect x="140" y={170 - hWaiting} width="40" height={hWaiting} rx="8" fill="url(#gradWaiting)" style={{ transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                {countWaiting > 0 && (
                  <text x="160" y={162 - hWaiting} textAnchor="middle" fill="var(--text-primary)" style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'inherit' }}>
                    {countWaiting}
                  </text>
                )}
                <text x="160" y="195" textAnchor="middle" fill="var(--text-secondary)" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Agend
                </text>

                {/* Bar 3: Em Negoc. (Vibrant Electric Gold/Cyan) */}
                <rect x="230" y={170 - hProcessing} width="40" height={hProcessing} rx="8" fill="url(#gradProcessing)" style={{ transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                {countProcessing > 0 && (
                  <text x="250" y={162 - hProcessing} textAnchor="middle" fill="var(--text-primary)" style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'inherit' }}>
                    {countProcessing}
                  </text>
                )}
                <text x="250" y="195" textAnchor="middle" fill="var(--text-secondary)" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Negoc
                </text>

                {/* Bar 4: Perdido (Vibrant Red) */}
                <rect x="320" y={170 - hCancel} width="40" height={hCancel} rx="8" fill="url(#gradCancel)" style={{ transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                {countCancel > 0 && (
                  <text x="340" y={162 - hCancel} textAnchor="middle" fill="var(--text-primary)" style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'inherit' }}>
                    {countCancel}
                  </text>
                )}
                <text x="340" y="195" textAnchor="middle" fill="var(--text-secondary)" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Perd
                </text>
              </svg>
            </div>

          </div>

        </div>

        {/* Right Column: Recent leads list */}
        <div className="glass-card" style={{
          borderRadius: '24px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--glass-border)',
          position: 'relative',
          overflow: 'hidden'
        }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16.5px', fontWeight: 800, color: 'var(--text-primary)' }}>Clientes Recentes</h3>
            <Link href="/clientes" style={{ fontSize: '12.5px', color: '#ead7b1', fontWeight: 700 }}>
              Ver todos &gt;
            </Link>
          </div>

          <div className="table-scroll">
          <table className="table" style={{ fontSize: '13.5px' }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 0 }}>Cliente</th>
                <th>Origem</th>
                <th>Produto</th>
                <th style={{ textAlign: 'right', paddingRight: 0 }}>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {recentClients.map((client) => (
                <tr key={client.id}>
                  <td style={{ paddingLeft: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{client.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{fmtPhone(client.whatsapp || client.secondary_phone) || 'Sem telefone'}</div>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                      {CLIENT_SOURCE_LABELS[client.source] || client.source}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                      {client.product_interests && client.product_interests.length > 0
                        ? `${PRODUCT_LABELS[client.product_interests[0]] || client.product_interests[0]}${client.product_interests.length > 1 ? ` +${client.product_interests.length - 1}` : ''}`
                        : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {client.created_at ? new Date(client.created_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}

              {recentClients.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px 0' }}>
                    Nenhum cliente cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

        </div>

      </div>

      {/* --- MODAL 1: Lead Details --- */}
      {selectedLead && (
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
            background: 'var(--bg-card)',
            border: '1px solid var(--glass-border-strong)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '550px',
            padding: '32px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>
                  Ficha do Cliente
                </span>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                  {selectedLead.nome}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '20px',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Empresa</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedLead.empresa || 'Não informada'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Segmento</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedLead.segmento || 'Não informado'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>WhatsApp / Telefone</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedLead.telefone || 'Não informado'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>E-mail</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedLead.email || 'Não informado'}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Origem</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{LEAD_ORIGEM_LABELS[selectedLead.origem]}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Valor Comercial</span>
                <span style={{ fontWeight: 700, color: 'var(--status-success)' }}>
                  R$ {selectedLead.valor_estimado ? selectedLead.valor_estimado.toLocaleString('pt-BR') : '0'}
                </span>
              </div>
            </div>

            {/* Quiz Responses */}
            {selectedLead.respostas_quiz && selectedLead.respostas_quiz.length > 0 ? (
              <div style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Respostas do Quiz de Qualificação (Nossa Ótica)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedLead.respostas_quiz.map((resp, i) => (
                    <div key={i} style={{ fontSize: '12.5px' }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{resp.pergunta}</div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginTop: '2px' }}>{resp.resposta}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                background: 'var(--surface-subtle)',
                border: '1px dashed rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '12px'
              }}>
                Cliente cadastrado manualmente ou pelo site.
              </div>
            )}

            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontSize: '13px' }}>Notas Internas</span>
              <p style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                {selectedLead.notas || 'Sem observações adicionais.'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => setSelectedLead(null)}
                style={{
                  background: 'var(--surface-hover)',
                  color: 'var(--text-primary)',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Fechar Ficha
              </button>
              <Link
                href="/leads"
                onClick={() => setSelectedLead(null)}
                style={{
                  background: 'linear-gradient(135deg, #0052cc 0%, #ead7b1 100%)',
                  color: 'var(--text-primary)',
                  borderRadius: '100px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  textAlign: 'center'
                }}
              >
                Ver no Kanban
              </Link>
            </div>

          </div>
        </div>
      )}

      {/* Modal 2: Create Lead removed from Dashboard */}

    </div>
  );
}
