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

  const semMigration = teamMemberErrorMessage(
    { code: '22023', message: 'Função inválida' }, 'funcionario');
  check('explica a migration 029 faltando',
    semMigration.includes('029') && semMigration.toLowerCase().includes('balcão'), semMigration);

  const semMigrationOutraRole = teamMemberErrorMessage(
    { code: '22023', message: 'Função inválida' }, 'vendedor');
  check('não cita a 029 para outras funções', !semMigrationOutraRole.includes('029'), semMigrationOutraRole);

  const semPermissao = teamMemberErrorMessage(
    { code: '42501', message: 'Apenas administradores ativos podem criar membros' }, 'vendedor');
  check('sessão caída sugere entrar de novo',
    /entre de novo|login/i.test(semPermissao), semPermissao);

  const semFuncao = teamMemberErrorMessage(
    { code: 'PGRST202', message: 'Could not find the function public.create_team_member' }, 'vendedor');
  check('banco sem a função pede as migrations', semFuncao.toLowerCase().includes('migration'), semFuncao);

  const emailDuplicado = teamMemberErrorMessage(
    { code: '23505', message: 'duplicate key value violates unique constraint' }, 'vendedor');
  check('erro desconhecido ainda mostra o texto do banco',
    emailDuplicado.includes('duplicate key'), emailDuplicado);

  const semMensagem = teamMemberErrorMessage({}, 'vendedor');
  check('erro sem texto não vira "undefined"',
    !semMensagem.includes('undefined') && semMensagem.length > 0, semMensagem);
}

console.log('');
if (failures > 0) {
  console.error(`${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('OK: a recusa ao criar acesso sempre diz o motivo real.');
