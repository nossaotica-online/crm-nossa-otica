'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ClientRecord, ServiceOrder, ServiceOrderStatus } from '@/types/clients';
import type { Profile } from '@/types';
import { toCsv, downloadFile, todayStamp } from '@/lib/csv';
import styles from '../clientes/clientes.module.css';

const PRODUCT_OPTIONS = [
  'Óculos completo', 'Só as lentes', 'Só a armação', 'Óculos de sol', 'Lente de contato', 'Manutenção / conserto',
];

const STATUS_OPTIONS: { value: ServiceOrderStatus; label: string; color: string; bg: string }[] = [
  { value: 'aberta', label: 'Aberta', color: '#cbd5e1', bg: 'rgba(148,163,184,.15)' },
  { value: 'em_producao', label: 'Em produção', color: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
  { value: 'pronta', label: 'Pronta p/ retirar', color: '#22c55e', bg: 'rgba(34,197,94,.15)' },
  { value: 'entregue', label: 'Entregue', color: '#38bdf8', bg: 'rgba(56,189,248,.15)' },
  { value: 'cancelada', label: 'Cancelada', color: '#f87171', bg: 'rgba(239,68,68,.15)' },
];

const statusInfo = (value: ServiceOrderStatus) => STATUS_OPTIONS.find((option) => option.value === value) || STATUS_OPTIONS[0];

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
const intOrNull = (value: string) => {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.round(parsed);
};

interface OrderForm {
  client_id: string;
  client_name: string;
  cpf: string; rg: string; phone: string;
  product_type: string; frame_description: string; lens_description: string;
  od_sphere: string; od_cylinder: string; od_axis: string; od_addition: string;
  oe_sphere: string; oe_cylinder: string; oe_axis: string; oe_addition: string;
  dnp: string;
  total: string; down_payment: string; payment_method: string; vendedor_id: string;
  status: ServiceOrderStatus; delivery_date: string; notes: string;
}

const PAYMENT_OPTIONS = ['Dinheiro', 'PIX', 'Cartão de débito', 'Cartão de crédito', 'Crediário / parcelado', 'Outro'];

const EMPTY_FORM: OrderForm = {
  client_id: '', client_name: '', cpf: '', rg: '', phone: '',
  product_type: '', frame_description: '', lens_description: '',
  od_sphere: '', od_cylinder: '', od_axis: '', od_addition: '',
  oe_sphere: '', oe_cylinder: '', oe_axis: '', oe_addition: '',
  dnp: '', total: '', down_payment: '', payment_method: '', vendedor_id: '', status: 'aberta', delivery_date: '', notes: '',
};

export default function OrdensPage() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
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

  const loadData = async () => {
    setLoading(true);
    const [ordersRes, clientsRes, teamRes] = await Promise.all([
      supabase.from('service_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').eq('status', 'active').order('name'),
      supabase.from('profiles').select('*'),
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
    setLoading(false);
  };

  useEffect(() => { void loadData(); }, []);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const digits = onlyDigits(search);
    return orders.filter((order) => {
      if (statusFilter !== 'todos' && order.status !== statusFilter) return false;
      if (!term) return true;
      if (String(order.os_number).includes(digits) && digits) return true;
      const haystack = normalize([order.client_name, order.cpf, order.product_type, order.notes].filter(Boolean).join(' '));
      const phoneMatch = digits.length >= 3 && onlyDigits(order.phone || '').includes(digits);
      return haystack.includes(term) || phoneMatch;
    });
  }, [orders, search, statusFilter]);

  const balance = (total: string, down: string) => (numberOrNull(total) || 0) - (numberOrNull(down) || 0);

  const pickClient = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (!client) { setForm((f) => ({ ...f, client_id: '', client_name: '' })); return; }
    setForm((f) => ({
      ...f,
      client_id: client.id,
      client_name: client.name,
      cpf: client.cpf || f.cpf,
      rg: client.rg || f.rg,
      phone: formatPhone(client.whatsapp || client.secondary_phone),
    }));
    setClientTerm('');
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
      { label: 'Grau OD', value: (o) => grau(o.od_sphere, o.od_cylinder, o.od_axis, o.od_addition) },
      { label: 'Grau OE', value: (o) => grau(o.oe_sphere, o.oe_cylinder, o.oe_axis, o.oe_addition) },
      { label: 'DNP', value: (o) => o.dnp },
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

  const openNew = () => { setEditingId(null); setForm(EMPTY_FORM); setClientTerm(''); setError(''); setFormOpen(true); };

  const openEdit = (order: ServiceOrder) => {
    const s = (value: number | null) => (value === null || value === undefined ? '' : String(value));
    setEditingId(order.id);
    setForm({
      client_id: order.client_id || '', client_name: order.client_name,
      cpf: order.cpf || '', rg: order.rg || '', phone: order.phone || '',
      product_type: order.product_type || '', frame_description: order.frame_description || '', lens_description: order.lens_description || '',
      od_sphere: s(order.od_sphere), od_cylinder: s(order.od_cylinder), od_axis: s(order.od_axis), od_addition: s(order.od_addition),
      oe_sphere: s(order.oe_sphere), oe_cylinder: s(order.oe_cylinder), oe_axis: s(order.oe_axis), oe_addition: s(order.oe_addition),
      dnp: order.dnp || '', total: s(order.total), down_payment: s(order.down_payment),
      payment_method: order.payment_method || '', vendedor_id: order.vendedor_id || '',
      status: order.status, delivery_date: order.delivery_date || '', notes: order.notes || '',
    });
    setClientTerm('');
    setError('');
    setFormOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const name = form.client_name.trim();
    if (!name) return setError('Informe o nome do cliente.');
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

    const total = numberOrNull(form.total) || 0;
    const payload = {
      client_id: clientId,
      client_name: name,
      cpf: form.cpf.trim() || null, rg: form.rg.trim() || null, phone: phoneDigits || null,
      product_type: form.product_type || null,
      frame_description: form.frame_description.trim() || null,
      lens_description: form.lens_description.trim() || null,
      od_sphere: numberOrNull(form.od_sphere), od_cylinder: numberOrNull(form.od_cylinder), od_axis: intOrNull(form.od_axis), od_addition: numberOrNull(form.od_addition),
      oe_sphere: numberOrNull(form.oe_sphere), oe_cylinder: numberOrNull(form.oe_cylinder), oe_axis: intOrNull(form.oe_axis), oe_addition: numberOrNull(form.oe_addition),
      dnp: form.dnp.trim() || null,
      total, down_payment: numberOrNull(form.down_payment) || 0,
      payment_method: form.payment_method || null,
      vendedor_id: form.vendedor_id || null,
      status: form.status, delivery_date: form.delivery_date || null, notes: form.notes.trim() || null,
    };
    const result = editingId
      ? await supabase.from('service_orders').update(payload).eq('id', editingId).select().single()
      : await supabase.from('service_orders').insert(payload).select().single();
    if (result.error || !result.data) {
      setSaving(false);
      const msg = /row-level security|permission|jwt|401/i.test(result.error?.message || '')
        ? 'você precisa estar logada para gravar. Faça login com sua conta.'
        : (result.error?.message || 'erro desconhecido');
      return setError(`Não foi possível salvar a O.S.: ${msg}`);
    }
    const order = result.data as ServiceOrder;

    // A O.S. já é a venda: mantém um registro em Vendas sincronizado com ela.
    const saleClosed = order.status !== 'cancelada';
    const { error: saleError } = await supabase.from('sales').upsert({
      service_order_id: order.id,
      client_id: clientId,
      vendedor_id: form.vendedor_id || null,
      servico_id: null,
      servico_nome: form.product_type || 'Óculos completos',
      valor: total,
      parcelas: 1,
      status: saleClosed ? 'fechado' : 'cancelado',
      data_fechamento: saleClosed ? new Date().toISOString().slice(0, 10) : null,
      notas: `Gerado automaticamente pela O.S. #${order.os_number}.`,
    }, { onConflict: 'service_order_id' });

    setSaving(false);
    setFormOpen(false);
    setNotice([
      editingId ? 'Ordem atualizada.' : `O.S. #${order.os_number} criada`,
      !editingId && createdClient ? 'e cliente cadastrado! Complete a ficha dele (indicação, família, observações) na aba Clientes.' : null,
      saleClosed ? 'Já lançada em Vendas.' : null,
      saleError ? `(aviso: não foi possível sincronizar com Vendas — ${saleError.message})` : null,
    ].filter(Boolean).join(' '));
    await loadData();
  };

  const changeStatus = async (order: ServiceOrder, status: ServiceOrderStatus) => {
    const { error: err } = await supabase.from('service_orders').update({ status }).eq('id', order.id);
    if (err) return setError(`Não foi possível mudar o status: ${err.message}`);
    const closed = status !== 'cancelada';
    await supabase.from('sales')
      .update({ status: closed ? 'fechado' : 'cancelado', data_fechamento: closed ? new Date().toISOString().slice(0, 10) : null })
      .eq('service_order_id', order.id);
    setNotice(`O.S. #${order.os_number} → ${statusInfo(status).label}.`);
    await loadData();
  };

  const removeOrder = async (order: ServiceOrder) => {
    if (!window.confirm(`Excluir a Ordem de Serviço #${order.os_number} de ${order.client_name}?`)) return;
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
              <thead><tr><th>Nº</th><th>Cliente</th><th>Produto</th><th>Total</th><th>Saldo</th><th>Status</th><th>Entrega</th><th>Ações</th></tr></thead>
              <tbody>
                {filtered.map((order) => {
                  const info = statusInfo(order.status);
                  const saldo = (order.total || 0) - (order.down_payment || 0);
                  return (
                    <tr key={order.id}>
                      <td data-label="Nº"><strong>#{order.os_number}</strong></td>
                      <td data-label="Cliente"><strong>{order.client_name}</strong>{order.phone ? <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatPhone(order.phone)}</div> : null}</td>
                      <td data-label="Produto">{order.product_type || '—'}</td>
                      <td data-label="Total">{brl(order.total)}</td>
                      <td data-label="Saldo" style={{ color: saldo > 0 ? '#fca5a5' : '#86efac', fontWeight: 700 }}>{brl(saldo)}</td>
                      <td data-label="Status"><span style={{ color: info.color, background: info.bg, padding: '4px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>{info.label}</span></td>
                      <td data-label="Entrega">{formatDate(order.delivery_date)}</td>
                      <td data-label="Ações">
                        <div className={styles.actions}>
                          <select value={order.status} onChange={(event) => void changeStatus(order, event.target.value as ServiceOrderStatus)} style={{ padding: '5px 6px', borderRadius: 7, background: 'rgba(255,255,255,.04)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border-strong)', fontSize: 10 }}>
                            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
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
              <h3>Cliente</h3>
              <p className={styles.helper} style={{ marginBottom: 12 }}>Preencha os dados do cliente aqui. Se for cliente novo, ele é <strong>cadastrado automaticamente</strong> ao criar a O.S. — depois você completa a ficha (indicação, família, observações) na aba Clientes.</p>
              <div className={styles.formGrid}>
                <label className={styles.fullField}>Nome do cliente *<input required value={form.client_name} onChange={(event) => setForm({ ...form, client_name: event.target.value })} placeholder="Nome completo" /></label>
                <label>Telefone / WhatsApp<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: formatPhone(event.target.value) })} placeholder="(62) 99999-9999" /></label>
                <label>CPF<input value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} placeholder="000.000.000-00" /></label>
                <label>RG<input value={form.rg} onChange={(event) => setForm({ ...form, rg: event.target.value })} /></label>
              </div>
              {form.client_id ? (
                <p className={styles.helper} style={{ marginTop: 10 }}>✓ Ligado a um cliente já cadastrado. <button type="button" onClick={() => setForm((f) => ({ ...f, client_id: '' }))} style={{ color: 'var(--accent-primary)', fontWeight: 800, background: 'none', border: 0, cursor: 'pointer' }}>Desvincular</button></p>
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
                <label>Armação (marca / modelo / cor)<input value={form.frame_description} onChange={(event) => setForm({ ...form, frame_description: event.target.value })} /></label>
                <label className={styles.fullField}>Lente (tipo / tratamento)<input value={form.lens_description} onChange={(event) => setForm({ ...form, lens_description: event.target.value })} placeholder="Ex: multifocal, antirreflexo, transitions" /></label>
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
                <label>DNP<input value={form.dnp} onChange={(event) => setForm({ ...form, dnp: event.target.value })} placeholder="Ex: 31/31" /></label>
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
                <label className={styles.fullField}>Observações<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Detalhes do pedido, laboratório, prazo..." /></label>
              </div>
              <p className={styles.helper} style={{ marginTop: 10 }}>Ao salvar, esta O.S. entra automaticamente em <strong>Vendas</strong> com este valor. Se o status for “Cancelada”, a venda também fica cancelada.</p>
            </section>

            <div className={styles.modalFooter}><button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : (editingId ? 'Atualizar O.S.' : 'Criar O.S.')}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
