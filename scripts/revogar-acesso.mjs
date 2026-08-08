// Revoga o acesso de um usuário do CRM: desativa o profile e apaga o login.
// Uso: node scripts/revogar-acesso.mjs <email>
//
// Exige SUPABASE_SERVICE_ROLE_KEY no .env.local (arquivo ignorado pelo git).
// A service_role ignora RLS: este script nunca deve virar rota da aplicação.

import { readFileSync } from 'node:fs';

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
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  || localEnvironment.SUPABASE_SERVICE_ROLE_KEY;

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  throw new Error('Informe o e-mail: node scripts/revogar-acesso.mjs <email>');
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Defina SUPABASE_SERVICE_ROLE_KEY no .env.local '
    + '(Supabase → Project Settings → API Keys → service_role).',
  );
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
};

// A listagem é paginada; o e-mail é procurado página a página.
async function findUserByEmail(target) {
  for (let page = 1; page <= 20; page += 1) {
    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=200`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`Falha ao listar usuários (HTTP ${response.status}).`);
    }

    const { users = [] } = await response.json();
    if (users.length === 0) return null;

    const match = users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match;
  }

  return null;
}

const user = await findUserByEmail(email);

if (!user) {
  console.log(`Nenhum usuário com o e-mail ${email}. Nada a revogar.`);
  process.exit(0);
}

// Desativa o profile primeiro: mesmo que a remoção do login falhe,
// as policies passam a bloquear o acesso a partir daqui.
const deactivate = await fetch(
  `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}`,
  {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ ativo: false }),
  },
);

if (!deactivate.ok) {
  throw new Error(`Falha ao desativar o profile (HTTP ${deactivate.status}).`);
}

console.log(`Profile desativado: ${email}`);

const remove = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
  method: 'DELETE',
  headers,
});

if (!remove.ok) {
  throw new Error(`Falha ao apagar o login (HTTP ${remove.status}).`);
}

console.log(`Login apagado: ${email}`);
console.log('Acesso revogado. A senha antiga não funciona mais.');
