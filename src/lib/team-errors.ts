// Traduz o erro que o banco devolve ao criar um acesso. Antes qualquer recusa
// virava "Não foi possível criar o membro da equipe", então o motivo real
// (senha curta, migration faltando, e-mail inválido) ficava escondido.

/** Mínimo exigido pelo banco em create_team_member (migration 025). */
export const MIN_PASSWORD_LENGTH = 12;

type SupabaseErrorLike = { code?: string; message?: string };

export const teamMemberErrorMessage = (error: SupabaseErrorLike, role: string): string => {
  const message = (error.message || '').trim();

  // Só admin ativo cria acesso — normalmente é sessão caída.
  if (error.code === '42501') {
    return 'Somente uma administradora logada pode criar acessos. Saia e entre de novo no sistema, depois tente outra vez.';
  }

  // A função existe no app mas ainda não no banco.
  if (/fun[çc][ãa]o inv[áa]lida/i.test(message)) {
    return role === 'funcionario'
      ? 'O acesso "Funcionário de balcão" ainda não existe no banco: falta rodar a migration 029 no Supabase.'
      : 'Essa função de acesso não existe no banco.';
  }

  // Nem o create_team_member existe: banco muito atrás das migrations.
  if (error.code === 'PGRST202') {
    return 'O banco ainda não tem a função que cria acessos. Rode as migrations pendentes no Supabase.';
  }

  // 22023 são as validações do próprio banco, já escritas em português
  // ("A senha deve ter no mínimo 12 caracteres", "E-mail inválido"...).
  if (error.code === '22023' && message) return message;

  return message ? `Não foi possível criar o acesso: ${message}` : 'Não foi possível criar o acesso.';
};

/** Confere o que dá para conferir antes de incomodar o banco. */
export const validateNewTeamMember = (values: { password: string }): string | null => {
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres (você digitou ${values.password.length}).`;
  }
  return null;
};
