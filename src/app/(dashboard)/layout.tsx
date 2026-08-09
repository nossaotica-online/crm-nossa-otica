'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import React, { useState, useEffect } from 'react';
import { NAV_ITEMS } from '@/lib/constants';
import { canAccessRoute, HOME_BY_ROLE } from '@/lib/permissions';
import type { UserRole } from '@/types';

// SVG Icons matching the mockup
const getIcon = (iconName: string, active: boolean) => {
  const color = active ? 'var(--text-primary)' : '#8e8e93';

  switch (iconName) {
    case 'dashboard':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="2" />
        </svg>
      );
    case 'leads':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 4H20V6L14 12V18L10 21V12L4 6V4Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'calendar':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
          <path d="M16 2V6" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M8 2V6" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M3 10H21" stroke={color} strokeWidth="2" />
        </svg>
      );
    case 'agendamento':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
          <path d="M12 6V12L16 14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'team':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'os':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="9" y="2" width="6" height="4" rx="1" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 12h6M9 16h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'sales':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2V22" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 5H9.5C8.57065 5 7.67933 5.36875 7.02294 6.02513C6.36656 6.68151 6 7.57283 6 8.5C6 9.42717 6.36656 10.3185 7.02294 10.9749C7.67933 11.6313 8.57065 12 9.5 12H14.5C15.4293 12 16.3207 12.3687 16.9771 13.0251C17.6335 13.6815 18 14.5728 18 15.5C18 16.4272 17.6335 17.3185 16.9771 17.9749C16.3207 18.6313 15.4293 19 14.5 19H6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'goals':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={color} strokeWidth="2" />
        </svg>
      );
    default:
      return null;
  }
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
      } else {
        // Verificar se o perfil está ativo no banco
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('ativo, role')
          .eq('id', session.user.id)
          .single();

        // Antes qualquer erro aqui deslogava — inclusive um tropeço de rede,
        // que tirava a dona do sistema no meio do trabalho. Agora só desloga
        // quando o acesso foi mesmo revogado (perfil sumiu ou está inativo)
        // ou quando a sessão morreu de vez.
        const perfilRevogado = error?.code === 'PGRST116' || (profile && !profile.ativo);
        const sessaoMorta = error?.code === 'PGRST301'
          || /jwt|token/i.test(error?.message || '');

        if (perfilRevogado) {
          console.warn('Perfil inativo ou inexistente. Deslogando...');
          await supabase.auth.signOut();
          router.push('/login');
        } else if (sessaoMorta) {
          router.push('/login');
        } else if (error) {
          // Falha passageira: mantém a tela em pé. O banco continua barrando
          // o que não for permitido, então nada escapa por causa disso.
          console.warn('Não foi possível conferir o perfil agora:', error.message);
          setIsAuthorized(true);
        } else {
          setCurrentRole(profile.role as UserRole);
          setIsAuthorized(true);
        }
      }
    };

    checkAuth();
  }, [router]);

  // A sessão pode morrer com a tela aberta (token que não renova, acesso
  // revogado, logout em outra aba). Antes o CRM continuava mostrando tudo como
  // se estivesse logada e cada botão de salvar falhava calado. Agora o próprio
  // Supabase avisa e a tela vai para o login na hora.
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        setIsAuthorized(false);
        router.replace('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // Quem não pode ver o painel de início cai direto na tela de trabalho dele
  // em vez de bater num aviso de "acesso não autorizado" logo após o login.
  useEffect(() => {
    if (!isAuthorized || !currentRole) return;
    const fallback = HOME_BY_ROLE[currentRole];
    if (fallback && !canAccessRoute(pathname, currentRole)) {
      router.replace(fallback);
    }
  }, [isAuthorized, currentRole, pathname, router]);

  useEffect(() => {
    if (!isAuthorized) return;
    const supabase = createClient();
    const idleTimeout = 30 * 60 * 1000;
    const maxSessionDuration = 12 * 60 * 60 * 1000;
    const now = Date.now();
    let lastActivity = Number(localStorage.getItem('nossa-otica-last-activity')) || now;
    const startedAt = Number(localStorage.getItem('nossa-otica-session-started-at')) || now;
    localStorage.setItem('nossa-otica-last-activity', String(lastActivity));
    localStorage.setItem('nossa-otica-session-started-at', String(startedAt));

    const expireSession = async () => {
      await supabase.auth.signOut();
      localStorage.removeItem('nossa-otica-last-activity');
      localStorage.removeItem('nossa-otica-session-started-at');
      router.replace('/login');
    };
    const markActivity = () => {
      const activityTime = Date.now();
      if (activityTime - lastActivity < 30_000) return;
      lastActivity = activityTime;
      localStorage.setItem('nossa-otica-last-activity', String(activityTime));
    };
    const checkExpiration = () => {
      const checkTime = Date.now();
      if (
        checkTime - lastActivity >= idleTimeout
        || checkTime - startedAt >= maxSessionDuration
      ) {
        void expireSession();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    activityEvents.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));
    const interval = window.setInterval(checkExpiration, 60_000);
    checkExpiration();
    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, markActivity));
      window.clearInterval(interval);
    };
  }, [isAuthorized, router]);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.remove('light-mode');
      document.body.style.backgroundColor = '#0c0c0e';
    } else {
      document.body.classList.add('light-mode');
      document.body.style.backgroundColor = '#f4f5f8';
    }
  }, [darkMode]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileMenuOpen]);

  if (!isAuthorized) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>Verificando acesso...</div>;
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => canAccessRoute(item.href, currentRole));
  const currentRouteAllowed = canAccessRoute(pathname, currentRole);

  return (
    <div className="dashboard-layout">
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setMobileMenuOpen((open) => !open)}
        aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        )}
      </button>
      {mobileMenuOpen && <button type="button" className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu" />}
      {/* Left Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`} style={{
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--glass-border)'
      }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Logo Nossa Ótica */}
          <div style={{
            height: '92px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            marginBottom: '8px'
          }}>
            <img src={`${basePath}/logo.png`} alt="Logo Nossa Ótica" style={{ width: '190px', height: '190px', objectFit: 'contain', flexShrink: 0 }} className="logo-img" />
          </div>

          {/* User Profile Card AT THE TOP (Daniel Wood / Sandro Style) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px',
            borderRadius: '12px',
            background: 'var(--surface-subtle)',
            border: '1px solid var(--glass-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #8f7344 0%, #e6cc9a 100%)', // Cobalt to cyan gradient
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxShadow: 'var(--glow-gold)'
              }}>
                S
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Equipe Nossa Ótica
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-success)' }}></span>
                </span>
                <span style={{ fontSize: '10px', color: '#8e8e93' }}>Atendimento</span>
              </div>
            </div>

            {/* Options arrow */}
            <button style={{ color: '#8e8e93', padding: '2px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          {/* Search bar inside the sidebar (capsule shape) */}
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8e8e93' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar no painel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 12px 10px 34px',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                outline: 'none',
                transition: 'all 0.15s ease'
              }}
            />
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} style={{
                  padding: '11px 14px',
                  borderRadius: '8px',
                  color: isActive ? 'var(--text-primary)' : '#8e8e93',
                  background: isActive ? 'rgba(201, 169, 110, 0.15)' : 'transparent', // Cobalt gold background opacity
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textDecoration: 'none',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '13px',
                  transition: 'all 0.15s ease',
                  borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  paddingLeft: isActive ? '11px' : '14px' // Adjust padding due to border
                }}>
                  {getIcon(item.icon, isActive)}
                  <span>{item.label}</span>
                </Link>
              );
            })}



          </nav>
        </div>

        {/* Footer Area: Dual Light/Dark Button Control (Exactly like mockup) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {currentRole === 'admin' && <Link href="/configuracoes" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '12.5px',
            color: '#8e8e93',
            textDecoration: 'none',
            padding: '8px 14px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
            <span>Suporte & Ajuda</span>
          </Link>}

          <button
            type="button"
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              localStorage.removeItem('nossa-otica-last-activity');
              localStorage.removeItem('nossa-otica-session-started-at');
              router.replace('/login');
            }}
            style={{ background: 'transparent', border: 0, color: '#fca5a5', padding: '8px 14px', textAlign: 'left', cursor: 'pointer', fontSize: '12.5px' }}
          >
            Sair com segurança
          </button>

          {/* Dual Toggle Control side-by-side capsule buttons */}
          <div style={{
            background: 'var(--bg-tertiary)',
            padding: '3px',
            borderRadius: '100px',
            display: 'flex',
            border: '1px solid var(--glass-border)'
          }}>
            <button
              onClick={() => setDarkMode(false)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: !darkMode ? 'var(--bg-card)' : 'transparent',
                color: !darkMode ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: !darkMode ? '1px solid var(--glass-border-strong)' : '1px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              Claro
            </button>
            <button
              onClick={() => setDarkMode(true)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: darkMode ? 'var(--bg-card)' : 'transparent',
                color: darkMode ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: darkMode ? '1px solid var(--glass-border-strong)' : '1px solid transparent',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              Escuro
            </button>
          </div>

        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content" style={{ marginLeft: 'var(--sidebar-width)', flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
        {currentRouteAllowed ? children : (
          <div style={{ padding: 40, color: 'var(--text-primary)' }}>
            <h1>Acesso não autorizado</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Sua função não permite acessar esta área.</p>
          </div>
        )}
      </main>

      {/* Bottom navigation — aparência de app no celular */}
      <nav className="mobile-bottom-nav" aria-label="Navegação principal">
        {[
          { label: 'Início', href: '/', icon: 'dashboard' },
          { label: 'Clientes', href: '/clientes', icon: 'leads' },
          { label: 'Agenda', href: '/calendario', icon: 'calendar' },
          { label: 'O.S.', href: '/ordens', icon: 'sales' },
        ].filter((item) => canAccessRoute(item.href, currentRole)).map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`bottom-nav-item ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              {getIcon(item.icon, isActive)}
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button type="button" className="bottom-nav-item" onClick={() => setMobileMenuOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          <span>Mais</span>
        </button>
      </nav>
    </div>
  );
}
