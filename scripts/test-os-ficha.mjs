// Confere que a Ordem de Serviço e a ficha do cliente conversam nos dois
// sentidos — o problema real da loja: a O.S. tinha CPF, RG, telefone e grau, e
// o cadastro do cliente continuava só com o nome.
//
// Roda sem banco: uma ficha de mentira guarda as linhas em memória, com as
// mesmas regras do Supabase (busca por prefixo da observação, erro de RLS).
//
// Uso: node scripts/test-os-ficha.mjs

// O Node lê o TypeScript direto, então o teste roda contra o arquivo de
// verdade que o app usa — não contra uma cópia.
const {
  syncClientFromOrder,
  clientPatchFromOrder,
  prescriptionFromOrder,
  parseDnp,
} = await import('../src/lib/os-client-sync.ts');

let failures = 0;
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FALHOU ${name} ${detail}`);
  }
};

// Banco de mentira. `blocked` simula o RLS recusando a gravação.
const fakeFicha = ({ client, prescriptions = [], blocked = false }) => {
  const state = { client: { ...client }, prescriptions: [...prescriptions] };
  let nextId = 1;
  const gateway = {
    findClient: async () => state.client,
    updateClient: async (_clientId, patch) => {
      if (blocked) return { error: { message: 'new row violates row-level security policy' } };
      state.client = { ...state.client, ...patch };
      return { error: null };
    },
    // `LIKE 'prefixo%'` é exatamente um startsWith.
    findOsPrescription: async (clientId, notesPrefix) =>
      state.prescriptions.find((item) => item.client_id === clientId && (item.notes || '').startsWith(notesPrefix)) || null,
    writePrescription: async (existingId, payload) => {
      if (blocked) return { error: { message: 'new row violates row-level security policy' } };
      if (existingId) {
        const index = state.prescriptions.findIndex((item) => item.id === existingId);
        state.prescriptions[index] = { ...state.prescriptions[index], ...payload };
      } else {
        state.prescriptions.push({ id: `receita-${nextId += 1}`, ...payload });
      }
      return { error: null };
    },
  };
  return { gateway, state };
};

// A ordem que a vendedora preencheu na loja.
const ORDEM = {
  os_number: 12,
  cpf: '123.456.789-00',
  rg: 'MG-14.222.333',
  created_at: '2026-08-22T13:40:00Z',
  dnp: '31/30',
  altura: '21/21',
  od_sphere: -1.5, od_cylinder: -0.75, od_axis: 180, od_addition: null,
  oe_sphere: -1.25, oe_cylinder: -0.5, oe_axis: 175, oe_addition: null,
};
const FICHA_SO_NOME = { cpf: null, rg: null, whatsapp: null, secondary_phone: null };
const HOJE = '2026-08-22';

// 1. O caso da loja: ficha só com o nome, O.S. com tudo.
{
  const { gateway, state } = fakeFicha({ client: { ...FICHA_SO_NOME } });
  const avisos = await syncClientFromOrder(gateway, 'cliente-1', ORDEM, '64974003830', HOJE);
  check('CPF da O.S. entra na ficha', state.client.cpf === '123.456.789-00', `obtido=${state.client.cpf}`);
  check('RG da O.S. entra na ficha', state.client.rg === 'MG-14.222.333', `obtido=${state.client.rg}`);
  check('telefone da O.S. entra na ficha', state.client.whatsapp === '64974003830', `obtido=${state.client.whatsapp}`);
  check('grau vira receita no histórico', state.prescriptions.length === 1, `obtido=${state.prescriptions.length}`);
  const receita = state.prescriptions[0];
  check('receita guarda o grau dos dois olhos',
    receita.od_sphere === -1.5 && receita.oe_cylinder === -0.5, JSON.stringify(receita));
  check('DNP 31/30 vira 31 e 30', receita.dnp_right === 31 && receita.dnp_left === 30, JSON.stringify(receita));
  check('receita fica na data da O.S., não na de hoje', receita.prescription_date === '2026-08-22', receita.prescription_date);
  check('avisa na tela o que foi para a ficha', avisos.length === 2, JSON.stringify(avisos));
}

// 2. Editar a mesma O.S. não duplica a receita.
{
  const { gateway, state } = fakeFicha({ client: { ...FICHA_SO_NOME } });
  await syncClientFromOrder(gateway, 'cliente-1', ORDEM, '64974003830', HOJE);
  await syncClientFromOrder(gateway, 'cliente-1', { ...ORDEM, od_sphere: -2 }, '64974003830', HOJE);
  check('segunda gravação atualiza em vez de duplicar', state.prescriptions.length === 1, `obtido=${state.prescriptions.length}`);
  check('receita fica com o grau corrigido', state.prescriptions[0].od_sphere === -2, JSON.stringify(state.prescriptions[0]));
}

// 3. Duas O.S. do mesmo cliente = duas receitas. E a marca da #1 não pode
//    casar com a da #12 (o "#1" é prefixo de "#12").
{
  const { gateway, state } = fakeFicha({ client: { ...FICHA_SO_NOME } });
  await syncClientFromOrder(gateway, 'cliente-1', { ...ORDEM, os_number: 1 }, '64974003830', HOJE);
  await syncClientFromOrder(gateway, 'cliente-1', ORDEM, '64974003830', HOJE);
  check('O.S. #1 e O.S. #12 são receitas separadas', state.prescriptions.length === 2,
    JSON.stringify(state.prescriptions.map((item) => item.notes)));
}

// 4. Ficha que já tem dado não é atropelada pela O.S.
{
  const patch = clientPatchFromOrder(
    { cpf: '999.999.999-99', rg: null, whatsapp: '64999990000', secondary_phone: null },
    ORDEM,
    '64974003830',
  );
  check('CPF já cadastrado não é sobrescrito', patch.cpf === undefined, JSON.stringify(patch));
  check('RG em branco é preenchido', patch.rg === 'MG-14.222.333', JSON.stringify(patch));
  check('telefone diferente entra como recado, sem trocar o WhatsApp',
    patch.whatsapp === undefined && patch.secondary_phone === '64974003830', JSON.stringify(patch));
}

// 5. A altura de montagem chega na ficha junto com o grau.
{
  const receita = prescriptionFromOrder('cliente-1', ORDEM, HOJE);
  check('altura da O.S. fica anotada na receita', receita.notes.includes('Altura: 21/21'), receita.notes);
  const soAltura = {
    ...ORDEM, dnp: null,
    od_sphere: null, od_cylinder: null, od_axis: null, od_addition: null,
    oe_sphere: null, oe_cylinder: null, oe_axis: null, oe_addition: null,
  };
  check('O.S. só com altura ainda vira receita', prescriptionFromOrder('cliente-1', soAltura, HOJE) !== null);
  const semNada = { ...soAltura, altura: null };
  check('O.S. sem grau, sem DNP e sem altura não vira receita',
    prescriptionFromOrder('cliente-1', semNada, HOJE) === null);
}

// 6. DNP escrita de outros jeitos.
{
  check('DNP "31 e 30" é entendida', parseDnp('31 e 30').right === 31 && parseDnp('31 e 30').left === 30);
  check('DNP "62" (total) não vira olho', parseDnp('62').right === null);
  const receita = prescriptionFromOrder('cliente-1', { ...ORDEM, dnp: '62' }, HOJE);
  check('DNP que não dá para separar fica anotada na receita',
    receita.notes.includes('DNP anotada: 62'), receita.notes);
  check('DNP anotada e altura convivem na mesma observação',
    receita.notes.includes('DNP anotada: 62') && receita.notes.includes('Altura: 21/21'), receita.notes);
  check('DNP "31,5/30,5" com vírgula é entendida',
    parseDnp('31,5/30,5').right === 31.5 && parseDnp('31,5/30,5').left === 30.5);
}

// 7. Sem permissão no banco, a O.S. já está salva: o erro vira aviso na tela.
{
  const { gateway } = fakeFicha({ client: { ...FICHA_SO_NOME }, blocked: true });
  const avisos = await syncClientFromOrder(gateway, 'cliente-1', ORDEM, '64974003830', HOJE);
  check('falha de permissão vira aviso, não quebra a O.S.',
    avisos.length === 2 && avisos.every((aviso) => aviso.startsWith('(aviso:')), JSON.stringify(avisos));
}

console.log(failures === 0 ? '\nTodos os testes passaram.' : `\n${failures} teste(s) falharam.`);
process.exit(failures === 0 ? 0 : 1);
