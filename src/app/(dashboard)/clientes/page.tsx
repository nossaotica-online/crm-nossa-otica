'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  ClientFormValues,
  ClientPrescription,
  ClientRecord,
  ClientSource,
  FamilyGroup,
  FamilyRelationship,
  OpticalProduct,
  PrescriptionFormValues,
  RelationshipType,
} from '@/types/clients';
import styles from './clientes.module.css';

const PAGE_SIZE = 10;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const SOURCE_OPTIONS: { value: ClientSource; label: string }[] = [
  { value: 'meta', label: 'Meta (Facebook/Instagram Ads)' },
  { value: 'google', label: 'Google' },
  { value: 'instagram', label: 'Instagram orgânico' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'loja', label: 'Passagem pela loja' },
  { value: 'cliente_antigo', label: 'Cliente antigo' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'outro', label: 'Outro' },
];

const PRODUCT_OPTIONS: { value: OpticalProduct; label: string }[] = [
  { value: 'oculos_completo', label: 'Óculos completos' },
  { value: 'lentes', label: 'Lentes' },
  { value: 'armacao', label: 'Armação' },
  { value: 'oculos_sol', label: 'Óculos de sol' },
  { value: 'manutencao', label: 'Manutenção' },
];

const RELATIONSHIP_OPTIONS: { value: RelationshipType; label: string }[] = [
  ['pai', 'Pai'], ['mãe', 'Mãe'], ['filho', 'Filho'], ['filha', 'Filha'],
  ['marido', 'Marido'], ['esposa', 'Esposa'], ['companheiro', 'Companheiro'],
  ['companheira', 'Companheira'], ['irmão', 'Irmão'], ['irmã', 'Irmã'],
  ['avô', 'Avô'], ['avó', 'Avó'], ['neto', 'Neto'], ['neta', 'Neta'],
  ['tio', 'Tio'], ['tia', 'Tia'], ['primo', 'Primo'], ['prima', 'Prima'],
  ['sogro', 'Sogro'], ['sogra', 'Sogra'], ['genro', 'Genro'], ['nora', 'Nora'],
  ['outro', 'Outro'],
].map(([value, label]) => ({ value: value as RelationshipType, label }));

const EMPTY_FORM: ClientFormValues = {
  name: '', whatsapp: '', secondary_phone: '', birth_date: '', email: '', notes: '',
  family_group_id: '', referred_by_client_id: '', related_client_id: '', relationship_type: 'outro',
  source: '', source_details: '', product_interests: [],
};

const emptyPrescriptionForm = (): PrescriptionFormValues => ({
  prescription_date: new Date().toISOString().slice(0, 10), doctor_name: '', doctor_crm: '',
  od_sphere: '', od_cylinder: '', od_axis: '', od_addition: '',
  oe_sphere: '', oe_cylinder: '', oe_axis: '', oe_addition: '',
  dnp_right: '', dnp_left: '', notes: '',
});

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const normalizeWhatsapp = (value: string) => {
  let digits = onlyDigits(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  return digits.slice(0, 11);
};

const formatPhone = (value: string) => {
  const digits = normalizeWhatsapp(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`))
  : 'Não informada';

const relationLabel = (value: RelationshipType) =>
  RELATIONSHIP_OPTIONS.find((option) => option.value === value)?.label || value;

const sourceLabel = (value: ClientSource) => SOURCE_OPTIONS.find((option) => option.value === value)?.label || value;
const productLabel = (value: OpticalProduct) => PRODUCT_OPTIONS.find((option) => option.value === value)?.label || value;
const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
const searchableDate = (value: string | null) => {
  if (!value) return '';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return [
    value.slice(0, 10),
    new Intl.DateTimeFormat('pt-BR').format(date),
    new Intl.DateTimeFormat('pt-BR', { month: '2-digit', year: 'numeric' }).format(date),
    new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date),
    new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date),
    String(date.getFullYear()),
  ].join(' ');
};

// Traduz erros de gravação: o mais comum aqui é não estar logado (RLS/401).
const describeWriteError = (error: { code?: string; message?: string } | null) => {
  if (!error) return 'erro desconhecido';
  const msg = error.message || '';
  if (error.code === '42501' || /row-level security|not authorized|permission denied|jwt|401/i.test(msg)) {
    return 'você precisa estar logada para gravar. Faça login com sua conta — o acesso de teste sem login é somente leitura.';
  }
  return msg || 'erro desconhecido';
};

// Busca de indicador/familiar: telefone com ou sem formatação, nome sem acento.
const matchesClientSearch = (client: ClientRecord, rawTerm: string) => {
  const term = rawTerm.trim();
  if (!term) return true;
  const digits = onlyDigits(term);
  if (digits.length >= 3 && (client.whatsapp.includes(digits) || (client.secondary_phone || '').includes(digits))) return true;
  return normalizeSearch(client.name).includes(normalizeSearch(term));
};

export default function ClientesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [groups, setGroups] = useState<FamilyGroup[]>([]);
  const [relationships, setRelationships] = useState<FamilyRelationship[]>([]);
  const [prescriptions, setPrescriptions] = useState<ClientPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [letterFilter, setLetterFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewClientId, setViewClientId] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormValues>(EMPTY_FORM);
  const [newGroupName, setNewGroupName] = useState('');
  const [relationClientId, setRelationClientId] = useState('');
  const [relationType, setRelationType] = useState<RelationshipType>('outro');
  const [referrerSearch, setReferrerSearch] = useState('');
  const [familySearch, setFamilySearch] = useState('');
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<string | null>(null);
  const [prescriptionForm, setPrescriptionForm] = useState<PrescriptionFormValues>(emptyPrescriptionForm());

  const loadData = async () => {
    setLoading(true);
    setError('');
    const [clientsResult, groupsResult, relationshipsResult, prescriptionsResult] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('family_groups').select('*').order('name'),
      supabase.from('family_relationships').select('*').order('created_at'),
      supabase.from('client_prescriptions').select('*').order('prescription_date', { ascending: false }),
    ]);

    const firstError = clientsResult.error || groupsResult.error || relationshipsResult.error || prescriptionsResult.error;
    if (firstError) {
      setError(firstError.message.includes('schema cache')
        ? 'O módulo Clientes ainda não foi aplicado no Supabase. Execute as migrations 016 e 017.'
        : `Não foi possível carregar os clientes: ${firstError.message}`);
    } else {
      setClients((clientsResult.data || []) as ClientRecord[]);
      setGroups((groupsResult.data || []) as FamilyGroup[]);
      setRelationships((relationshipsResult.data || []) as FamilyRelationship[]);
      setPrescriptions((prescriptionsResult.data || []) as ClientPrescription[]);
    }
    setLoading(false);
  };

  useEffect(() => { void loadData(); }, []);

  const clientById = (id: string | null) => clients.find((client) => client.id === id) || null;
  const groupById = (id: string | null) => groups.find((group) => group.id === id) || null;
  const selectedClient = clientById(viewClientId);

  const duplicateClient = useMemo(() => {
    const normalized = normalizeWhatsapp(form.whatsapp);
    if (normalized.length < 10) return null;
    return clients.find((client) => client.whatsapp === normalized && client.id !== editingId) || null;
  }, [clients, editingId, form.whatsapp]);

  const filteredClients = useMemo(() => {
    const term = normalizeSearch(search);
    return clients.filter((client) => {
      if (!showArchived && client.status === 'archived') return false;
      const normalizedName = normalizeSearch(client.name);
      if (letterFilter && !normalizedName.startsWith(normalizeSearch(letterFilter))) return false;
      if (!term) return true;
      if (term.length === 1 && /^[a-z]$/.test(term)) return normalizedName.startsWith(term);
      const familyNames = relationships
        .filter((relationship) => relationship.client_id === client.id)
        .map((relationship) => clientById(relationship.related_client_id)?.name || '')
        .join(' ');
      const referrer = clientById(client.referred_by_client_id)?.name || '';
      const group = groupById(client.family_group_id)?.name || '';
      const clientPrescriptions = prescriptions.filter((prescription) => prescription.client_id === client.id);
      const haystack = normalizeSearch([
        client.name, client.whatsapp, formatPhone(client.whatsapp), client.secondary_phone, client.notes,
        familyNames, referrer, group, sourceLabel(client.source), client.source_details,
        client.product_interests.map(productLabel).join(' '), searchableDate(client.created_at),
        searchableDate(client.birth_date), clientPrescriptions.map((item) => `${searchableDate(item.prescription_date)} ${item.doctor_name || ''}`).join(' '),
      ].filter(Boolean).join(' '));
      return term.split(/\s+/).every((token) => haystack.includes(token));
    });
  }, [clients, groups, relationships, prescriptions, search, showArchived, letterFilter]);

  useEffect(() => { setPage(1); }, [search, showArchived, letterFilter]);

  // Pesquisou o indicador e só 1 cliente bate? Seleciona sozinho.
  useEffect(() => {
    const term = referrerSearch.trim();
    if (!term || !formOpen) return;
    const matches = clients.filter((client) => client.id !== editingId && matchesClientSearch(client, term));
    if (matches.length !== 1) return;
    const match = matches[0];
    setForm((current) => (current.referred_by_client_id === match.id ? current : { ...current, referred_by_client_id: match.id }));
  }, [referrerSearch, clients, editingId, formOpen]);

  // Mesma coisa para a pesquisa de familiar (no cadastro e no perfil).
  useEffect(() => {
    const term = familySearch.trim();
    if (!term) return;
    const baseId = formOpen ? editingId : viewClientId;
    const alreadyRelated = viewClientId
      ? relationships.filter((relationship) => relationship.client_id === viewClientId).map((relationship) => relationship.related_client_id)
      : [];
    const matches = clients.filter((client) => client.id !== baseId && !alreadyRelated.includes(client.id) && matchesClientSearch(client, term));
    if (matches.length !== 1) return;
    const match = matches[0];
    if (formOpen) {
      setForm((current) => (current.related_client_id === match.id ? current : { ...current, related_client_id: match.id }));
    } else if (viewClientId) {
      setRelationClientId((current) => (current === match.id ? current : match.id));
    }
  }, [familySearch, clients, editingId, viewClientId, relationships, formOpen]);
  const pageCount = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const paginatedClients = filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openNewClient = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setNewGroupName('');
    setReferrerSearch('');
    setFamilySearch('');
    setError('');
    setFormOpen(true);
  };

  const openEditClient = (client: ClientRecord) => {
    setEditingId(client.id);
    setForm({
      name: client.name,
      whatsapp: formatPhone(client.whatsapp),
      secondary_phone: client.secondary_phone ? formatPhone(client.secondary_phone) : '',
      birth_date: client.birth_date || '',
      email: client.email || '',
      notes: client.notes || '',
      family_group_id: client.family_group_id || '',
      referred_by_client_id: client.referred_by_client_id || '',
      related_client_id: '',
      relationship_type: 'outro',
      source: client.source,
      source_details: client.source_details || '',
      product_interests: client.product_interests || [],
    });
    setNewGroupName('');
    setReferrerSearch('');
    setFamilySearch('');
    setError('');
    setFormOpen(true);
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (name.length < 2) return setError('Informe um nome válido para o grupo familiar.');
    const existing = groups.find((group) => group.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
    if (existing) {
      setForm((current) => ({ ...current, family_group_id: existing.id }));
      setNewGroupName('');
      return;
    }
    const { data, error: groupError } = await supabase.from('family_groups').insert({ name }).select().single();
    if (groupError) return setError(`Não foi possível criar o grupo: ${describeWriteError(groupError)}`);
    const group = data as FamilyGroup;
    setGroups((current) => [...current, group].sort((a, b) => a.name.localeCompare(b.name)));
    setForm((current) => ({ ...current, family_group_id: group.id }));
    setNewGroupName('');
  };

  const saveClient = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const whatsapp = normalizeWhatsapp(form.whatsapp);
    if (form.name.trim().length < 2) return setError('O nome completo é obrigatório.');
    if (whatsapp.length < 10) return setError('Informe um WhatsApp brasileiro válido com DDD.');
    if (!form.source) return setError('Informe de onde veio o cliente.');
    if (form.source === 'indicacao' && !form.referred_by_client_id) return setError('Selecione quem indicou este cliente.');
    if (duplicateClient) return setError('Este número já pertence a um cliente cadastrado.');
    if (form.referred_by_client_id && form.referred_by_client_id === editingId) return setError('Um cliente não pode indicar a si mesmo.');

    setSaving(true);
    const payload = {
      name: form.name.trim(), whatsapp,
      secondary_phone: normalizeWhatsapp(form.secondary_phone) || null,
      birth_date: form.birth_date || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      family_group_id: form.family_group_id || null,
      referred_by_client_id: form.source === 'indicacao' ? (form.referred_by_client_id || null) : null,
      source: form.source,
      source_details: form.source_details.trim() || null,
      product_interests: form.product_interests,
    };

    let savedClient: ClientRecord | null = null;
    let saveError: { message: string; code?: string } | null = null;
    if (editingId) {
      const result = await supabase.from('clients').update(payload).eq('id', editingId).select().single();
      savedClient = result.data as ClientRecord | null;
      saveError = result.error;
    } else {
      const result = await supabase.from('clients').insert(payload).select().single();
      savedClient = result.data as ClientRecord | null;
      saveError = result.error;
    }

    if (saveError || !savedClient) {
      setSaving(false);
      return setError(saveError?.code === '23505'
        ? 'Este número já pertence a um cliente cadastrado.'
        : `Não foi possível salvar o cliente: ${describeWriteError(saveError)}`);
    }

    if (!editingId && form.related_client_id) {
      const { error: relationError } = await supabase.rpc('set_family_relationship', {
        p_client_id: savedClient.id,
        p_related_client_id: form.related_client_id,
        p_relationship_type: form.relationship_type,
      });
      if (relationError) setError(`Cliente salvo, mas o vínculo familiar falhou: ${relationError.message}`);
    }

    setSaving(false);
    setFormOpen(false);
    setNotice(editingId ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
    await loadData();
    setViewClientId(savedClient.id);
  };

  const setArchiveStatus = async (client: ClientRecord) => {
    const nextStatus = client.status === 'active' ? 'archived' : 'active';
    if (!window.confirm(`${nextStatus === 'archived' ? 'Arquivar' : 'Reativar'} ${client.name}?`)) return;
    const { error: updateError } = await supabase.from('clients').update({ status: nextStatus }).eq('id', client.id);
    if (updateError) return setError(`Não foi possível alterar o status: ${updateError.message}`);
    if (nextStatus === 'archived') setViewClientId(null);
    setNotice(nextStatus === 'archived' ? 'Cliente arquivado.' : 'Cliente reativado.');
    await loadData();
  };

  const deleteClient = async (client: ClientRecord) => {
    if (!window.confirm(`Excluir permanentemente ${client.name}? Os vínculos serão removidos, mas os familiares não serão excluídos.`)) return;
    const { error: deleteError } = await supabase.from('clients').delete().eq('id', client.id);
    if (deleteError) return setError(`Não foi possível excluir: ${deleteError.message}`);
    setViewClientId(null);
    setNotice('Cliente excluído. Nenhum familiar foi apagado.');
    await loadData();
  };

  const addRelationship = async () => {
    if (!selectedClient || !relationClientId) return setError('Selecione um familiar.');
    const { error: relationError } = await supabase.rpc('set_family_relationship', {
      p_client_id: selectedClient.id,
      p_related_client_id: relationClientId,
      p_relationship_type: relationType,
    });
    if (relationError) return setError(`Não foi possível vincular o familiar: ${relationError.message}`);
    setRelationClientId('');
    setRelationType('outro');
    setNotice('Relacionamento familiar salvo nos dois perfis.');
    await loadData();
  };

  const removeRelationship = async (relatedClientId: string) => {
    if (!selectedClient || !window.confirm('Remover apenas este vínculo familiar?')) return;
    const { error: relationError } = await supabase.rpc('remove_family_relationship', {
      p_client_id: selectedClient.id,
      p_related_client_id: relatedClientId,
    });
    if (relationError) return setError(`Não foi possível remover o vínculo: ${relationError.message}`);
    setNotice('Vínculo removido. Os clientes foram preservados.');
    await loadData();
  };

  const openWhatsapp = (client: ClientRecord) => {
    window.open(`https://wa.me/55${normalizeWhatsapp(client.whatsapp)}`, '_blank', 'noopener,noreferrer');
  };

  const openNewPrescription = () => {
    setEditingPrescriptionId(null);
    setPrescriptionForm(emptyPrescriptionForm());
    setPrescriptionOpen(true);
    setError('');
  };

  const openEditPrescription = (prescription: ClientPrescription) => {
    const value = (field: number | null) => field === null ? '' : String(field);
    setEditingPrescriptionId(prescription.id);
    setPrescriptionForm({
      prescription_date: prescription.prescription_date,
      doctor_name: prescription.doctor_name || '', doctor_crm: prescription.doctor_crm || '',
      od_sphere: value(prescription.od_sphere), od_cylinder: value(prescription.od_cylinder),
      od_axis: value(prescription.od_axis), od_addition: value(prescription.od_addition),
      oe_sphere: value(prescription.oe_sphere), oe_cylinder: value(prescription.oe_cylinder),
      oe_axis: value(prescription.oe_axis), oe_addition: value(prescription.oe_addition),
      dnp_right: value(prescription.dnp_right), dnp_left: value(prescription.dnp_left),
      notes: prescription.notes || '',
    });
    setPrescriptionOpen(true);
    setError('');
  };

  const savePrescription = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedClient) return;
    const gradeFields = [
      prescriptionForm.od_sphere, prescriptionForm.od_cylinder, prescriptionForm.od_axis, prescriptionForm.od_addition,
      prescriptionForm.oe_sphere, prescriptionForm.oe_cylinder, prescriptionForm.oe_axis, prescriptionForm.oe_addition,
    ];
    if (!gradeFields.some((value) => value !== '')) return setError('Informe pelo menos um valor de grau para OD ou OE.');
    const numberOrNull = (value: string) => {
      if (value.trim() === '') return null;
      const parsed = Number(value.replace(',', '.'));
      return Number.isNaN(parsed) ? null : parsed;
    };
    const intOrNull = (value: string) => {
      const parsed = numberOrNull(value);
      return parsed === null ? null : Math.round(parsed);
    };
    const payload = {
      client_id: selectedClient.id,
      prescription_date: prescriptionForm.prescription_date,
      doctor_name: prescriptionForm.doctor_name.trim() || null,
      doctor_crm: prescriptionForm.doctor_crm.trim() || null,
      od_sphere: numberOrNull(prescriptionForm.od_sphere), od_cylinder: numberOrNull(prescriptionForm.od_cylinder),
      od_axis: intOrNull(prescriptionForm.od_axis), od_addition: numberOrNull(prescriptionForm.od_addition),
      oe_sphere: numberOrNull(prescriptionForm.oe_sphere), oe_cylinder: numberOrNull(prescriptionForm.oe_cylinder),
      oe_axis: intOrNull(prescriptionForm.oe_axis), oe_addition: numberOrNull(prescriptionForm.oe_addition),
      dnp_right: numberOrNull(prescriptionForm.dnp_right), dnp_left: numberOrNull(prescriptionForm.dnp_left),
      notes: prescriptionForm.notes.trim() || null,
    };
    setSaving(true);
    const result = editingPrescriptionId
      ? await supabase.from('client_prescriptions').update(payload).eq('id', editingPrescriptionId)
      : await supabase.from('client_prescriptions').insert(payload);
    setSaving(false);
    if (result.error) return setError(`Não foi possível salvar a receita: ${result.error.message}`);
    setPrescriptionOpen(false);
    setNotice(editingPrescriptionId ? 'Receita atualizada.' : 'Receita adicionada ao histórico.');
    await loadData();
  };

  const deletePrescription = async (prescription: ClientPrescription) => {
    if (!window.confirm(`Excluir a receita de ${formatDate(prescription.prescription_date)}?`)) return;
    const { error: prescriptionError } = await supabase.from('client_prescriptions').delete().eq('id', prescription.id);
    if (prescriptionError) return setError(`Não foi possível excluir a receita: ${prescriptionError.message}`);
    setNotice('Receita excluída.');
    await loadData();
  };

  const selectedRelationships = selectedClient
    ? relationships.filter((relationship) => relationship.client_id === selectedClient.id)
    : [];
  const selectedReferrals = selectedClient
    ? clients.filter((client) => client.referred_by_client_id === selectedClient.id)
    : [];
  const selectedGroupMembers = selectedClient?.family_group_id
    ? clients.filter((client) => client.family_group_id === selectedClient.family_group_id && client.id !== selectedClient.id)
    : [];
  const selectedPrescriptions = selectedClient
    ? prescriptions.filter((prescription) => prescription.client_id === selectedClient.id)
    : [];
  const otherClients = clients.filter((client) => client.id !== editingId);
  const matchingReferrers = clients.filter((client) => {
    if (client.id === editingId) return false;
    // Quem já está selecionado permanece na lista mesmo que a pesquisa mude.
    if (client.id === form.referred_by_client_id) return true;
    return matchesClientSearch(client, referrerSearch);
  });
  const matchingRelatives = clients.filter((client) => {
    if (client.id === (editingId || selectedClient?.id)) return false;
    if (selectedRelationships.some((relationship) => relationship.related_client_id === client.id)) return false;
    if (client.id === form.related_client_id || client.id === relationClientId) return true;
    return matchesClientSearch(client, familySearch);
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Nossa Ótica CRM</span>
          <h1>Clientes</h1>
          <p>Cadastro central de clientes, indicações e famílias.</p>
        </div>
        <button className="btn btn-primary" onClick={openNewClient}>+ Novo cliente</button>
      </header>

      {error && <div className={styles.errorBanner}>{error}<button onClick={() => setError('')}>×</button></div>}
      {notice && <div className={styles.noticeBanner}>{notice}<button onClick={() => setNotice('')}>×</button></div>}

      <section className={styles.toolbar}>
        <div className={styles.searchBox}>
          <span>⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone, data (11/07/2026), origem, produto, familiar..." />
        </div>
        <label className={styles.archiveToggle}>
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
          Mostrar arquivados
        </label>
        <div className={styles.totalCard}><strong>{filteredClients.length}</strong><span>clientes encontrados</span></div>
      </section>

      <nav className={styles.alphabetFilter} aria-label="Filtrar clientes pela letra inicial">
        <button className={!letterFilter ? styles.activeLetter : ''} onClick={() => setLetterFilter('')}>Todos</button>
        {ALPHABET.map((letter) => <button key={letter} className={letterFilter === letter ? styles.activeLetter : ''} onClick={() => setLetterFilter(letter)}>{letter}</button>)}
      </nav>

      <section className={styles.tableCard}>
        {loading ? (
          <div className={styles.emptyState}>Carregando clientes...</div>
        ) : filteredClients.length === 0 ? (
          <div className={styles.emptyState}><strong>Nenhum cliente encontrado</strong><span>Cadastre o primeiro cliente ou ajuste sua pesquisa.</span></div>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Origem</th><th>Produto</th><th>Parentesco</th><th>Familiar</th><th>Grupo familiar</th><th>Quem indicou</th><th>Cadastro</th><th>Observação</th><th>Ações</th></tr></thead>
                <tbody>
                  {paginatedClients.map((client) => {
                    const rowRelationships = relationships.filter((relationship) => relationship.client_id === client.id);
                    const firstRelationship = rowRelationships[0];
                    const relatedClient = clientById(firstRelationship?.related_client_id || null);
                    return (
                      <tr key={client.id} className={client.status === 'archived' ? styles.archivedRow : ''} onClick={() => setViewClientId(client.id)}>
                        <td data-label="Cliente"><strong>{client.name}</strong>{client.status === 'archived' && <span className={styles.statusPill}>Arquivado</span>}</td>
                        <td data-label="WhatsApp">{formatPhone(client.whatsapp)}</td>
                        <td data-label="Origem">{sourceLabel(client.source)}</td>
                        <td data-label="Produto">{client.product_interests.length ? client.product_interests.map(productLabel).join(', ') : '—'}</td>
                        <td data-label="Parentesco">{firstRelationship ? relationLabel(firstRelationship.relationship_type) : '—'}</td>
                        <td data-label="Familiar">{relatedClient?.name || '—'}{rowRelationships.length > 1 ? ` +${rowRelationships.length - 1}` : ''}</td>
                        <td data-label="Grupo">{groupById(client.family_group_id)?.name || '—'}</td>
                        <td data-label="Quem indicou">{clientById(client.referred_by_client_id)?.name || '—'}</td>
                        <td data-label="Cadastro">{formatDate(client.created_at)}</td>
                        <td data-label="Observação" className={styles.noteCell}>{client.notes || '—'}</td>
                        <td data-label="Ações" onClick={(event) => event.stopPropagation()}>
                          <div className={styles.actions}>
                            <button title="Visualizar" onClick={() => setViewClientId(client.id)}>Ver</button>
                            <button title="Editar" onClick={() => openEditClient(client)}>Editar</button>
                            <button title="Abrir WhatsApp" onClick={() => openWhatsapp(client)}>WhatsApp</button>
                            <button title={client.status === 'active' ? 'Arquivar' : 'Reativar'} onClick={() => void setArchiveStatus(client)}>{client.status === 'active' ? 'Arquivar' : 'Reativar'}</button>
                            <button className={styles.dangerAction} title="Excluir" onClick={() => void deleteClient(client)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className={styles.pagination}>
              <span>Página {page} de {pageCount}</span>
              <div><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Próxima</button></div>
            </footer>
          </>
        )}
      </section>

      {formOpen && (
        <div className={styles.overlay} onMouseDown={() => !saving && setFormOpen(false)}>
          <form className={styles.modal} onSubmit={saveClient} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}><div><span className={styles.eyebrow}>{editingId ? 'Atualizar cadastro' : 'Novo cadastro'}</span><h2>{editingId ? 'Editar cliente' : 'Novo cliente'}</h2></div><button type="button" onClick={() => setFormOpen(false)}>×</button></div>
            {error && <div className={styles.errorBanner}>{error}<button type="button" onClick={() => setError('')}>×</button></div>}
            <section className={styles.formSection}>
              <h3>Dados principais</h3>
              <div className={styles.formGrid}>
                <label className={styles.fullField}>Nome completo *<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                <label>WhatsApp / telefone principal *<input required type="tel" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: formatPhone(event.target.value) })} placeholder="(11) 99999-9999" /></label>
                <label>Telefone secundário<input type="tel" value={form.secondary_phone} onChange={(event) => setForm({ ...form, secondary_phone: formatPhone(event.target.value) })} /></label>
                {duplicateClient && <div className={`${styles.duplicateWarning} ${styles.fullField}`}><span>Este número já pertence a um cliente cadastrado.</span><button type="button" onClick={() => { setFormOpen(false); setViewClientId(duplicateClient.id); }}>Abrir cadastro existente</button></div>}
                <label>Data de nascimento<input type="date" value={form.birth_date} onChange={(event) => setForm({ ...form, birth_date: event.target.value })} /></label>
                <label>E-mail<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                <label>Data do cadastro<input value={editingId ? formatDate(clientById(editingId)?.created_at || null) : 'Preenchida automaticamente'} disabled /></label>
                <label className={styles.fullField}>Observações<textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Preferências, histórico, retorno, orçamento e informações importantes" /></label>
              </div>
            </section>

            <section className={styles.formSection}>
              <h3>Origem e produto</h3>
              <div className={styles.formGrid}>
                <label>De onde veio o cliente? *<select required value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as ClientSource, referred_by_client_id: event.target.value === 'indicacao' ? form.referred_by_client_id : '' })}><option value="">Selecione a origem...</option>{SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label>Detalhe da origem<input value={form.source_details} onChange={(event) => setForm({ ...form, source_details: event.target.value })} placeholder="Ex: campanha de julho, passou na loja" /></label>
                <fieldset className={`${styles.productChoices} ${styles.fullField}`}><legend>Produto de interesse</legend>{PRODUCT_OPTIONS.map((option) => <label key={option.value}><input type="checkbox" checked={form.product_interests.includes(option.value)} onChange={(event) => setForm({ ...form, product_interests: event.target.checked ? [...form.product_interests, option.value] : form.product_interests.filter((item) => item !== option.value) })} /><span>{option.label}</span></label>)}</fieldset>
              </div>
            </section>

            <section className={styles.formSection}>
              <h3>Indicação</h3>
              {form.source === 'indicacao' ? <div className={styles.selectorSearch}><input value={referrerSearch} onChange={(event) => setReferrerSearch(event.target.value)} placeholder="Pesquisar indicador por nome ou telefone" /><label>Quem indicou este cliente? *<select required value={form.referred_by_client_id} onChange={(event) => setForm({ ...form, referred_by_client_id: event.target.value })}><option value="">Selecione quem indicou...</option>{matchingReferrers.map((client) => <option key={client.id} value={client.id}>{client.name} — {formatPhone(client.whatsapp)}</option>)}</select></label>{referrerSearch.trim() !== '' && matchingReferrers.length === 0 && <p className={styles.helper}>Nenhum cliente encontrado com “{referrerSearch}”. Quem indicou precisa estar cadastrado — confira o número ou limpe a pesquisa para ver todos.</p>}</div> : <p className={styles.helper}>Selecione “Indicação” na origem para vincular outro cliente como indicador.</p>}
            </section>

            <section className={styles.formSection}>
              <h3>Grupo e família</h3>
              <div className={styles.formGrid}>
                <label>Grupo familiar<select value={form.family_group_id} onChange={(event) => setForm({ ...form, family_group_id: event.target.value })}><option value="">Sem grupo familiar</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
                <div className={styles.newGroup}><label>Criar novo grupo<input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} placeholder="Ex: Família Silva" /></label><button type="button" onClick={() => void createGroup()}>Criar grupo</button></div>
                {!editingId && otherClients.length > 0 && (
                  <>
                    <label>Vincular familiar<input value={familySearch} onChange={(event) => setFamilySearch(event.target.value)} placeholder="Pesquisar por nome ou telefone" /><select value={form.related_client_id} onChange={(event) => setForm({ ...form, related_client_id: event.target.value })}><option value="">Nenhum</option>{matchingRelatives.map((client) => <option key={client.id} value={client.id}>{client.name} — {formatPhone(client.whatsapp)}</option>)}</select></label>
                    {familySearch.trim() !== '' && matchingRelatives.length === 0 && <p className={`${styles.helper} ${styles.fullField}`}>Nenhum cliente encontrado com “{familySearch}”. Limpe a pesquisa para ver todos.</p>}
                    <label>Tipo de parentesco<select value={form.relationship_type} onChange={(event) => setForm({ ...form, relationship_type: event.target.value as RelationshipType })} disabled={!form.related_client_id}>{RELATIONSHIP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  </>
                )}
              </div>
              <p className={styles.helper}>{editingId
                ? 'Para vincular pai, filho, cônjuge etc., use “Adicionar familiar” no perfil do cliente.'
                : otherClients.length > 0
                  ? 'O vínculo de parentesco é opcional e também pode ser feito depois, no perfil do cliente.'
                  : 'O grupo é opcional. Você poderá vincular familiares (pai, filho, cônjuge…) no perfil do cliente depois de cadastrar mais pessoas.'}</p>
            </section>

            <div className={styles.modalFooter}><button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving || Boolean(duplicateClient)}>{saving ? 'Salvando...' : 'Salvar cliente'}</button></div>
          </form>
        </div>
      )}

      {selectedClient && (
        <div className={styles.overlay} onMouseDown={() => setViewClientId(null)}>
          <article className={`${styles.modal} ${styles.profileModal}`} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}><div><span className={styles.eyebrow}>Perfil do cliente</span><h2>{selectedClient.name}</h2><span className={selectedClient.status === 'active' ? styles.activePill : styles.statusPill}>{selectedClient.status === 'active' ? 'Ativo' : 'Arquivado'}</span></div><button onClick={() => setViewClientId(null)}>×</button></div>
            <div className={styles.profileActions}><button onClick={() => { setViewClientId(null); openEditClient(selectedClient); }}>Editar cliente</button><button onClick={() => openWhatsapp(selectedClient)}>Abrir WhatsApp</button><button onClick={openNewPrescription}>Adicionar receita/grau</button><button onClick={() => { setViewClientId(null); openEditClient(selectedClient); }}>Vincular indicação</button><button onClick={() => document.getElementById('family-linker')?.scrollIntoView({ behavior: 'smooth' })}>Adicionar familiar</button><button onClick={() => void setArchiveStatus(selectedClient)}>{selectedClient.status === 'active' ? 'Arquivar' : 'Reativar'}</button><button className={styles.dangerAction} onClick={() => void deleteClient(selectedClient)}>Excluir</button></div>

            <section className={styles.profileGrid}>
              <div><span>WhatsApp</span><strong>{formatPhone(selectedClient.whatsapp)}</strong></div>
              <div><span>Telefone secundário</span><strong>{selectedClient.secondary_phone ? formatPhone(selectedClient.secondary_phone) : 'Não informado'}</strong></div>
              <div><span>Nascimento</span><strong>{formatDate(selectedClient.birth_date)}</strong></div>
              <div><span>E-mail</span><strong>{selectedClient.email || 'Não informado'}</strong></div>
              <div><span>Cadastro</span><strong>{formatDate(selectedClient.created_at)}</strong></div>
              <div><span>Grupo familiar</span><strong>{groupById(selectedClient.family_group_id)?.name || 'Sem grupo'}</strong></div>
              <div><span>Origem</span><strong>{sourceLabel(selectedClient.source)}{selectedClient.source_details ? ` — ${selectedClient.source_details}` : ''}</strong></div>
              <div><span>Produtos de interesse</span><strong>{selectedClient.product_interests.length ? selectedClient.product_interests.map(productLabel).join(', ') : 'Não informado'}</strong></div>
              <div className={styles.fullField}><span>Indicado por</span>{clientById(selectedClient.referred_by_client_id) ? <button className={styles.profileLink} onClick={() => setViewClientId(selectedClient.referred_by_client_id)}>{clientById(selectedClient.referred_by_client_id)?.name}</button> : <strong>Sem indicação</strong>}</div>
              <div className={styles.fullField}><span>Observações</span><p>{selectedClient.notes || 'Sem observações.'}</p></div>
            </section>

            <section className={styles.detailSection}><div className={styles.sectionHeading}><h3>Histórico de receitas e graus <b>{selectedPrescriptions.length}</b></h3><button onClick={openNewPrescription}>+ Nova receita</button></div>{selectedPrescriptions.length === 0 ? <p className={styles.helper}>Nenhuma receita cadastrada.</p> : <div className={styles.prescriptionList}>{selectedPrescriptions.map((prescription) => <article key={prescription.id} className={styles.prescriptionCard}><header><div><strong>{formatDate(prescription.prescription_date)}</strong><span>{prescription.doctor_name || 'Médico não informado'}{prescription.doctor_crm ? ` · ${prescription.doctor_crm}` : ''}</span></div><div><button onClick={() => openEditPrescription(prescription)}>Editar</button><button className={styles.removeLink} onClick={() => void deletePrescription(prescription)}>Excluir</button></div></header><div className={styles.gradeTable}><div><b>Olho</b><b>Esférico</b><b>Cilíndrico</b><b>Eixo</b><b>Adição</b></div><div><strong>OD</strong><span>{prescription.od_sphere ?? '—'}</span><span>{prescription.od_cylinder ?? '—'}</span><span>{prescription.od_axis ?? '—'}</span><span>{prescription.od_addition ?? '—'}</span></div><div><strong>OE</strong><span>{prescription.oe_sphere ?? '—'}</span><span>{prescription.oe_cylinder ?? '—'}</span><span>{prescription.oe_axis ?? '—'}</span><span>{prescription.oe_addition ?? '—'}</span></div></div><footer>DNP: OD {prescription.dnp_right ?? '—'} mm · OE {prescription.dnp_left ?? '—'} mm{prescription.notes ? ` · ${prescription.notes}` : ''}</footer></article>)}</div>}</section>

            <section className={styles.detailSection}><h3>Pessoas indicadas por este cliente <b>{selectedReferrals.length}</b></h3>{selectedReferrals.length === 0 ? <p className={styles.helper}>Nenhuma indicação vinculada.</p> : <div className={styles.personList}>{selectedReferrals.map((client) => <button key={client.id} onClick={() => setViewClientId(client.id)}><strong>{client.name}</strong><span>{formatPhone(client.whatsapp)} · {formatDate(client.created_at)}</span></button>)}</div>}</section>

            <section className={styles.detailSection}><h3>Família <b>{selectedRelationships.length}</b></h3>{selectedRelationships.length === 0 ? <p className={styles.helper}>Nenhum familiar vinculado.</p> : <div className={styles.personList}>{selectedRelationships.map((relationship) => { const relative = clientById(relationship.related_client_id); return relative ? <div className={styles.personRow} key={relationship.id}><button onClick={() => setViewClientId(relative.id)}><strong>{relative.name}</strong><span>{relationLabel(relationship.relationship_type)} · {formatPhone(relative.whatsapp)}</span></button><button className={styles.removeLink} onClick={() => void removeRelationship(relative.id)}>Remover vínculo</button></div> : null; })}</div>}
              <div className={styles.inlineRelation} id="family-linker"><input value={familySearch} onChange={(event) => setFamilySearch(event.target.value)} placeholder="Pesquisar familiar" /><select value={relationClientId} onChange={(event) => setRelationClientId(event.target.value)}><option value="">Selecionar familiar...</option>{matchingRelatives.map((client) => <option key={client.id} value={client.id}>{client.name} — {formatPhone(client.whatsapp)}</option>)}</select><select value={relationType} onChange={(event) => setRelationType(event.target.value as RelationshipType)}>{RELATIONSHIP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button onClick={() => void addRelationship()}>Adicionar familiar</button></div>
              {familySearch.trim() !== '' && matchingRelatives.length === 0 && <p className={styles.helper}>Nenhum cliente encontrado com “{familySearch}”. Limpe a pesquisa para ver todos.</p>}
            </section>

            {selectedClient.family_group_id && <section className={styles.detailSection}><h3>Membros de {groupById(selectedClient.family_group_id)?.name} <b>{selectedGroupMembers.length + 1}</b></h3><div className={styles.personList}>{selectedGroupMembers.map((client) => <button key={client.id} onClick={() => setViewClientId(client.id)}><strong>{client.name}</strong><span>{formatPhone(client.whatsapp)}</span></button>)}</div></section>}
          </article>
        </div>
      )}

      {prescriptionOpen && selectedClient && (
        <div className={styles.overlay} onMouseDown={() => !saving && setPrescriptionOpen(false)}>
          <form className={styles.modal} onSubmit={savePrescription} onMouseDown={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}><div><span className={styles.eyebrow}>{editingPrescriptionId ? 'Atualizar receita' : 'Nova receita'}</span><h2>Grau de {selectedClient.name}</h2></div><button type="button" onClick={() => setPrescriptionOpen(false)}>×</button></div>
            {error && <div className={styles.errorBanner}>{error}<button type="button" onClick={() => setError('')}>×</button></div>}

            <section className={styles.formSection}>
              <h3>Dados da receita</h3>
              <div className={styles.formGrid}>
                <label>Data da receita *<input required type="date" value={prescriptionForm.prescription_date} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, prescription_date: event.target.value })} /></label>
                <label>Médico (opcional)<input value={prescriptionForm.doctor_name} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, doctor_name: event.target.value })} placeholder="Dr(a). ..." /></label>
                <label>CRM (opcional)<input value={prescriptionForm.doctor_crm} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, doctor_crm: event.target.value })} /></label>
              </div>
            </section>

            <section className={styles.formSection}>
              <h3>Grau (OD / OE)</h3>
              <div className={styles.gradeInputs}>
                <div><b></b><b>Esférico</b><b>Cilíndrico</b><b>Eixo</b><b>Adição</b></div>
                <div>
                  <strong>OD</strong>
                  <input inputMode="decimal" value={prescriptionForm.od_sphere} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, od_sphere: event.target.value })} placeholder="0,00" />
                  <input inputMode="decimal" value={prescriptionForm.od_cylinder} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, od_cylinder: event.target.value })} placeholder="0,00" />
                  <input inputMode="numeric" value={prescriptionForm.od_axis} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, od_axis: event.target.value })} placeholder="0-180" />
                  <input inputMode="decimal" value={prescriptionForm.od_addition} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, od_addition: event.target.value })} placeholder="0,00" />
                </div>
                <div>
                  <strong>OE</strong>
                  <input inputMode="decimal" value={prescriptionForm.oe_sphere} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, oe_sphere: event.target.value })} placeholder="0,00" />
                  <input inputMode="decimal" value={prescriptionForm.oe_cylinder} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, oe_cylinder: event.target.value })} placeholder="0,00" />
                  <input inputMode="numeric" value={prescriptionForm.oe_axis} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, oe_axis: event.target.value })} placeholder="0-180" />
                  <input inputMode="decimal" value={prescriptionForm.oe_addition} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, oe_addition: event.target.value })} placeholder="0,00" />
                </div>
              </div>
              <p className={styles.helper}>Preencha ao menos um valor de OD ou OE. Pode usar vírgula ou ponto (ex: -1,25).</p>
            </section>

            <section className={styles.formSection}>
              <h3>Complementos</h3>
              <div className={styles.formGrid}>
                <label>DNP direita (mm)<input inputMode="decimal" value={prescriptionForm.dnp_right} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, dnp_right: event.target.value })} placeholder="Ex: 31,5" /></label>
                <label>DNP esquerda (mm)<input inputMode="decimal" value={prescriptionForm.dnp_left} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, dnp_left: event.target.value })} placeholder="Ex: 31,5" /></label>
                <label className={styles.fullField}>Observações<textarea rows={3} value={prescriptionForm.notes} onChange={(event) => setPrescriptionForm({ ...prescriptionForm, notes: event.target.value })} placeholder="Tipo de lente, tratamento, retorno e observações do exame" /></label>
              </div>
            </section>

            <div className={styles.modalFooter}><button type="button" className="btn btn-secondary" onClick={() => setPrescriptionOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : (editingPrescriptionId ? 'Atualizar receita' : 'Salvar receita')}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
