// Confere que a tela de Equipe mostra o motivo real da recusa, em vez do
// genérico "Não foi possível criar o membro da equipe" — que foi o que
// apareceu quando a senha tinha 4 caracteres e a migration 029 faltava.
//
// Uso: node scripts/test-team-errors.mjs

const {
  teamMemberErrorMessage,
  validateNewTeamMember,
  MIN_PASSWORD_LENGTH,
} = await import('../src/lib/team-errors.ts');

let failures = 0;
const check = (nome, condicao, detalhe = '') => {
  if (condicao) return console.log(`PASS  ${nome}`);
  failures += 1;
  console.log(`FALHOU ${nome} ${detalhe}`);
};

// Senha curta: barrada antes de ir ao banco, dizendo quanto falta.
{
  const erro = validateNewTeamMember({ password: 'loja' });
  check('senha de 4 caracteres é barrada', erro !== null);
  check('diz o mínimo e o que foi digitado',
    erro.includes(String(MIN_PASSWORD_LENGTH)) && erro.includes('4'), erro);
  check('senha de 12 caracteres passa',
    validateNewTeamMember({ password: 'a'.repeat(MIN_PASSWORD_LENGTH) }) === null);
}

// Mensagens do banco chegam inteiras à tela.
{
  const senhaCurta = teamMemberErrorMessage(
    { code: '22023', message: 'A senha deve ter no mínimo 12 caracteres' }, 'funcionario');
  check('repassa a validação do banco', senhaCurta.includes('12 caracteres'), senhaCurta);

  const semTela = teamMemberErrorMessage(
    { code: '22023', message: 'Marque pelo menos uma tela que esta pessoa pode abrir' });
  check('repassa o aviso de nenhuma tela marcada', semTela.includes('pelo menos uma tela'), semTela);

  const ultimaAdmin = teamMemberErrorMessage(
    { code: '22023', message: 'Esta é a única administradora ativa: tirar o acesso de administradora trancaria todo mundo para fora' });
  check('repassa a trava da última administradora',
    ultimaAdmin.includes('única administradora'), ultimaAdmin);

  const semPermissao = teamMemberErrorMessage(
    { code: '42501', message: 'Apenas administradores ativos podem criar membros' });
  check('sessão caída sugere entrar de novo',
    /entre de novo|login/i.test(semPermissao), semPermissao);

  // A tela manda a lista de permissões; um banco sem a 030 devolve
  // "função não encontrada" (assinatura antiga) ou "coluna não existe".
  const semFuncao = teamMemberErrorMessage(
    { code: 'PGRST202', message: 'Could not find the function public.create_team_member' });
  check('banco sem a 030 pede a migration',
    semFuncao.includes('030') && semFuncao.toLowerCase().includes('migration'), semFuncao);

  const semColuna = teamMemberErrorMessage(
    { code: '42703', message: 'column profiles.permissoes does not exist' });
  check('coluna faltando também aponta a 030', semColuna.includes('030'), semColuna);

  const emailDuplicado = teamMemberErrorMessage(
    { code: '23505', message: 'duplicate key value violates unique constraint' });
  check('erro desconhecido ainda mostra o texto do banco',
    emailDuplicado.includes('duplicate key'), emailDuplicado);

  const semMensagem = teamMemberErrorMessage({});
  check('erro sem texto não vira "undefined"',
    !semMensagem.includes('undefined') && semMensagem.length > 0, semMensagem);
}

// A lista de marcar: acesso sem nenhuma tela é barrado antes do banco.
{
  const senhaOk = 'a'.repeat(MIN_PASSWORD_LENGTH);
  check('sem tela marcada é barrado',
    validateNewTeamMember({ password: senhaOk, permissoes: [], admin: false }) !== null);
  check('administradora não precisa marcar tela',
    validateNewTeamMember({ password: senhaOk, permissoes: [], admin: true }) === null);
  check('uma tela marcada já passa',
    validateNewTeamMember({ password: senhaOk, permissoes: ['ordens'], admin: false }) === null);
}

console.log('');
if (failures > 0) {
  console.error(`${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('OK: a recusa ao criar acesso sempre diz o motivo real.');
