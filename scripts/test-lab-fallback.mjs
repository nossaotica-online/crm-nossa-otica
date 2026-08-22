// Confere que a O.S. não perde campo quando o banco está com só uma parte das
// migrations aplicada (foi exatamente o que aconteceu: 026 aplicada, 027 e 028
// não, e o nome do laboratório sumia). Vale para toda coluna que chegou depois
// — as do laboratório e a altura de montagem (031).
//
// Roda sem banco: um `write` de mentira recusa as colunas que não existem, com
// as mesmas mensagens que o Supabase devolveu de verdade.
//
// Uso: node scripts/test-lab-fallback.mjs

// O Node lê o TypeScript direto, então o teste roda contra o arquivo de
// verdade que o app usa — não contra uma cópia.
const {
  writeDroppingMissingColumns,
  missingColumnsNotice,
  missingColumnFrom,
} = await import('../src/lib/optional-columns.ts');

// Banco de mentira: aceita só as colunas listadas em `existing`.
const fakeDatabase = (existing) => {
  const attempts = [];
  const write = async (body) => {
    attempts.push({ ...body });
    const missing = Object.keys(body).find((column) => !existing.includes(column));
    if (missing) {
      // Mensagem idêntica à que o Supabase da ótica devolveu.
      return { data: null, error: { message: `column service_orders.${missing} does not exist` } };
    }
    return { data: { id: 'os-1', ...body }, error: null };
  };
  return { write, attempts };
};

const BASE = { client_name: 'Maria', laboratory: 'Hoya', lab_sent_date: '2026-08-01', lab_due_date: '2026-08-10' };
const BASE_COM_ALTURA = { ...BASE, dnp: '31/31', altura: '21/21' };
let failures = 0;

const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FALHOU ${name} ${detail}`);
  }
};

// 1. O caso da ótica hoje: 026 aplicada, 027 e 028 não.
{
  const { write } = fakeDatabase(['client_name', 'laboratory']);
  const { result, droppedColumns } = await writeDroppingMissingColumns(write, BASE);
  check('salva com 027/028 faltando', result.error === null);
  check('mantém o laboratório', result.data?.laboratory === 'Hoya', `obtido=${result.data?.laboratory}`);
  check('descarta só as duas datas',
    droppedColumns.sort().join(',') === 'lab_due_date,lab_sent_date', `obtido=${droppedColumns}`);
  const aviso = missingColumnsNotice(droppedColumns);
  check('aviso cita as migrations que faltam',
    aviso.includes('027') && aviso.includes('028') && !aviso.includes('026'), aviso);
}

// 2. Banco completo: nada é descartado e não há retentativa.
{
  const { write, attempts } = fakeDatabase(Object.keys(BASE));
  const { result, droppedColumns } = await writeDroppingMissingColumns(write, BASE);
  check('banco completo salva tudo', result.error === null && droppedColumns.length === 0);
  check('banco completo grava numa tentativa só', attempts.length === 1, `tentativas=${attempts.length}`);
  check('banco completo não mostra aviso', missingColumnsNotice(droppedColumns) === '');
}

// 3. Banco sem nenhuma coluna de laboratório: salva a O.S. mesmo assim.
{
  const { write } = fakeDatabase(['client_name']);
  const { result, droppedColumns } = await writeDroppingMissingColumns(write, BASE);
  check('sem 026/027/028 ainda salva a O.S.', result.error === null);
  check('descarta os três campos', droppedColumns.length === 3, `obtido=${droppedColumns}`);
}

// 4. Erro que não é coluna faltando (ex.: RLS) não vira retentativa infinita
//    nem some com dado — a mensagem do banco tem que chegar na tela.
{
  const attempts = [];
  const write = async (body) => {
    attempts.push(body);
    return { data: null, error: { message: 'new row violates row-level security policy for table "service_orders"' } };
  };
  const { result, droppedColumns } = await writeDroppingMissingColumns(write, BASE);
  check('erro de permissão não é mascarado', result.error !== null && droppedColumns.length === 0);
  check('erro de permissão tenta uma vez só', attempts.length === 1, `tentativas=${attempts.length}`);
}

// 5. Banco sem a coluna da altura (031 ainda não rodada): a O.S. salva e a
//    tela avisa qual migration falta, sem perder DNP nem laboratório.
{
  const { write } = fakeDatabase(['client_name', 'laboratory', 'lab_sent_date', 'lab_due_date', 'dnp']);
  const { result, droppedColumns } = await writeDroppingMissingColumns(write, BASE_COM_ALTURA);
  check('salva a O.S. sem a coluna da altura', result.error === null);
  check('descarta só a altura', droppedColumns.join(',') === 'altura', `obtido=${droppedColumns}`);
  check('mantém a DNP e o laboratório', result.data?.dnp === '31/31' && result.data?.laboratory === 'Hoya');
  const aviso = missingColumnsNotice(droppedColumns);
  check('aviso da altura cita a migration 031', aviso.includes('altura') && aviso.includes('031'), aviso);
}

// 6. Banco completo com a altura: nada é descartado.
{
  const { write, attempts } = fakeDatabase(Object.keys(BASE_COM_ALTURA));
  const { result, droppedColumns } = await writeDroppingMissingColumns(write, BASE_COM_ALTURA);
  check('com a 031 aplicada, a altura é gravada', result.data?.altura === '21/21', `obtido=${result.data?.altura}`);
  check('com a 031 aplicada, grava numa tentativa só', droppedColumns.length === 0 && attempts.length === 1);
}

// 7. As duas formas de mensagem do PostgREST são reconhecidas.
check('lê "column ... does not exist"',
  missingColumnFrom('column service_orders.lab_sent_date does not exist') === 'lab_sent_date');
check('lê "Could not find the ... column"',
  missingColumnFrom("Could not find the 'lab_due_date' column of 'service_orders' in the schema cache") === 'lab_due_date');
check('ignora mensagem sem coluna', missingColumnFrom('permission denied for table service_orders') === null);

console.log('');
if (failures > 0) {
  console.error(`${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('OK: a O.S. só descarta a coluna que o banco realmente não tem.');
