'use client';

import React from 'react';
import {
  ADMIN_ONLY,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  type PermissionKey,
} from '@/lib/permissions';

export interface PermissionState {
  permissoes: PermissionKey[];
  podeExcluir: boolean;
  veTudo: boolean;
  admin: boolean;
}

interface Props {
  value: PermissionState;
  onChange: (next: PermissionState) => void;
}

const linhaBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  padding: '10px 12px',
  borderRadius: '10px',
  cursor: 'pointer',
  border: '1px solid transparent',
};

const tituloBloco: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

/**
 * Lista de marcar o que a pessoa acessa. As telas de administração (Equipe e
 * Configurações) não são marcáveis à toa: elas vêm junto do interruptor de
 * administradora, senão daria para criar alguém que mexe na equipe mas não
 * enxerga cliente nenhum — o que só confunde.
 */
export default function PermissionPicker({ value, onChange }: Props) {
  const telas = PERMISSION_KEYS.filter((chave) => !ADMIN_ONLY.includes(chave));

  const alternarTela = (chave: PermissionKey) => {
    const marcada = value.permissoes.includes(chave);
    onChange({
      ...value,
      permissoes: marcada
        ? value.permissoes.filter((c) => c !== chave)
        : [...value.permissoes, chave],
    });
  };

  const Marcador = ({ ativo }: { ativo: boolean }) => (
    <span
      aria-hidden
      style={{
        width: '18px',
        height: '18px',
        minWidth: '18px',
        marginTop: '1px',
        borderRadius: '5px',
        border: ativo ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border-strong)',
        background: ativo ? 'var(--accent-primary)' : 'transparent',
        color: ativo ? '#0b1220' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 900,
      }}
    >
      ✓
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={tituloBloco}>Telas que esta pessoa vê</span>

        {/* Administradora não tem o que marcar: vê tudo por definição. */}
        {value.admin ? (
          <div style={{
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(201, 169, 110, 0.08)',
            border: '1px solid rgba(201, 169, 110, 0.25)',
            fontSize: '12.5px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}>
            Administradora abre todas as telas, exclui registros e enxerga a loja
            inteira. Desmarque o acesso de administradora abaixo para escolher
            tela por tela.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {telas.map((chave) => {
              const marcada = value.permissoes.includes(chave);
              return (
                <label
                  key={chave}
                  style={{
                    ...linhaBase,
                    background: marcada ? 'var(--surface-subtle)' : 'transparent',
                    borderColor: marcada ? 'var(--glass-border)' : 'transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => alternarTela(chave)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                  />
                  <Marcador ativo={marcada} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {PERMISSION_LABELS[chave].nome}
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {PERMISSION_LABELS[chave].ajuda}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={tituloBloco}>Permissões gerais</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>

          <label style={{ ...linhaBase, opacity: value.admin ? 0.6 : 1 }}>
            <input
              type="checkbox"
              checked={value.admin || value.podeExcluir}
              disabled={value.admin}
              onChange={(e) => onChange({ ...value, podeExcluir: e.target.checked })}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <Marcador ativo={value.admin || value.podeExcluir} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Pode excluir registros
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Sem isso ela cadastra e corrige, mas não apaga cliente, O.S. nem tarefa.
              </span>
            </span>
          </label>

          <label style={{ ...linhaBase, opacity: value.admin ? 0.6 : 1 }}>
            <input
              type="checkbox"
              checked={value.admin || value.veTudo}
              disabled={value.admin}
              onChange={(e) => onChange({ ...value, veTudo: e.target.checked })}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <Marcador ativo={value.admin || value.veTudo} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Enxerga tudo da loja
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Marcado, acha qualquer cliente que entrar na loja. Desmarcado, só
                enxerga o que ela mesma cadastrou.
              </span>
            </span>
          </label>

          <label style={{ ...linhaBase, marginTop: '4px', background: value.admin ? 'rgba(201, 169, 110, 0.08)' : 'transparent', borderColor: value.admin ? 'rgba(201, 169, 110, 0.25)' : 'transparent' }}>
            <input
              type="checkbox"
              checked={value.admin}
              onChange={(e) => onChange({ ...value, admin: e.target.checked })}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <Marcador ativo={value.admin} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Acesso de administradora
              </span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Pode tudo, inclusive criar acessos e mudar estas permissões. Dê
                só para quem é dona ou gerente da loja.
              </span>
            </span>
          </label>

        </div>
      </div>
    </div>
  );
}

/** Resumo curto para o cartão da pessoa na lista da equipe. */
export const resumoPermissoes = (state: PermissionState): string => {
  if (state.admin) return 'Administradora — acesso total';
  if (state.permissoes.length === 0) return 'Nenhuma tela liberada';
  return state.permissoes
    .map((chave) => PERMISSION_LABELS[chave]?.nome)
    .filter(Boolean)
    .join(' · ');
};
