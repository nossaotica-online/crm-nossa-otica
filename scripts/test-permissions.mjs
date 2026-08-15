// Confere quem pode abrir cada tela. Roda sem banco e sem navegador:
// é a mesma tabela de regras que o menu usa (src/lib/permissions.ts).
//
// Uso: node scripts/test-permissions.mjs

// O Node lê o TypeScript direto, então o teste roda contra o arquivo de
// verdade que o menu usa — não contra uma cópia.
const { canAccessRoute, HOME_BY_ROLE, homeRouteFor } = await import('../src/lib/permissions.ts');

// [rota, função, pode?]
const CASES = [
  // O funcionário de balcão: só O.S., Clientes, Calendário.
  ['/ordens', 'funcionario', true],
  ['/clientes', 'funcionario', true],
  ['/calendario', 'funcionario', true],
  ['/', 'funcionario', false],
  ['/vendas', 'funcionario', false],
  ['/leads', 'funcionario', false],
  ['/metas', 'funcionario', false],
  ['/equipe', 'funcionario', false],
  ['/configuracoes', 'funcionario', false],

  // Quem já existia não pode perder acesso.
  ['/', 'admin', true],
  ['/vendas', 'admin', true],
  ['/metas', 'admin', true],
  ['/equipe', 'admin', true],
  ['/configuracoes', 'admin', true],
  ['/', 'gestor', true],
  ['/vendas', 'gestor', true],
  ['/metas', 'gestor', true],
  ['/equipe', 'gestor', false],
  ['/', 'vendedor', true],
  ['/vendas', 'vendedor', true],
  ['/ordens', 'vendedor', true],
  ['/metas', 'vendedor', false],
  ['/equipe', 'vendedor', false],
  ['/', 'consultor', true],
  ['/clientes', 'consultor', true],

  // Sem função definida, nada de tela restrita.
  ['/', null, false],
  ['/metas', null, false],
  ['/ordens', null, true],
];

let failures = 0;

for (const [route, role, expected] of CASES) {
  const actual = canAccessRoute(route, role);
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FALHOU'} ${String(role).padEnd(12)} ${route.padEnd(16)} ` +
    `esperado=${expected} obtido=${actual}`,
  );
}

// Quem não pode ver o painel precisa ter uma tela inicial própria, senão cai
// no aviso de "acesso não autorizado" logo depois de entrar.
const home = HOME_BY_ROLE.funcionario;
if (home !== '/ordens' || !canAccessRoute(home, 'funcionario')) {
  failures += 1;
  console.log(`FALHOU tela inicial do funcionário: ${home}`);
} else {
  console.log(`PASS  funcionário entra direto em ${home}`);
}

// ------------------------------------------------------------
// Depois da migration 030: acesso pela lista marcada, não pelo cargo.
// ------------------------------------------------------------
let marcados = 0;
const checkMarcado = (nome, condicao, detalhe = '') => {
  marcados += 1;
  if (condicao) return console.log(`PASS  ${nome}`);
  failures += 1;
  console.log(`FALHOU ${nome} ${detalhe}`);
};

// O caso que a dona pediu: clientes, O.S. e calendário, sem dinheiro.
const balcao = {
  role: 'funcionario',
  permissoes: ['clientes', 'ordens', 'calendario'],
};
checkMarcado('marcado abre Clientes', canAccessRoute('/clientes', balcao));
checkMarcado('marcado abre O.S.', canAccessRoute('/ordens', balcao));
checkMarcado('marcado abre Calendário', canAccessRoute('/calendario', balcao));
checkMarcado('não marcado NÃO abre Orçamentos', !canAccessRoute('/vendas', balcao));
checkMarcado('não marcado NÃO abre Metas', !canAccessRoute('/metas', balcao));
checkMarcado('não marcado NÃO abre o painel', !canAccessRoute('/', balcao));
checkMarcado('Equipe nunca sai na marcação', !canAccessRoute('/equipe', balcao));
checkMarcado('Configurações nunca sai na marcação', !canAccessRoute('/configuracoes', balcao));
checkMarcado('sub-rota segue a tela mãe', canAccessRoute('/clientes/123', balcao));
checkMarcado('entra direto na primeira tela liberada',
  homeRouteFor(balcao) === '/clientes', homeRouteFor(balcao));

// Marcar Orçamentos passa a liberar de verdade.
const comDinheiro = { role: 'funcionario', permissoes: ['clientes', 'vendas'] };
checkMarcado('marcar Orçamentos libera Orçamentos', canAccessRoute('/vendas', comDinheiro));

// Administradora não depende de marcação nenhuma.
const admin = { role: 'admin', permissoes: [] };
checkMarcado('administradora abre Equipe', canAccessRoute('/equipe', admin));
checkMarcado('administradora abre o painel', canAccessRoute('/', admin));
checkMarcado('administradora abre Configurações', canAccessRoute('/configuracoes', admin));

// Lista vazia: entra e não vê nada — e não adianta mandar para lugar nenhum.
const semNada = { role: 'funcionario', permissoes: [] };
checkMarcado('sem marcação não abre nada', !canAccessRoute('/clientes', semNada));
checkMarcado('sem marcação não tem tela inicial', homeRouteFor(semNada) === null);

console.log('');
if (failures > 0) {
  console.error(`${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log(`OK: ${CASES.length + 1 + marcados} verificações de acesso passaram.`);
