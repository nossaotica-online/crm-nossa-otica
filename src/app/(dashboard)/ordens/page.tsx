'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { safeWhatsAppUrl } from '@/lib/security';
import type { ClientPrescription, ClientRecord, ServiceOrder, ServiceOrderStatus } from '@/types/clients';
import type { Profile } from '@/types';
import { toCsv, downloadFile, todayStamp } from '@/lib/csv';
import { getTodayISO } from '@/lib/utils';
import styles from '../clientes/clientes.module.css';
import { useConfirm } from '@/components/ConfirmDialog';
import { writeDroppingMissingColumns, missingColumnsNotice } from '@/lib/optional-columns';
import { syncClientFromOrder, type ClientFichaGateway } from '@/lib/os-client-sync';

const PRODUCT_OPTIONS = [
  'Óculos completo', 'Só as lentes', 'Só a armação', 'Óculos de sol', 'Lente de contato', 'Manutenção / conserto',
];

// Laboratórios com que a ótica trabalha: os de óculos e os de lente de
// contato na mesma lista. "Outro" libera um campo livre.
const LAB_OPTIONS = ['Unilentes', 'Vision Lab', 'Prolentes', 'Art Lentes', 'Hoya', 'Orlac', 'Solótica', 'Optix'];
const OTHER_LAB = 'Outro';

// Etiqueta do laboratório: roxo para todos, grande e em destaque na lista.
const LAB_BADGE_STYLE: React.CSSProperties = {
  color: '#c084fc',
  background: 'rgba(192,132,252,.18)',
  display: 'inline-block',
  padding: '6px 13px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: .2,
  whiteSpace: 'nowrap',
};

const STATUS_OPTIONS: { value: ServiceOrderStatus; label: string; color: string; bg: string }[] = [
  { value: 'aberta', label: 'Aberta', color: '#cbd5e1', bg: 'rgba(148,163,184,.15)' },
  { value: 'em_producao', label: 'Em produção', color: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
  { value: 'pronta', label: 'Pronta p/ retirar', color: '#22c55e', bg: 'rgba(34,197,94,.15)' },
  { value: 'entregue', label: 'Entregue', color: '#38bdf8', bg: 'rgba(56,189,248,.15)' },
  { value: 'cancelada', label: 'Cancelada', color: '#f87171', bg: 'rgba(239,68,68,.15)' },
];

const statusInfo = (value: ServiceOrderStatus) => STATUS_OPTIONS.find((option) => option.value === value) || STATUS_OPTIONS[0];

// A venda só conta como faturamento (fechado) quando a O.S. é ENTREGUE.
// Antes disso é "negociação"; cancelada vira venda cancelada.
const saleStatusFor = (osStatus: ServiceOrderStatus): 'fechado' | 'negociacao' | 'cancelado' =>
  osStatus === 'entregue' ? 'fechado' : osStatus === 'cancelada' ? 'cancelado' : 'negociacao';

const onlyDigits = (value: string) => value.replace(/\D/g, '');
const brl = (value: number | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`))
  : '—';
const formatPhone = (value: string | null) => {
  const digits = onlyDigits(value || '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || '';
};
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
const numberOrNull = (value: string) => {
  if (value.trim() === '') return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
};
// Quantos dias o pedido fica no laboratório: do envio até o prazo de entrega dele.
const daysInLab = (sent: string | null | undefined, due: string | null | undefined) => {
  if (!sent || !due) return null;
  const from = new Date(`${sent.slice(0, 10)}T12:00:00`).getTime();
  const to = new Date(`${due.slice(0, 10)}T12:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86400000);
};
const daysLabel = (days: number | null) => {
  if (days === null) return null;
  if (days < 0) return 'data do prazo antes do envio';
  return `${days} ${days === 1 ? 'dia' : 'dias'} no laboratório`;
};
const intOrNull = (value: string) => {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.round(parsed);
};


interface OrderForm {
  os_number: string;
  client_id: string;
  client_name: string;
  cpf: string; rg: string; phone: string;
  product_type: string; frame_description: string; lens_description: string; laboratory: string; lab_sent_date: string; lab_due_date: string;
  od_sphere: string; od_cylinder: string; od_axis: string; od_addition: string;
  oe_sphere: string; oe_cylinder: string; oe_axis: string; oe_addition: string;
  dnp: string; altura: string;
  total: string; down_payment: string; payment_method: string; vendedor_id: string;
  status: ServiceOrderStatus; delivery_date: string; notes: string;
}

const PAYMENT_OPTIONS = ['Dinheiro', 'PIX', 'Cartão de débito', 'Cartão de crédito', 'Crediário / parcelado', 'Outro'];

const EMPTY_FORM: OrderForm = {
  os_number: '',
  client_id: '', client_name: '', cpf: '', rg: '', phone: '',
  product_type: '', frame_description: '', lens_description: '', laboratory: '', lab_sent_date: '', lab_due_date: '',
  od_sphere: '', od_cylinder: '', od_axis: '', od_addition: '',
  oe_sphere: '', oe_cylinder: '', oe_axis: '', oe_addition: '',
  dnp: '', altura: '', total: '', down_payment: '', payment_method: '', vendedor_id: '', status: 'aberta', delivery_date: '', notes: '',
};

export default function OrdensPage() {
  const supabase = useMemo(() => createClient(), []);
  const { confirm, confirmDialog } = useConfirm();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<ClientPrescription[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ServiceOrderStatus>('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const [clientTerm, setClientTerm] = useState('');
  // O que veio da ficha do cliente ao vincular — evita a impressão de que
  // "só veio o nome" quando o cadastro dele ainda não tem CPF, RG nem receita.
  const [clientHint, setClientHint] = useState('');
  const [labOther, setLabOther] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const selectedOrder = orders.find((o) => o.id === viewId) || null;
  // Espelho das vendas já geradas, por O.S. — é o que revela a ordem que
  // ficou fora do faturamento porque a sincronização falhou lá atrás.
  const [salesByOrder, setSalesByOrder] = useState<Record<string, { status: string; valor: number }>>({});
  const [syncError, setSyncError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [ordersRes, clientsRes, teamRes, salesRes, prescriptionsRes] = await Promise.all([
      supabase.from('service_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').eq('status', 'active').order('name'),
      supabase.from('profiles').select('*'),
      supabase.from('sales').select('service_order_id, status, valor').not('service_order_id', 'is', null),
      supabase.from('client_prescriptions').select('*').order('prescription_date', { ascending: false }),
    ]);
    const err = ordersRes.error || clientsRes.error;
    if (err) {
      setError(err.message.includes('schema cache') || err.message.includes('does not exist')
        ? 'O módulo Ordem de Serviço ainda não foi aplicado no banco. Rode a migration 021.'
        : `Não foi possível carregar as ordens: ${err.message}`);
    } else {
      setOrders((ordersRes.data || []) as ServiceOrder[]);
      setClients((clientsRes.data || []) as ClientRecord[]);
      setTeam((teamRes.data || []) as Profile[]);
    }
    // Receita é só para adiantar o grau do cliente que volta: se não carregar,
    // a O.S. continua funcionando com os campos em branco.
    setPrescriptions((prescriptionsRes.data || []) as ClientPrescription[]);
    if (salesRes.error) {
      setSalesByOrder({});
      setSyncError(/service_order_id/.test(salesRes.error.message)
        ? 'O vínculo entre Ordem de Serviço e Orçamentos ainda não existe no banco — por isso nenhuma O.S. entra no faturamento. Rode a migration 024 no Supabase.'
        : `Não foi possível conferir os orçamentos das ordens: ${salesRes.error.message}`);
    } else {
      setSyncError('');
      const map: Record<string, { status: string; valor: number }> = {};
      for (const row of (salesRes.data || []) as { service_order_id: string; status: string; valor: number }[]) {
        map[row.service_order_id] = { status: row.status, valor: Number(row.valor) };
      }
      setSalesByOrder(map);
    }
    setLoading(false);
  };

  // Uma venda por O.S., com o mesmo status e o mesmo valor. O que fugir disso
  // (ou nem existir) está fora do painel e precisa ser regravado.
  const outOfSync = useMemo(() => orders.filter((order) => {
    const sale = salesByOrder[order.id];
    if (!sale) return true;
    return sale.status !== saleStatusFor(order.status) || sale.valor !== Number(order.total || 0);
  }), [orders, salesByOrder]);

  useEffect(() => { void loadData(); }, []);

  // Quem está logada. Se nenhum vendedor for escolhido, a O.S. e a venda ficam
  // no nome de quem cadastrou — sem isso o RLS recusa a gravação de quem não é admin.
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, [supabase]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const digits = onlyDigits(search);
    return orders.filter((order) => {
      if (statusFilter !== 'todos' && order.status !== statusFilter) return false;
      if (!term) return true;
      if (String(order.os_number).includes(digits) && digits) return true;
      const haystack = normalize([order.client_name, order.cpf, order.product_type, order.laboratory, order.notes].filter(Boolean).join(' '));
      const phoneMatch = digits.length >= 3 && onlyDigits(order.phone || '').includes(digits);
      return haystack.includes(term) || phoneMatch;
    });
  }, [orders, search, statusFilter]);

  // Sugestão para a próxima O.S.: um a mais que o maior número já gravado. É só
  // um chute educado — quem manda é o bloco da loja, e o banco recusa repetido.
  const suggestedOsNumber = useMemo(() => {
    const highest = orders.reduce((max, order) => Math.max(max, Number(order.os_number) || 0), 0);
    return String(highest + 1);
  }, [orders]);

  const balance = (total: string, down: string) => (numberOrNull(total) || 0) - (numberOrNull(down) || 0);

  // Última receita da ficha: é o grau que o cliente que volta já tinha.
  const lastPrescription = (clientId: string) => prescriptions
    .filter((item) => item.client_id === clientId)
    .sort((a, b) => (a.prescription_date < b.prescription_date ? 1 : -1))[0] || null;

  const pickClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (!client) { setForm((f) => ({ ...f, client_id: '', client_name: '' })); setClientHint(''); return; }
    const last = lastPrescription(client.id);
    const s = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));
    setForm((f) => ({
      ...f,
      client_id: client.id,
      client_name: client.name,
      cpf: client.cpf || f.cpf,
      rg: client.rg || f.rg,
      phone: formatPhone(client.whatsapp || client.secondary_phone) || f.phone,
      // Grau só entra em campo vazio: o que você já digitou nesta O.S. manda.
      od_sphere: f.od_sphere || s(last?.od_sphere), od_cylinder: f.od_cylinder || s(last?.od_cylinder),
      od_axis: f.od_axis || s(last?.od_axis), od_addition: f.od_addition || s(last?.od_addition),
      oe_sphere: f.oe_sphere || s(last?.oe_sphere), oe_cylinder: f.oe_cylinder || s(last?.oe_cylinder),
      oe_axis: f.oe_axis || s(last?.oe_axis), oe_addition: f.oe_addition || s(last?.oe_addition),
      dnp: f.dnp || (last && (last.dnp_right !== null || last.dnp_left !== null) ? `${last.dnp_right ?? '-'}/${last.dnp_left ?? '-'}` : ''),
    }));
    const trazidos = [client.cpf && 'CPF', client.rg && 'RG', (client.whatsapp || client.secondary_phone) && 'telefone'].filter(Boolean);
    setClientHint([
      trazidos.length > 0
        ? `Peguei da ficha de ${client.name}: ${trazidos.join(', ')}.`
        : `A ficha de ${client.name} ainda só tem o nome — o CPF, o RG e o telefone que você digitar aqui vão ser gravados no cadastro dele.`,
      last ? `Grau preenchido com a receita de ${formatDate(last.prescription_date)} — se ele trouxe receita nova, corrija abaixo.` : null,
    ].filter(Boolean).join(' '));
    setClientTerm('');
  };

  // A O.S. alimenta a ficha do cliente. Sem isso o cadastro fica só com o nome:
  // o que a vendedora digita na ordem (CPF, RG, telefone, grau) morre na O.S. e
  // a próxima compra da mesma pessoa começa do zero de novo.
  const fichaGateway: ClientFichaGateway = {
    findClient: async (clientId) => {
      const { data } = await supabase.from('clients').select('*').eq('id', clientId).single();
      return (data as ClientRecord | null) || null;
    },
    updateClient: (clientId, patch) => supabase.from('clients').update(patch).eq('id', clientId),
    findOsPrescription: async (clientId, notesPrefix) => {
      const { data } = await supabase.from('client_prescriptions')
        .select('id').eq('client_id', clientId).like('notes', `${notesPrefix}%`).limit(1);
      return ((data || [])[0] as { id: string } | undefined) || null;
    },
    writePrescription: (existingId, payload) => (existingId
      ? supabase.from('client_prescriptions').update(payload).eq('id', existingId)
      : supabase.from('client_prescriptions').insert(payload)),
  };

  const exportOrders = () => {
    if (orders.length === 0) { setNotice('Nenhuma ordem para exportar ainda.'); return; }
    const grau = (od: number | null, cyl: number | null, axis: number | null, add: number | null) =>
      [od, cyl, axis, add].some((v) => v !== null) ? `Esf ${od ?? '-'} / Cil ${cyl ?? '-'} / Eixo ${axis ?? '-'} / Ad ${add ?? '-'}` : '';
    const csv = toCsv(orders, [
      { label: 'Nº O.S.', value: (o) => o.os_number },
      { label: 'Cliente', value: (o) => o.client_name },
      { label: 'CPF', value: (o) => o.cpf },
      { label: 'RG', value: (o) => o.rg },
      { label: 'Telefone', value: (o) => formatPhone(o.phone) },
      { label: 'Produto', value: (o) => o.product_type },
      { label: 'Armação', value: (o) => o.frame_description },
      { label: 'Lente', value: (o) => o.lens_description },
      { label: 'Laboratório', value: (o) => o.laboratory },
      { label: 'Enviado ao laboratório', value: (o) => formatDate(o.lab_sent_date) },
      { label: 'Laboratório entrega em', value: (o) => formatDate(o.lab_due_date) },
      { label: 'Dias no laboratório', value: (o) => daysInLab(o.lab_sent_date, o.lab_due_date) },
      { label: 'Grau OD', value: (o) => grau(o.od_sphere, o.od_cylinder, o.od_axis, o.od_addition) },
      { label: 'Grau OE', value: (o) => grau(o.oe_sphere, o.oe_cylinder, o.oe_axis, o.oe_addition) },
      { label: 'DNP', value: (o) => o.dnp },
      { label: 'Altura', value: (o) => o.altura },
      { label: 'Total', value: (o) => brl(o.total) },
      { label: 'Entrada', value: (o) => brl(o.down_payment) },
      { label: 'Saldo', value: (o) => brl((o.total || 0) - (o.down_payment || 0)) },
      { label: 'Forma de pagamento', value: (o) => o.payment_method },
      { label: 'Vendedor(a)', value: (o) => team.find((member) => member.id === o.vendedor_id)?.nome },
      { label: 'Status', value: (o) => statusInfo(o.status).label },
      { label: 'Entrega', value: (o) => formatDate(o.delivery_date) },
      { label: 'Observações', value: (o) => o.notes },
      { label: 'Criada em', value: (o) => formatDate(o.created_at) },
    ]);
    downloadFile(`ordens-servico-${todayStamp()}.csv`, csv);
    setNotice(`Backup de ${orders.length} ordem(ns) baixado. Guarde o arquivo em local seguro.`);
  };

  const openNew = () => { setEditingId(null); setForm({ ...EMPTY_FORM, os_number: suggestedOsNumber }); setClientTerm(''); setClientHint(''); setLabOther(false); setError(''); setFormOpen(true); };

  const openEdit = (order: ServiceOrder) => {
    const s = (value: number | null) => (value === null || value === undefined ? '' : String(value));
    setEditingId(order.id);
    setForm({
      os_number: String(order.os_number),
      client_id: order.client_id || '', client_name: order.client_name,
      cpf: order.cpf || '', rg: order.rg || '', phone: order.phone || '',
      product_type: order.product_type || '', frame_description: order.frame_description || '', lens_description: order.lens_description || '',
      laboratory: order.laboratory || '', lab_sent_date: order.lab_sent_date || '', lab_due_date: order.lab_due_date || '',
      od_sphere: s(order.od_sphere), od_cylinder: s(order.od_cylinder), od_axis: s(order.od_axis), od_addition: s(order.od_addition),
      oe_sphere: s(order.oe_sphere), oe_cylinder: s(order.oe_cylinder), oe_axis: s(order.oe_axis), oe_addition: s(order.oe_addition),
      dnp: order.dnp || '', altura: order.altura || '', total: s(order.total), down_payment: s(order.down_payment),
      payment_method: order.payment_method || '', vendedor_id: order.vendedor_id || '',
      status: order.status, delivery_date: order.delivery_date || '', notes: order.notes || '',
    });
    setClientTerm('');
    setClientHint('');
    setLabOther(Boolean(order.laboratory) && !LAB_OPTIONS.includes(order.laboratory || ''));
    setError('');
    setFormOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const name = form.client_name.trim();
    if (!name) return setError('Informe o nome do cliente.');
    // Número da loja: inteiro positivo e que ainda não esteja em uso. O banco
    // também barra repetido, mas o aviso daqui diz de quem é o número.
    const typedNumber = form.os_number.trim();
    if (typedNumber !== '' && !/^\d{1,9}$/.test(typedNumber)) {
      return setError('O número da O.S. deve ser só números (sem letras, ponto ou traço).');
    }
    if (typedNumber !== '' && Number(typedNumber) < 1) {
      return setError('O número da O.S. tem que ser maior que zero.');
    }
    const taken = typedNumber !== ''
      ? orders.find((order) => String(order.os_number) === typedNumber && order.id !== editingId)
      : undefined;
    if (taken) {
      return setError(`O número ${typedNumber} já é da O.S. de ${taken.client_name}. Use outro número.`);
    }
    // O banco recusa entrada maior que o total (constraint). Avisa antes de tentar gravar.
    if ((numberOrNull(form.down_payment) || 0) > (numberOrNull(form.total) || 0)) {
      return setError('A entrada não pode ser maior que o valor total. Confira os dois campos.');
    }
    let phoneDigits = onlyDigits(form.phone);
    if ((phoneDigits.length === 12 || phoneDigits.length === 13) && phoneDigits.startsWith('55')) phoneDigits = phoneDigits.slice(2);

    setSaving(true);
    let clientId: string | null = form.client_id || null;
    let createdClient = false;

    // Ordem NOVA sem cliente vinculado: cadastra o cliente automaticamente
    if (!editingId && !clientId) {
      if (phoneDigits.length < 10) { setSaving(false); return setError('Informe o telefone do cliente (com DDD) — é assim que o cadastro é criado.'); }
      const existing = clients.find((c) => c.whatsapp === phoneDigits || c.secondary_phone === phoneDigits);
      if (existing) {
        clientId = existing.id;
      } else {
        const { data: newClient, error: clientError } = await supabase.from('clients')
          .insert({ name, whatsapp: phoneDigits, cpf: form.cpf.trim() || null, rg: form.rg.trim() || null, source: 'loja' })
          .select('id').single();
        if (clientError || !newClient) {
          setSaving(false);
          const msg = /row-level security|permission|jwt|401/i.test(clientError?.message || '')
            ? 'você precisa estar logada para gravar. Faça login com sua conta.'
            : (clientError?.message || 'erro desconhecido');
          return setError(`Não foi possível cadastrar o cliente: ${msg}`);
        }
        clientId = newClient.id;
        createdClient = true;
      }
    }

    // Guardado antes da gravação: é por ele que a receita da ficha é encontrada
    // quando a O.S. é renumerada.
    const previousOsNumber = editingId ? orders.find((order) => order.id === editingId)?.os_number : undefined;
    const total = numberOrNull(form.total) || 0;
    const vendedorId = form.vendedor_id || currentUserId || null;
    const payload = {
      // Em branco, o banco numera sozinho e o campo nem vai no envio.
      ...(typedNumber !== '' ? { os_number: Number(typedNumber) } : {}),
      client_id: clientId,
      client_name: name,
      cpf: form.cpf.trim() || null, rg: form.rg.trim() || null, phone: phoneDigits || null,
      product_type: form.product_type || null,
      frame_description: form.frame_description.trim() || null,
      lens_description: form.lens_description.trim() || null,
      laboratory: form.laboratory.trim() || null,
      lab_sent_date: form.lab_sent_date || null,
      lab_due_date: form.lab_due_date || null,
      od_sphere: numberOrNull(form.od_sphere), od_cylinder: numberOrNull(form.od_cylinder), od_axis: intOrNull(form.od_axis), od_addition: numberOrNull(form.od_addition),
      oe_sphere: numberOrNull(form.oe_sphere), oe_cylinder: numberOrNull(form.oe_cylinder), oe_axis: intOrNull(form.oe_axis), oe_addition: numberOrNull(form.oe_addition),
      dnp: form.dnp.trim() || null,
      altura: form.altura.trim() || null,
      total, down_payment: numberOrNull(form.down_payment) || 0,
      payment_method: form.payment_method || null,
      vendedor_id: vendedorId,
      status: form.status, delivery_date: form.delivery_date || null, notes: form.notes.trim() || null,
    };
    const write = (body: Record<string, unknown>) => (editingId
      ? supabase.from('service_orders').update(body).eq('id', editingId).select().single()
      : supabase.from('service_orders').insert(body).select().single());

    // Grava tirando só as colunas do laboratório que o banco ainda não tem.
    const { result, droppedColumns } = await writeDroppingMissingColumns(write, payload);
    if (result.error || !result.data) {
      setSaving(false);
      const raw = result.error?.message || 'erro desconhecido';
      // O banco é a palavra final sobre número repetido: outra pessoa pode ter
      // gravado o mesmo número enquanto esta tela estava aberta.
      if (/duplicate key|os_number_unique/i.test(raw)) {
        return setError(`O número ${typedNumber} acabou de ser usado em outra O.S. Recarregue a lista e escolha outro.`);
      }
      const msg = /row-level security|permission|jwt|401/i.test(raw)
        ? 'você precisa estar logada para gravar. Faça login com sua conta.'
        : raw;
      return setError(`Não foi possível salvar a O.S.: ${msg}`);
    }
    const order = result.data as ServiceOrder;

    // A O.S. já é a venda: mantém um registro em Orçamentos sincronizado com ela.
    const saleStatus = saleStatusFor(order.status);
    const { error: saleError } = await supabase.from('sales').upsert({
      service_order_id: order.id,
      client_id: clientId,
      vendedor_id: vendedorId,
      servico_id: null,
      servico_nome: form.product_type || 'Óculos completos',
      valor: total,
      parcelas: 1,
      status: saleStatus,
      data_fechamento: saleStatus === 'fechado' ? (order.delivery_date || getTodayISO()) : null,
      notas: `Gerado automaticamente pela O.S. #${order.os_number}.`,
    }, { onConflict: 'service_order_id' });

    // Devolve para a ficha do cliente tudo que a O.S. trouxe de novo.
    const clientSync = clientId
      ? await syncClientFromOrder(fichaGateway, clientId, order, phoneDigits, getTodayISO(), previousOsNumber)
      : [];

    setSaving(false);
    setFormOpen(false);
    setClientHint('');
    setNotice([
      editingId ? 'Ordem atualizada.' : `O.S. #${order.os_number} criada`,
      !editingId && createdClient ? 'e cliente cadastrado! Complete a ficha dele (indicação, família, observações) na aba Clientes.' : null,
      ...clientSync,
      saleStatus === 'fechado' ? 'Entregue → lançada no faturamento.' : saleStatus === 'negociacao' ? 'Vai pro faturamento quando você marcar como Entregue.' : null,
      saleError ? `(aviso: não foi possível sincronizar com Orçamentos — ${saleError.message})` : null,
      missingColumnsNotice(droppedColumns) || null,
    ].filter(Boolean).join(' '));
    await loadData();
  };

  const changeStatus = async (order: ServiceOrder, status: ServiceOrderStatus) => {
    const { error: err } = await supabase.from('service_orders').update({ status }).eq('id', order.id);
    if (err) return setError(`Não foi possível mudar o status: ${err.message}`);
    const saleStatus = saleStatusFor(status);
    // Upsert (e não update): O.S. que ainda não tem linha em Orçamentos — criada
    // antes da migration 024, ou cuja sincronização falhou — não entrava no
    // faturamento nunca, porque o update não achava nenhuma linha e não dava erro.
    const { error: saleError } = await supabase.from('sales').upsert({
      service_order_id: order.id,
      client_id: order.client_id,
      vendedor_id: order.vendedor_id || currentUserId || null,
      servico_id: null,
      servico_nome: order.product_type || 'Óculos completos',
      valor: order.total || 0,
      parcelas: 1,
      status: saleStatus,
      data_fechamento: saleStatus === 'fechado' ? (order.delivery_date || getTodayISO()) : null,
      notas: `Gerado automaticamente pela O.S. #${order.os_number}.`,
    }, { onConflict: 'service_order_id' });
    setNotice([
      `O.S. #${order.os_number} → ${statusInfo(status).label}.`,
      saleStatus === 'fechado' ? 'Lançada no faturamento do painel.' : null,
      saleError ? `(aviso: não foi possível sincronizar com Orçamentos — ${saleError.message})` : null,
    ].filter(Boolean).join(' '));
    await loadData();
  };

  // Regrava em Orçamentos todas as O.S. que ficaram de fora — inclusive as
  // antigas, que foram criadas antes de a O.S. passar a gerar venda.
  const syncOrders = async () => {
    setSyncing(true);
    setError('');
    const rows = outOfSync.map((order) => {
      const saleStatus = saleStatusFor(order.status);
      return {
        service_order_id: order.id,
        client_id: order.client_id,
        vendedor_id: order.vendedor_id || currentUserId || null,
        servico_id: null,
        servico_nome: order.product_type || 'Óculos completos',
        valor: order.total || 0,
        parcelas: 1,
        status: saleStatus,
        // Entrega antiga: usa a data de entrega dela, não a de hoje, senão o
        // faturamento apareceria todo no dia em que você clicou no botão.
        data_fechamento: saleStatus === 'fechado'
          ? (order.delivery_date || order.created_at?.slice(0, 10) || getTodayISO())
          : null,
        notas: `Gerado automaticamente pela O.S. #${order.os_number}.`,
      };
    });
    const { error: err } = await supabase.from('sales').upsert(rows, { onConflict: 'service_order_id' });
    setSyncing(false);
    if (err) {
      return setError(/row-level security|permission|jwt|401/i.test(err.message)
        ? 'Não foi possível sincronizar: você precisa estar logada (e com permissão) para gravar em Orçamentos.'
        : `Não foi possível sincronizar: ${err.message}`);
    }
    setNotice(`${rows.length} ${rows.length === 1 ? 'ordem sincronizada' : 'ordens sincronizadas'} com Orçamentos. As entregues já estão no faturamento do painel.`);
    await loadData();
  };

  const removeOrder = async (order: ServiceOrder) => {
    const confirmed = await confirm({
      title: 'Excluir esta O.S.?',
      message: `A Ordem de Serviço #${order.os_number} de ${order.client_name} será apagada para sempre. Essa ação não tem volta.`,
      confirmLabel: 'Sim, excluir O.S.',
    });
    if (!confirmed) return;
    const { error: err } = await supabase.from('service_orders').delete().eq('id', order.id);
    if (err) return setError(`Não foi possível excluir: ${err.message}`);
    setNotice('Ordem de serviço excluída.');
    await loadData();
  };

  const matchingClients = clients.filter((client) => {
    const term = clientTerm.trim();
    if (!term) return true;
    const digits = onlyDigits(term);
    if (digits.length >= 3 && ((client.whatsapp || '').includes(digits) || (client.secondary_phone || '').includes(digits))) return true;
    return normalize(client.name).includes(normalize(term));
  }).slice(0, 6);

  const counts = STATUS_OPTIONS.map((option) => ({ ...option, n: orders.filter((o) => o.status === option.value).length }));

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Nossa Ótica CRM</span>
          <h1>Ordens de Serviço</h1>
          <p>Pedidos da ótica: cliente, grau, produto, valores e entrega.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={exportOrders} title="Baixar todas as ordens (backup, abre no Excel)">⬇ Exportar</button>
          <button className="btn btn-primary" onClick={openNew}>+ Nova O.S.</button>
        </div>
      </header>

      {error && <div className={styles.errorBanner}>{error}<button onClick={() => setError('')}>×</button></div>}
      {notice && <div className={styles.noticeBanner}>{notice}<button onClick={() => setNotice('')}>×</button></div>}
      {syncError && <div className={styles.errorBanner}>{syncError}</div>}

      {!loading && !syncError && outOfSync.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          padding: '13px 16px', borderRadius: 10, fontSize: 13,
          color: '#fde68a', border: '1px solid rgba(245,158,11,.28)', background: 'rgba(245,158,11,.1)',
        }}>
          <span>
            <strong>{outOfSync.length} {outOfSync.length === 1 ? 'ordem está' : 'ordens estão'} fora de Orçamentos</strong> — não {outOfSync.length === 1 ? 'aparece' : 'aparecem'} no painel nem no faturamento, mesmo se já {outOfSync.length === 1 ? 'estiver entregue' : 'estiverem entregues'}.
          </span>
          <button
            className="btn btn-primary"
            onClick={() => void syncOrders()}
            disabled={syncing}
            style={{ flexShrink: 0, padding: '8px 16px', fontSize: 12, fontWeight: 800 }}
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
          </button>
        </div>
      )}

      <section className={styles.toolbar}>
        <div className={styles.searchBox}>
          <span>⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nº da O.S., cliente, CPF, telefone..." />
        </div>
        <div className={styles.totalCard}><strong>{filtered.length}</strong><span>ordens</span></div>
      </section>

      <nav className={styles.alphabetFilter} aria-label="Filtrar por status">
        <button className={statusFilter === 'todos' ? styles.activeLetter : ''} onClick={() => setStatusFilter('todos')}>Todas ({orders.length})</button>
        {counts.map((option) => (
          <button key={option.value} className={statusFilter === option.value ? styles.activeLetter : ''} onClick={() => setStatusFilter(option.value)}>{option.label} ({option.n})</button>
        ))}
      </nav>

      <section className={styles.tableCard}>
        {loading ? (
          <div className={styles.emptyState}>Carregando ordens...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}><strong>Nenhuma ordem de serviço</strong><span>Crie a primeira O.S. no botão “+ Nova O.S.”.</span></div>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Nº</th><th>Cliente</th><th>Produto</th><th>Laboratório</th><th>Enviado ao lab</th><th>Lab entrega em</th><th>Saldo</th><th>Status</th><th>Total</th><th>Ações</th></tr></thead>
              <tbody>
                {filtered.map((order) => {
                  const info = statusInfo(order.status);
                  const saldo = (order.total || 0) - (order.down_payment || 0);
                  return (
                    <tr key={order.id} onClick={() => setViewId(order.id)}>
                      <td data-label="Nº"><strong>#{order.os_number}</strong></td>
                      <td data-label="Cliente"><strong>{order.client_name}</strong>{order.phone ? <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatPhone(order.phone)}</div> : null}</td>
                      <td data-label="Produto">{order.product_type || '—'}</td>
                      <td data-label="Laboratório">{order.laboratory ? <span style={LAB_BADGE_STYLE}>{order.laboratory}</span> : <span style={{ color: 'var(--text-secondary)' }}>—</span>}</td>
                      <td data-label="Enviado ao lab">{formatDate(order.lab_sent_date)}</td>
                      <td data-label="Lab entrega em">
                        {formatDate(order.lab_due_date)}
                        {daysLabel(daysInLab(order.lab_sent_date, order.lab_due_date))
                          ? <div style={{ fontSize: 11, fontWeight: 800, color: '#c084fc' }}>{daysLabel(daysInLab(order.lab_sent_date, order.lab_due_date))}</div>
                          : null}
                      </td>
                      <td data-label="Saldo" style={{ color: saldo > 0 ? '#fca5a5' : '#86efac', fontWeight: 700 }}>{brl(saldo)}</td>
                      <td data-label="Status"><span style={{ color: info.color, background: info.bg, padding: '4px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{info.label}</span></td>
                      <td data-label="Total">{brl(order.total)}</td>
                      <td data-label="Ações" onClick={(event) => event.stopPropagation()}>
                        <div className={styles.actions}>
                          <select value={order.status} onChange={(event) => void changeStatus(order, event.target.value as ServiceOrderStatus)} style={{ padding: '5px 6px', borderRadius: 7, background: 'rgba(255,255,255,.04)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border-strong)', fontSize: 10 }}>
                            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <button title="Ver detalhes" onClick={() => setViewId(order.id)}>Ver</button>
                          <button onClick={() => openEdit(order)}>Editar</button>
                          <button className={styles.dangerAction} onClick={() => void removeOrder(order)}>Excluir</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className={styles.overlay} onMouseDown={() => !saving && setFormOpen(false)}>
          <form className={styles.modal} onSubmit={save} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}><div><span className={styles.eyebrow}>{editingId ? 'Editar O.S.' : 'Nova ordem de serviço'}</span><h2>{editingId ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</h2></div><button type="button" onClick={() => setFormOpen(false)}>×</button></div>
            {error && <div className={styles.errorBanner}>{error}<button type="button" onClick={() => setError('')}>×</button></div>}

            <section className={styles.formSection}>
              <h3>Número da O.S.</h3>
              <div className={styles.formGrid}>
                <label>Nº da O.S.
                  <input
                    inputMode="numeric"
                    maxLength={9}
                    value={form.os_number}
                    onChange={(event) => setForm({ ...form, os_number: event.target.value.replace(/\D/g, '') })}
                    placeholder={suggestedOsNumber}
                  />
                </label>
              </div>
              <p className={styles.helper} style={{ marginTop: 10 }}>
                Use o número do <strong>seu bloco de O.S.</strong> — é ele que fica valendo no sistema.
                {editingId ? ' Trocar o número aqui renumera esta ordem.' : ` Sugestão: ${suggestedOsNumber}. Se deixar em branco, o sistema numera sozinho.`}
              </p>
            </section>

            <section className={styles.formSection}>
              <h3>Cliente</h3>
              <p className={styles.helper} style={{ marginBottom: 12 }}>Preencha os dados do cliente aqui. Se for cliente novo, ele é <strong>cadastrado automaticamente</strong> ao criar a O.S. Se já for cadastrado, o que você preencher aqui (CPF, RG, telefone e o grau) <strong>entra na ficha dele</strong> — o resto (indicação, família, observações) você completa na aba Clientes.</p>
              <div className={styles.formGrid}>
                <label className={styles.fullField}>Nome do cliente *<input required maxLength={160} value={form.client_name} onChange={(event) => setForm({ ...form, client_name: event.target.value })} placeholder="Nome completo" /></label>
                <label>Telefone / WhatsApp<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: formatPhone(event.target.value) })} placeholder="(62) 99999-9999" /></label>
                <label>CPF<input value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} placeholder="000.000.000-00" /></label>
                <label>RG<input value={form.rg} onChange={(event) => setForm({ ...form, rg: event.target.value })} /></label>
              </div>
              {clientHint && (
                <p className={styles.helper} style={{ marginTop: 10, color: '#c084fc', fontWeight: 700, lineHeight: 1.5 }}>ℹ {clientHint}</p>
              )}
              {form.client_id ? (
                <p className={styles.helper} style={{ marginTop: 10 }}>✓ Ligado a um cliente já cadastrado. <button type="button" onClick={() => { setForm((f) => ({ ...f, client_id: '' })); setClientHint(''); }} style={{ color: 'var(--accent-primary)', fontWeight: 800, background: 'none', border: 0, cursor: 'pointer' }}>Desvincular</button></p>
              ) : !editingId ? (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>Esse cliente já é cadastrado? Buscar para não duplicar</summary>
                  <div className={styles.picker} style={{ marginTop: 8 }}>
                    <input value={clientTerm} onChange={(event) => setClientTerm(event.target.value)} placeholder="Digite o nome ou o telefone" />
                    {clientTerm.trim() !== '' && matchingClients.length > 0 && (
                      <div className={styles.pickerResults}>
                        {matchingClients.map((client) => (
                          <button type="button" key={client.id} onClick={() => pickClient(client.id)}>
                            <strong>{client.name}</strong><span>{formatPhone(client.whatsapp || client.secondary_phone)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {clientTerm.trim() !== '' && matchingClients.length === 0 && <p className={styles.helper}>Ninguém com esse nome/telefone — pode seguir, será cadastrado como novo.</p>}
                  </div>
                </details>
              ) : null}
            </section>

            <section className={styles.formSection}>
              <h3>Produto</h3>
              <div className={styles.formGrid}>
                <label>Tipo de produto<select value={form.product_type} onChange={(event) => setForm({ ...form, product_type: event.target.value })}><option value="">Selecione...</option>{PRODUCT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label>Armação (marca / modelo / cor)<input maxLength={500} value={form.frame_description} onChange={(event) => setForm({ ...form, frame_description: event.target.value })} /></label>
                <label className={styles.fullField}>Lente (tipo / tratamento)<input maxLength={500} value={form.lens_description} onChange={(event) => setForm({ ...form, lens_description: event.target.value })} placeholder="Ex: multifocal, antirreflexo, transitions" /></label>
                <label>Laboratório
                  <select
                    value={labOther ? OTHER_LAB : form.laboratory}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === OTHER_LAB) { setLabOther(true); setForm({ ...form, laboratory: '' }); return; }
                      setLabOther(false);
                      setForm({ ...form, laboratory: value });
                    }}
                  >
                    <option value="">Selecione...</option>
                    {LAB_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    <option value={OTHER_LAB}>Outro laboratório...</option>
                  </select>
                </label>
                {labOther && (
                  <label>Qual laboratório?<input maxLength={120} value={form.laboratory} onChange={(event) => setForm({ ...form, laboratory: event.target.value })} placeholder="Nome do laboratório" /></label>
                )}
                <label>Enviado ao laboratório em<input type="date" value={form.lab_sent_date} onChange={(event) => setForm({ ...form, lab_sent_date: event.target.value })} /></label>
                <label>Laboratório entrega em<input type="date" value={form.lab_due_date} onChange={(event) => setForm({ ...form, lab_due_date: event.target.value })} /></label>
                {daysLabel(daysInLab(form.lab_sent_date, form.lab_due_date)) ? (
                  <p className={styles.helper} style={{ gridColumn: '1 / -1', margin: 0, color: '#c084fc', fontWeight: 800, fontSize: 13 }}>
                    ⏱ {daysLabel(daysInLab(form.lab_sent_date, form.lab_due_date))}
                  </p>
                ) : null}
              </div>
            </section>

            <section className={styles.formSection}>
              <h3>Grau (OD / OE)</h3>
              <div className={styles.gradeInputs}>
                <div><b></b><b>Esférico</b><b>Cilíndrico</b><b>Eixo</b><b>Adição</b></div>
                <div>
                  <strong>OD</strong>
                  <input inputMode="decimal" value={form.od_sphere} onChange={(event) => setForm({ ...form, od_sphere: event.target.value })} placeholder="0,00" />
                  <input inputMode="decimal" value={form.od_cylinder} onChange={(event) => setForm({ ...form, od_cylinder: event.target.value })} placeholder="0,00" />
                  <input inputMode="numeric" value={form.od_axis} onChange={(event) => setForm({ ...form, od_axis: event.target.value })} placeholder="0-180" />
                  <input inputMode="decimal" value={form.od_addition} onChange={(event) => setForm({ ...form, od_addition: event.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <strong>OE</strong>
                  <input inputMode="decimal" value={form.oe_sphere} onChange={(event) => setForm({ ...form, oe_sphere: event.target.value })} placeholder="0,00" />
                  <input inputMode="decimal" value={form.oe_cylinder} onChange={(event) => setForm({ ...form, oe_cylinder: event.target.value })} placeholder="0,00" />
                  <input inputMode="numeric" value={form.oe_axis} onChange={(event) => setForm({ ...form, oe_axis: event.target.value })} placeholder="0-180" />
                  <input inputMode="decimal" value={form.oe_addition} onChange={(event) => setForm({ ...form, oe_addition: event.target.value })} placeholder="0,00" />
                </div>
              </div>
              <div className={styles.formGrid} style={{ marginTop: 12 }}>
                <label>DNP<input maxLength={60} value={form.dnp} onChange={(event) => setForm({ ...form, dnp: event.target.value })} placeholder="Ex: 31/31" /></label>
                <label>Altura (montagem)<input maxLength={60} value={form.altura} onChange={(event) => setForm({ ...form, altura: event.target.value })} placeholder="Ex: 21/21" /></label>
                <p className={styles.helper} style={{ gridColumn: '1 / -1', margin: 0 }}>A altura é medida em mm, do centro da pupila até a borda de baixo da lente. É o que o laboratório pede para montar multifocal e progressiva.</p>
              </div>
            </section>

            <section className={styles.formSection}>
              <h3>Valores e entrega</h3>
              <div className={styles.formGrid}>
                <label>Valor total (R$)<input inputMode="decimal" value={form.total} onChange={(event) => setForm({ ...form, total: event.target.value })} placeholder="0,00" /></label>
                <label>Entrada / sinal (R$)<input inputMode="decimal" value={form.down_payment} onChange={(event) => setForm({ ...form, down_payment: event.target.value })} placeholder="0,00" /></label>
                <label>Saldo a pagar<input value={brl(balance(form.total, form.down_payment))} disabled /></label>
                <label>Forma de pagamento<select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}><option value="">Selecione...</option>{PAYMENT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label>Vendedor(a)<select value={form.vendedor_id} onChange={(event) => setForm({ ...form, vendedor_id: event.target.value })}><option value="">Selecione...</option>{team.map((member) => <option key={member.id} value={member.id}>{member.nome}</option>)}</select></label>
                <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ServiceOrderStatus })}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label>Data de entrega<input type="date" value={form.delivery_date} onChange={(event) => setForm({ ...form, delivery_date: event.target.value })} /></label>
                <label className={styles.fullField}>Observações<textarea rows={3} maxLength={5000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Detalhes do pedido, prazo, combinados com o cliente..." /></label>
              </div>
              <p className={styles.helper} style={{ marginTop: 10 }}>Esta O.S. entra em <strong>Orçamentos</strong> automaticamente. Ela só conta como <strong>faturamento realizado</strong> quando o status for <strong>“Entregue”</strong> — antes disso fica como negociação. “Cancelada” cancela a venda.</p>
            </section>

            <div className={styles.modalFooter}><button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : (editingId ? 'Atualizar O.S.' : 'Criar O.S.')}</button></div>
          </form>
        </div>
      )}

      {selectedOrder && (() => {
        const order = selectedOrder;
        const info = statusInfo(order.status);
        const saldo = (order.total || 0) - (order.down_payment || 0);
        const g = (value: number | null) => (value === null || value === undefined ? '—' : String(value));
        const vendedor = team.find((member) => member.id === order.vendedor_id)?.nome;
        const hasGrau = [order.od_sphere, order.od_cylinder, order.od_axis, order.od_addition, order.oe_sphere, order.oe_cylinder, order.oe_axis, order.oe_addition].some((v) => v !== null);
        return (
          <div className={styles.overlay} onMouseDown={() => setViewId(null)}>
            <article className={`${styles.modal} ${styles.profileModal}`} onMouseDown={(event) => event.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <span className={styles.eyebrow}>Ordem de Serviço #{order.os_number}</span>
                  <h2>{order.client_name}</h2>
                  <span style={{ display: 'inline-flex', width: 'fit-content', marginTop: 4, color: info.color, background: info.bg, padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800 }}>{info.label}</span>
                </div>
                <button onClick={() => setViewId(null)}>×</button>
              </div>

              <div className={styles.profileActions}>
                <button onClick={() => { setViewId(null); openEdit(order); }}>Editar O.S.</button>
                {safeWhatsAppUrl(order.phone) ? <button onClick={() => window.open(safeWhatsAppUrl(order.phone) || '', '_blank', 'noopener,noreferrer')}>Abrir WhatsApp</button> : null}
                <button className={styles.dangerAction} onClick={() => { setViewId(null); void removeOrder(order); }}>Excluir</button>
              </div>

              <section className={styles.profileGrid}>
                <div><span>Telefone / WhatsApp</span><strong>{order.phone ? formatPhone(order.phone) : '—'}</strong></div>
                <div><span>CPF</span><strong>{order.cpf || '—'}</strong></div>
                <div><span>RG</span><strong>{order.rg || '—'}</strong></div>
                <div><span>Vendedor(a)</span><strong>{vendedor || '—'}</strong></div>
              </section>

              <section className={styles.detailSection}>
                <h3>Produto</h3>
                <section className={styles.profileGrid}>
                  <div><span>Tipo de produto</span><strong>{order.product_type || '—'}</strong></div>
                  <div><span>Armação</span><strong>{order.frame_description || '—'}</strong></div>
                  <div><span>Laboratório</span>{order.laboratory ? <span style={{ ...LAB_BADGE_STYLE, marginTop: 2 }}>{order.laboratory}</span> : <strong>—</strong>}</div>
                  <div><span>Enviado ao laboratório em</span><strong>{formatDate(order.lab_sent_date)}</strong></div>
                  <div><span>Laboratório entrega em</span><strong>{formatDate(order.lab_due_date)}</strong>{daysLabel(daysInLab(order.lab_sent_date, order.lab_due_date)) ? <em style={{ display: 'block', color: '#c084fc', fontWeight: 800, fontStyle: 'normal', fontSize: 12 }}>⏱ {daysLabel(daysInLab(order.lab_sent_date, order.lab_due_date))}</em> : null}</div>
                  <div className={styles.fullField}><span>Lente</span><strong>{order.lens_description || '—'}</strong></div>
                </section>
              </section>

              <section className={styles.detailSection}>
                <h3>Grau (OD / OE)</h3>
                {hasGrau ? (
                  <div className={styles.gradeTable}>
                    <div><b>Olho</b><b>Esférico</b><b>Cilíndrico</b><b>Eixo</b><b>Adição</b></div>
                    <div><strong>OD</strong><span>{g(order.od_sphere)}</span><span>{g(order.od_cylinder)}</span><span>{g(order.od_axis)}</span><span>{g(order.od_addition)}</span></div>
                    <div><strong>OE</strong><span>{g(order.oe_sphere)}</span><span>{g(order.oe_cylinder)}</span><span>{g(order.oe_axis)}</span><span>{g(order.oe_addition)}</span></div>
                  </div>
                ) : <p className={styles.helper}>Grau não informado.</p>}
                <p className={styles.helper} style={{ marginTop: 10 }}>DNP: {order.dnp || '—'} · Altura: {order.altura || '—'}</p>
              </section>

              <section className={styles.detailSection}>
                <h3>Valores e entrega</h3>
                <section className={styles.profileGrid}>
                  <div><span>Valor total</span><strong>{brl(order.total)}</strong></div>
                  <div><span>Entrada / sinal</span><strong>{brl(order.down_payment)}</strong></div>
                  <div><span>Saldo a pagar</span><strong style={{ color: saldo > 0 ? '#fca5a5' : '#86efac' }}>{brl(saldo)}</strong></div>
                  <div><span>Forma de pagamento</span><strong>{order.payment_method || '—'}</strong></div>
                  <div><span>Data de entrega</span><strong>{formatDate(order.delivery_date)}</strong></div>
                  <div><span>Criada em</span><strong>{formatDate(order.created_at)}</strong></div>
                  <div className={styles.fullField}><span>Observações</span><p>{order.notes || '—'}</p></div>
                </section>
              </section>
            </article>
          </div>
        );
      })()}

      {confirmDialog}
    </div>
  );
}
