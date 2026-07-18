'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCRM } from '@/context/CRMContext';

export default function SettingsPage() {
  const [dbStatus, setDbStatus] = useState<'connected' | 'offline'>('offline');
  const [isMounted, setIsMounted] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
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

    // URLs iCal "secretas" não podem ser protegidas em um site estático.
    // Remove qualquer valor salvo por versões antigas.
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nossaotica_gcal_url');
    }
  }, [team]);

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
              A URL iCal secreta não é mais armazenada no navegador. Em um site estático, qualquer script executado na página poderia lê-la.
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
              Para reativar a sincronização, consuma o iCal em uma Supabase Edge Function ou backend autenticado e entregue ao navegador apenas os eventos necessários.
            </p>
          </div>

        </div>

        <div className="glass-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>Integrações externas</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
            Nenhum webhook público está ativo. A antiga URL <code>webhook-leads</code> não existe e foi removida desta tela para não induzir integrações inseguras.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
            Uma futura integração deve usar Edge Function autenticada, validação de schema, rate limit, CAPTCHA quando pública e idempotência.
          </p>
        </div>

      </div>

    </div>
  );
}
