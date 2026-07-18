'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Mantém detalhes técnicos fora da interface. Em produção, conecte aqui
    // um coletor de erros que remova dados pessoais antes do envio.
    console.error('Falha inesperada na interface', error.digest || error.name);
  }, [error]);

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: 24,
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}>
      <section style={{ maxWidth: 520, textAlign: 'center' }}>
        <h1>Não foi possível carregar esta tela</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Tente novamente. Se o problema continuar, saia e entre novamente.
        </p>
        <button type="button" onClick={reset}>
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
