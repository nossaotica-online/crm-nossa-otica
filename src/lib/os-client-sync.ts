// A ficha do cliente e a Ordem de Serviço precisam conversar nos dois sentidos.
// A O.S. já lia a ficha; o caminho de volta não existia — CPF, RG, telefone e
// grau digitados na ordem morriam dentro dela, e na compra seguinte o cadastro
// do cliente ainda era só o nome.

export interface ClientFicha {
  cpf: string | null;
  rg: string | null;
  whatsapp: string | null;
  secondary_phone: string | null;
}

export interface OrderForFicha {
  os_number: number;
  cpf: string | null;
  rg: string | null;
  created_at?: string | null;
  dnp: string | null;
  altura?: string | null;
  od_sphere: number | null;
  od_cylinder: number | null;
  od_axis: number | null;
  od_addition: number | null;
  oe_sphere: number | null;
  oe_cylinder: number | null;
  oe_axis: number | null;
  oe_addition: number | null;
}

export interface WriteResult { error: { message: string } | null }

// O banco entra por fora (e não como cliente do Supabase) para o teste rodar
// sem rede, do mesmo jeito que o teste do laboratório roda.
export interface ClientFichaGateway {
  findClient: (clientId: string) => PromiseLike<ClientFicha | null>;
  updateClient: (clientId: string, patch: Record<string, string>) => PromiseLike<WriteResult>;
  findOsPrescription: (clientId: string, notesPrefix: string) => PromiseLike<{ id: string } | null>;
  writePrescription: (existingId: string | null, payload: Record<string, unknown>) => PromiseLike<WriteResult>;
}

// A receita que a O.S. deixa na ficha carrega o número da ordem. É por essa
// marca que editar a mesma O.S. atualiza a receita em vez de criar repetida.
// O ponto no fim é o que impede a marca da O.S. #1 de casar com a da #12.
export const osPrescriptionTag = (osNumber: number) => `Receita da O.S. #${osNumber}`;
export const osPrescriptionPrefix = (osNumber: number) => `${osPrescriptionTag(osNumber)}.`;

// DNP na O.S. é texto livre ("31/30", "31 e 30", "62"). Só vira campo separado
// de receita quando dá dois números dentro da faixa que o banco aceita (20 a
// 45mm por olho); fora disso o texto original fica na observação da receita.
export const parseDnp = (raw: string | null | undefined) => {
  const found = (raw || '').match(/\d+([.,]\d+)?/g) || [];
  const values = found.map((item) => Number(item.replace(',', '.')));
  const [right, left] = values;
  const valid = (value: number | undefined) => value !== undefined && value >= 20 && value <= 45;
  if (values.length >= 2 && valid(right) && valid(left)) return { right, left };
  return { right: null, left: null };
};

// Só preenche buraco: o que a ficha já tem nunca é sobrescrito pela O.S.
// Telefone diferente do que está na ficha entra como recado, em vez de trocar
// o WhatsApp que a loja usa para falar com o cliente.
export const clientPatchFromOrder = (
  client: ClientFicha,
  order: { cpf: string | null; rg: string | null },
  phoneDigits: string,
): Record<string, string> => {
  const patch: Record<string, string> = {};
  if (!client.cpf && order.cpf) patch.cpf = order.cpf;
  if (!client.rg && order.rg) patch.rg = order.rg;
  if (phoneDigits) {
    if (!client.whatsapp) patch.whatsapp = phoneDigits;
    else if (client.whatsapp !== phoneDigits && !client.secondary_phone) patch.secondary_phone = phoneDigits;
  }
  return patch;
};

/** A receita que essa O.S. deixa na ficha, ou null se a ordem não tem grau. */
export const prescriptionFromOrder = (clientId: string, order: OrderForFicha, today: string) => {
  const grau = {
    od_sphere: order.od_sphere, od_cylinder: order.od_cylinder, od_axis: order.od_axis, od_addition: order.od_addition,
    oe_sphere: order.oe_sphere, oe_cylinder: order.oe_cylinder, oe_axis: order.oe_axis, oe_addition: order.oe_addition,
  };
  const hasGrau = Object.values(grau).some((value) => value !== null && value !== undefined);
  if (!hasGrau && !order.dnp && !order.altura) return null;
  const dnp = parseDnp(order.dnp);
  // A receita da ficha não tem campo de altura, e a DNP que não dá para separar
  // por olho também não cabe nos campos: as duas ficam escritas na observação,
  // senão a medida se perderia no caminho da O.S. para a ficha.
  const extras = [
    dnp.right === null && order.dnp ? `DNP anotada: ${order.dnp}` : null,
    order.altura ? `Altura: ${order.altura}` : null,
  ].filter(Boolean);
  return {
    client_id: clientId,
    // A receita fica na data da O.S., não na data em que alguém editou a ordem.
    prescription_date: (order.created_at || '').slice(0, 10) || today,
    ...grau,
    dnp_right: dnp.right,
    dnp_left: dnp.left,
    notes: extras.length > 0
      ? `${osPrescriptionPrefix(order.os_number)} ${extras.join(' · ')}`
      : osPrescriptionPrefix(order.os_number),
  };
};

/**
 * Devolve para a ficha do cliente o que a O.S. trouxe de novo e conta, em
 * português, o que foi gravado. Falha de permissão vira aviso: a O.S. já está
 * salva, e a vendedora precisa saber o que não subiu para a ficha.
 *
 * `previousOsNumber` é o número que a ordem tinha antes de ser renumerada: sem
 * ele, corrigir o número da O.S. deixaria a receita antiga órfã na ficha e
 * criaria uma segunda com o número novo.
 */
export async function syncClientFromOrder(
  gateway: ClientFichaGateway,
  clientId: string,
  order: OrderForFicha,
  phoneDigits: string,
  today: string,
  previousOsNumber?: number,
): Promise<string[]> {
  const done: string[] = [];

  const client = await gateway.findClient(clientId);
  if (client) {
    const patch = clientPatchFromOrder(client, order, phoneDigits);
    if (Object.keys(patch).length > 0) {
      const { error } = await gateway.updateClient(clientId, patch);
      done.push(error
        ? `(aviso: não deu para completar a ficha do cliente — ${error.message})`
        : 'Ficha do cliente completada com os dados da O.S.');
    }
  }

  const prescription = prescriptionFromOrder(clientId, order, today);
  if (prescription) {
    let existing = await gateway.findOsPrescription(clientId, osPrescriptionPrefix(order.os_number));
    if (!existing && previousOsNumber !== undefined && previousOsNumber !== order.os_number) {
      existing = await gateway.findOsPrescription(clientId, osPrescriptionPrefix(previousOsNumber));
    }
    const { error } = await gateway.writePrescription(existing?.id || null, prescription);
    done.push(error
      ? `(aviso: não deu para salvar o grau na ficha — ${error.message})`
      : 'Grau salvo no histórico de receitas dele.');
  }

  return done;
}
