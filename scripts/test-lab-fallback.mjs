// Confere que a O.S. não perde o laboratório quando o banco está com só uma
// parte das migrations do laboratório aplicada (foi exatamente o que aconteceu:
// 026 aplicada, 027 e 028 não, e o nome do laboratório sumia).
//
// Roda sem banco: um `write` de mentira recusa as colunas que não existem, com
// as mesmas mensagens que o Supabase devolveu de verdade.
//
// Uso: node scripts/test-lab-fallback.mjs

// O Node lê o TypeScript direto, então o teste roda contra o arquivo de
// verdade que o app usa — não contra uma cópia.
const {
  writeDroppingMissingLabColumns,
  missingLabColumnsNotice,
  missingColumnFrom,
} = await import('../src/lib/lab-columns.ts');

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
  const { result, droppedColumns } = await writeDroppingMissingLabColumns(write, BASE);
  check('salva com 027/028 faltando', result.error === null);
  check('mantém o laboratório', result.data?.laboratory === 'Hoya', `obtido=${result.data?.laboratory}`);
  check('descarta só as duas datas',
    droppedColumns.sort().join(',') === 'lab_due_date,lab_sent_date', `obtido=${droppedColumns}`);
  const aviso = missingLabColumnsNotice(droppedColumns);
  check('aviso cita as migrations que faltam',
    aviso.includes('027') && aviso.includes('028') && !aviso.includes('026'), aviso);
}

// 2. Banco completo: nada é descartado e não há retentativa.
{
  const { write, attempts } = fakeDatabase(Object.keys(BASE));
  const { result, droppedColumns } = await writeDroppingMissingLabColumns(write, BASE);
  check('banco completo salva tudo', result.error === null && droppedColumns.length === 0);
  check('banco completo grava numa tentativa só', attempts.length === 1, `tentativas=${attempts.length}`);
  check('banco completo não mostra aviso', missingLabColumnsNotice(droppedColumns) === '');
}

// 3. Banco sem nenhuma coluna de laboratório: salva a O.S. mesmo assim.
{
  const { write } = fakeDatabase(['client_name']);
  const { result, droppedColumns } = await writeDroppingMissingLabColumns(write, BASE);
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
  const { result, droppedColumns } = await writeDroppingMissingLabColumns(write, BASE);
  check('erro de permissão não é mascarado', result.error !== null && droppedColumns.length === 0);
  check('erro de permissão tenta uma vez só', attempts.length === 1, `tentativas=${attempts.length}`);
}

// 5. As duas formas de mensagem do PostgREST são reconhecidas.
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
console.log('OK: a O.S. só descarta o campo de laboratório que o banco não tem.');
