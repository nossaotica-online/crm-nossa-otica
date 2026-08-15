// Traduz o erro que o banco devolve ao criar um acesso ou salvar permissões.
// Antes qualquer recusa virava "Não foi possível criar o membro da equipe",
// então o motivo real (senha curta, migration faltando, e-mail inválido)
// ficava escondido.

/** Mínimo exigido pelo banco em create_team_member (migration 025). */
export const MIN_PASSWORD_LENGTH = 12;

type SupabaseErrorLike = { code?: string; message?: string };

export const teamMemberErrorMessage = (error: SupabaseErrorLike): string => {
  const message = (error.message || '').trim();

  // Só admin ativo cria acesso — normalmente é sessão caída.
  if (error.code === '42501') {
    return 'Somente uma administradora logada pode criar acessos. Saia e entre de novo no sistema, depois tente outra vez.';
  }

  // A tela já manda a lista de permissões, mas o banco ainda espera o
  // formato antigo (por cargo): a função com esses campos não existe lá.
  // PGRST202 é "não achei função com esses parâmetros", 42703 é "não achei
  // a coluna" — os dois querem dizer a mesma coisa aqui.
  if (error.code === 'PGRST202' || error.code === '42703') {
    return 'O banco ainda não tem a lista de permissões: falta rodar a migration 030 no Supabase.';
  }

  // 22023 são as validações do próprio banco, já escritas em português
  // ("A senha deve ter no mínimo 12 caracteres", "Marque pelo menos uma
  // tela...", "Esta é a única administradora ativa...").
  if (error.code === '22023' && message) return message;

  return message ? `Não foi possível salvar o acesso: ${message}` : 'Não foi possível salvar o acesso.';
};

/** Confere o que dá para conferir antes de incomodar o banco. */
export const validateNewTeamMember = (values: {
  password: string;
  permissoes?: string[];
  admin?: boolean;
}): string | null => {
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres (você digitou ${values.password.length}).`;
  }
  // Um acesso sem nenhuma tela marcada entra no sistema e não vê nada.
  if (!values.admin && values.permissoes && values.permissoes.length === 0) {
    return 'Marque pelo menos uma tela que esta pessoa pode abrir.';
  }
  return null;
};
