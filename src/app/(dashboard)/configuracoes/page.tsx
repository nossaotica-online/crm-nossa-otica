'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCRM } from '@/context/CRMContext';

export default function SettingsPage() {
  const [dbStatus, setDbStatus] = useState<'connected' | 'offline'>('offline');
  const [isMounted, setIsMounted] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [gcalUrl, setGcalUrl] = useState('');
  const { team } = useCRM();

  useEffect(() => {
    setIsMounted(true);
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setDbStatus('connected');
        setUserEmail(session.user.email || '');
        const profile = team.find(p => p.id === session.user.id);
        const metaName = session.user.user_metadata?.nome || session.user.user_metadata?.name || '';
        setUserName(profile?.nome || metaName || 'Equipe Nossa Ótica');
      }
    };
    fetchUser();

    // Load gcal url
    if (typeof window !== 'undefined') {
      setGcalUrl(localStorage.getItem('nossaotica_gcal_url') || '');
    }
  }, [team]);

  const saveGcalUrl = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nossaotica_gcal_url', gcalUrl);
      alert('URL do Google Agenda salva com sucesso! Os eventos serão sincronizados no Calendário.');
      window.location.reload();
    }
  };

  if (!isMounted) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Nossa Ótica CRM</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Configurações</h1>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Header */}
      <div>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Nossa Ótica CRM</span>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>Configurações</h1>
      </div>

      <div className="mobile-stack-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>

        {/* Left Column: Supabase & System Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Supabase Status Card */}
          <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Banco de Dados (Supabase)</h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: dbStatus === 'connected' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)', border: dbStatus === 'connected' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dbStatus === 'connected' ? '#10b981' : '#f59e0b', boxShadow: dbStatus === 'connected' ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none' }}></span>
              <span style={{ fontSize: '13px', color: dbStatus === 'connected' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                {dbStatus === 'connected' ? 'Conectado à Nuvem (Online)' : 'Executando localmente no Frontend (Simulado)'}
              </span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              O CRM está conectado ao seu banco de dados na nuvem com autenticação segura e leitura em tempo real.
            </p>
          </div>

          {/* User profile */}
          <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Perfil do Administrador</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Nome Completo</span>
                <input
                  type="text"
                  disabled
                  value={userName || 'Carregando...'}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>E-mail Administrativo</span>
                <input
                  type="email"
                  disabled
                  value={userEmail || 'Carregando...'}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Google Calendar Integration */}
          <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Integração com Google Agenda</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Cole abaixo o "Endereço secreto em formato iCal" do seu Google Agenda para espelhar os eventos diretamente no CRM.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="url"
                placeholder="https://calendar.google.com/calendar/ical/..."
                value={gcalUrl}
                onChange={(e) => setGcalUrl(e.target.value)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', padding: '10px 14px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', width: '100%' }}
              />
              <button
                onClick={saveGcalUrl}
                style={{ background: 'var(--accent-primary)', color: 'var(--text-primary)', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
              >
                Salvar Sincronização
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Webhook Integration for external Quiz & Site */}
        <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Integração do Quiz e Site</h3>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
            Para enviar automaticamente as respostas do seu <strong>formulário de atendimento</strong> ou formulário do <strong>site da Nossa Ótica</strong> para o banco, você fará uma requisição POST para a sua <strong>Supabase Edge Function</strong>:
          </p>

          <div style={{ background: 'var(--bg-tertiary)', padding: '14px', borderRadius: '12px', fontSize: '12.5px', fontFamily: 'monospace', color: 'var(--accent-primary)', marginBottom: '20px', border: '1px solid var(--glass-border)', fontWeight: 700 }}>
            POST {process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhook-leads
          </div>

          <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>Exemplo de Código JS (Fetch):</h4>

          <div style={{
            background: 'var(--bg-tertiary)',
            padding: '16px',
            borderRadius: '12px',
            fontSize: '11.5px',
            fontFamily: 'monospace',
            color: 'var(--text-secondary)',
            overflowX: 'auto',
            border: '1px solid var(--glass-border)',
            maxHeight: '260px',
            lineHeight: '1.5'
          }}>
            {`fetch('${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/webhook-leads', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    nome: 'Maria da Silva',
    email: 'maria@email.com',
    telefone: '(11) 99999-8888',
    origem: 'site',
    respostas_quiz: [
      { pergunta: 'Usa óculos?', resposta: 'Sim, para perto' },
      { pergunta: 'Última consulta?', resposta: 'Há mais de 2 anos' }
    ]
  })
})
.then(res => res.json())
.then(data => console.log('Cliente salvo:', data));`}
          </div>
        </div>

      </div>

    </div>
  );
}
