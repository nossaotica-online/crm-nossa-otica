// Confere quem pode abrir cada tela. Roda sem banco e sem navegador:
// é a mesma tabela de regras que o menu usa (src/lib/permissions.ts).
//
// Uso: node scripts/test-permissions.mjs

// O Node lê o TypeScript direto, então o teste roda contra o arquivo de
// verdade que o menu usa — não contra uma cópia.
const { canAccessRoute, HOME_BY_ROLE } = await import('../src/lib/permissions.ts');

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

console.log('');
if (failures > 0) {
  console.error(`${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log(`OK: ${CASES.length + 1} verificações de acesso passaram.`);
