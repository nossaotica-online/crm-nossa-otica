// Campos da Ordem de Serviço que chegaram depois, cada um numa migration
// diferente. O banco da ótica pode estar com só uma parte aplicada — daí a
// gravação precisa se virar sem perder o que o banco já aceita.

export const OPTIONAL_COLUMN_INFO: Record<string, { label: string; migration: string }> = {
  laboratory: { label: 'o laboratório', migration: '026' },
  lab_sent_date: { label: 'a data de envio ao laboratório', migration: '027' },
  lab_due_date: { label: 'o prazo de entrega do laboratório', migration: '028' },
  altura: { label: 'a altura de montagem', migration: '031' },
  os_number: { label: 'o número que você digitou para a O.S.', migration: '032' },
};

// Qual coluna o banco recusou. Coluna que não existe, o PostgREST anuncia de
// dois jeitos: "column service_orders.lab_due_date does not exist" e
// "Could not find the 'lab_due_date' column of 'service_orders' in the schema cache".
// Coluna que existe mas ainda não aceita valor de fora (o os_number antes da
// migration 032) vem como "cannot insert a non-DEFAULT value into column
// \"os_number\"" ou "column \"os_number\" can only be updated to DEFAULT" —
// para a tela dá no mesmo: aquele campo não pode ir no envio.
export const missingColumnFrom = (message: string): string | null => {
  const match = message.match(/column\s+(?:[\w]+\.)?["']?([a-z_]+)["']?\s+does not exist/i)
    || message.match(/could not find the ['"]([a-z_]+)['"] column/i)
    || message.match(/non-default value into column\s+["']?([a-z_]+)["']?/i)
    || message.match(/column\s+["']?([a-z_]+)["']?\s+can only be updated to default/i);
  return match?.[1] ?? null;
};

/**
 * Grava a O.S. tirando do envio apenas as colunas que ainda não existem no
 * banco. Antes as do laboratório eram descartadas juntas no primeiro erro, e o
 * nome do laboratório se perdia mesmo com a coluna dele já criada.
 *
 * Devolve o resultado final e quais colunas ficaram de fora, para o aviso na
 * tela dizer o que não foi salvo e qual migration falta.
 */
export async function writeDroppingMissingColumns<T extends { error: { message: string } | null }>(
  // PromiseLike: o construtor de consulta do Supabase é "thenable", não Promise.
  write: (body: Record<string, unknown>) => PromiseLike<T>,
  payload: Record<string, unknown>,
): Promise<{ result: T; droppedColumns: string[] }> {
  const body: Record<string, unknown> = { ...payload };
  const droppedColumns: string[] = [];
  let result = await write(body);

  while (result.error && droppedColumns.length < Object.keys(OPTIONAL_COLUMN_INFO).length) {
    const missing = missingColumnFrom(result.error.message);
    // Erro que não seja "essa coluna não existe" não se resolve tirando campo:
    // para aqui e deixa a tela mostrar a mensagem do banco.
    if (!missing || !(missing in OPTIONAL_COLUMN_INFO) || !(missing in body)) break;
    delete body[missing];
    droppedColumns.push(missing);
    result = await write(body);
  }

  return { result, droppedColumns };
}

/** Aviso pronto para a tela, ou string vazia se tudo coube no banco. */
export const missingColumnsNotice = (droppedColumns: string[]) => {
  if (droppedColumns.length === 0) return '';
  const labels = droppedColumns.map((column) => OPTIONAL_COLUMN_INFO[column].label);
  const migrations = droppedColumns.map((column) => OPTIONAL_COLUMN_INFO[column].migration);
  const verb = labels.length === 1 ? 'não foi salvo' : 'não foram salvos';
  return `(atenção: ${labels.join(' e ')} ${verb}: falta rodar no Supabase a migration ${migrations.join(' e ')}.)`;
};
