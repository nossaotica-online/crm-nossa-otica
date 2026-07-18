import { readFileSync } from 'node:fs';

const TABLES = [
  'profiles',
  'leads',
  'bookings',
  'sales',
  'goals',
  'tasks',
  'clients',
  'service_orders',
  'activities',
  'notifications',
  'schedule_config',
  'services',
  'family_groups',
  'family_relationships',
  'client_prescriptions',
  'audit_logs',
];

function readLocalEnvironment() {
  try {
    return Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((line) => line && !line.trimStart().startsWith('#'))
        .map((line) => {
          const separator = line.indexOf('=');
          return [line.slice(0, separator), line.slice(separator + 1)];
        }),
    );
  } catch {
    return {};
  }
}

const localEnvironment = readLocalEnvironment();
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL
  || localEnvironment.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || localEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    'Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

if (publishableKey.startsWith('sb_secret_')) {
  throw new Error('Recusado: uma secret/service_role key nunca deve ser usada neste teste.');
}

const headers = {
  apikey: publishableKey,
  // A publishable/anon key identifica o role anon; isto não é uma sessão.
  Authorization: `Bearer ${publishableKey}`,
  'Content-Type': 'application/json',
};

const noMatchId = '00000000-0000-0000-0000-000000000000';

async function request(table, method) {
  const query = method === 'GET'
    ? '?select=id&limit=1'
    : `?id=eq.${noMatchId}`;
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method,
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
    body: method === 'GET' || method === 'DELETE'
      ? undefined
      : JSON.stringify(method === 'POST' ? {} : { id: noMatchId }),
  });
  const body = await response.text();

  if (method === 'GET' && response.status === 200) {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error(`${table} GET retornou conteúdo inesperado.`);
    }
    if (Array.isArray(parsed) && parsed.length === 0) {
      return '200 vazio (RLS)';
    }
    throw new Error(`${table} GET expôs ao menos uma linha para anon.`);
  }

  if (response.status === 401 || response.status === 403) {
    return `${response.status} negado`;
  }

  throw new Error(
    `${table} ${method} retornou HTTP ${response.status}; esperado 401/403`
    + (method === 'GET' ? ' ou 200 com []' : ''),
  );
}

let failures = 0;
for (const table of TABLES) {
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    try {
      const result = await request(table, method);
      console.log(`PASS ${table.padEnd(22)} ${method.padEnd(6)} ${result}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${table.padEnd(22)} ${method.padEnd(6)} ${error.message}`);
    }
  }
}

if (failures > 0) {
  console.error(`\nFalha: ${failures} verificação(ões) anônima(s) não passaram.`);
  process.exit(1);
}

console.log(`\nOK: ${TABLES.length} tabelas negaram leitura/escrita anônima.`);
