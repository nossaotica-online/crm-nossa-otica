'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './login.module.css';

export default function LoginPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Não revela se o e-mail existe nem detalhes internos do provedor.
      setError('Não foi possível entrar. Verifique suas credenciais e tente novamente.');
      setLoading(false);
    } else {
      localStorage.setItem('nossa-otica-session-started-at', String(Date.now()));
      router.push('/');
      router.refresh();
    }
  };

  const handlePasswordRecovery = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError('Digite seu e-mail para receber o link de recuperação.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}${basePath}/redefinir-senha/`;
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    // Resposta genérica evita revelar se um e-mail está cadastrado.
    setNotice('Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.');
  };

  return (
    <div className={styles.container}>
      <div className={styles.glowOrb}></div>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src={`${basePath}/logo.png`} alt="Logo Nossa Ótica" style={{ width: '260px', maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto 8px' }} />
        </div>
        
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">E-mail</label>
            <input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="seu@email.com"
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password">Senha</label>
            <input 
              id="password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
            />
          </div>
          
          {error && <div className={styles.error}>{error}</div>}
          {notice && <div style={{ color: '#86efac', fontSize: 13, lineHeight: 1.5 }}>{notice}</div>}
          
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <span className={styles.spinner}></span> : 'Entrar no Sistema'}
          </button>
          <button
            type="button"
            onClick={() => void handlePasswordRecovery()}
            disabled={loading}
            style={{ border: 0, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}
          >
            Esqueci minha senha
          </button>
        </form>
        
        <div className={styles.footer}>
          &copy; 2026 Nossa Ótica &mdash; Cuidado com a sua visão
        </div>
      </div>
    </div>
  );
}
