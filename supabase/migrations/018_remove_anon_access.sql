-- ============================================================
-- CRM Nossa Ótica - Migration 018: remover acesso anônimo
-- ============================================================
-- O quiz público da agência antiga foi desativado (rotas /api
-- removidas do app). Estas políticas permitiam que QUALQUER
-- pessoa sem login inserisse leads/agendamentos e — pior —
-- lesse TODOS os agendamentos (nomes, horários, observações).
-- Agora todo acesso exige usuário autenticado.

DROP POLICY IF EXISTS "leads_insert_anon" ON public.leads;
DROP POLICY IF EXISTS "bookings_select_anon" ON public.bookings;
DROP POLICY IF EXISTS "bookings_insert_anon" ON public.bookings;
