'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// Caixa de confirmação usada em tudo que apaga alguma coisa no sistema.
// Substitui o confirm() do navegador: a pergunta aparece dentro do CRM, com
// o mesmo visual das outras telas, e o botão perigoso fica em vermelho.

export type ConfirmOptions = {
  /** Título curto, ex.: "Excluir cliente?" */
  title?: string;
  /** O que exatamente vai acontecer. */
  message: string;
  /** Texto do botão que confirma. Padrão: "Sim, excluir". */
  confirmLabel?: string;
  /** Texto do botão que desiste. Padrão: "Cancelar". */
  cancelLabel?: string;
  /** 'danger' (padrão) pinta o botão de vermelho; 'neutral' usa o dourado. */
  tone?: 'danger' | 'neutral';
};

const DEFAULT_TITLE = 'Tem certeza?';
const DEFAULT_CONFIRM = 'Sim, excluir';
const DEFAULT_CANCEL = 'Cancelar';

/**
 * Devolve `confirm(...)` (uma Promise que responde true/false) e o
 * `confirmDialog` que a página precisa renderizar uma única vez.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ message: 'Excluir a meta?' }))) return;
 *   ...
 *   return <>{conteúdo}{confirmDialog}</>;
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((input: ConfirmOptions | string) => {
    setOptions(typeof input === 'string' ? { message: input } : input);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOptions(null);
    resolve?.(confirmed);
  }, []);

  const confirmDialog = options ? (
    <ConfirmDialog
      {...options}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null;

  return { confirm, confirmDialog };
}

type ConfirmDialogProps = ConfirmOptions & {
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title = DEFAULT_TITLE,
  message,
  confirmLabel = DEFAULT_CONFIRM,
  cancelLabel = DEFAULT_CANCEL,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const accent = tone === 'danger' ? '#ef4444' : 'var(--accent-primary)';
  const confirmTextColor = tone === 'danger' ? '#ffffff' : 'var(--text-on-accent)';

  // Esc desiste; o foco começa no botão de confirmar para dar pra responder
  // sem tirar a mão do teclado.
  useEffect(() => {
    confirmButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border-strong)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            aria-hidden="true"
            style={{
              width: '38px',
              height: '38px',
              flexShrink: 0,
              borderRadius: '50%',
              background: tone === 'danger' ? 'rgba(239, 68, 68, 0.12)' : 'var(--accent-subtle)',
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 800,
            }}
          >
            !
          </span>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h2>
        </div>

        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 18px',
              background: 'var(--surface-subtle)',
              color: 'var(--text-primary)',
              border: '1px solid var(--glass-border-strong)',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            ref={confirmButtonRef}
            onClick={onConfirm}
            style={{
              padding: '10px 18px',
              background: accent,
              color: confirmTextColor,
              border: `1px solid ${accent}`,
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
