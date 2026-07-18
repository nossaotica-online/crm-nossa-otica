'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from '../login/login.module.css';

export default function ResetPasswordPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [ready, setReady] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      setCheckingLink(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
        setCheckingLink(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError('A senha deve ter no mínimo 12 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError('O link expirou ou não foi possível alterar a senha. Solicite um novo link.');
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    localStorage.removeItem('nossa-otica-session-started-at');
    router.push('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.glowOrb}></div>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src={`${basePath}/logo.png`} alt="Logo Nossa Ótica" style={{ width: 260, maxWidth: '100%', height: 'auto' }} />
        </div>
        {checkingLink ? (
          <div className={styles.error}>Validando o link de recuperação...</div>
        ) : !ready ? (
          <div className={styles.error}>Link inválido ou expirado. Solicite uma nova recuperação na tela de login.</div>
        ) : (
          <form onSubmit={handleReset} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="new-password">Nova senha</label>
              <input id="new-password" type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="confirm-password">Confirmar senha</label>
              <input id="confirm-password" type="password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <span className={styles.spinner}></span> : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
