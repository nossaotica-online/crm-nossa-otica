-- ============================================================
-- CRM Nossa Ótica - Migration 029: função "funcionario" (balcão)
-- ============================================================
-- Perfil de quem trabalha no balcão: cadastra Ordem de Serviço, atende
-- qualquer cliente da ótica e cuida das tarefas do dia.
--
--   VÊ e MEXE: clientes, receitas/grau, O.S., tarefas, agenda.
--   NÃO VÊ:    faturamento (Orçamentos avulsos), metas, equipe,
--              configurações, painel de início.
--   NÃO APAGA: nenhuma das tabelas acima — só admin/gestor excluem.
--
-- Diferente de 'vendedor', que enxerga apenas os registros dele: o balcão
-- precisa achar o cliente que entrou na loja, mesmo que outra pessoa tenha
-- cadastrado.
--
-- A O.S. grava uma linha em `sales` para o valor chegar ao painel. Por isso
-- o balcão escreve em `sales`, mas SÓ nas linhas amarradas a uma O.S.
-- (service_order_id NOT NULL). Orçamento avulso continua invisível para ele.

BEGIN;

-- ------------------------------------------------------------
-- 1. A nova função passa a ser aceita em profiles
-- ------------------------------------------------------------
-- A regra antiga nasceu junto da coluna (migration 001), então o nome dela
-- pode variar. Remove qualquer CHECK de profiles que fale de role, em vez de
-- apostar num nome: se sobrasse a antiga, 'funcionario' seria recusado.
DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'gestor', 'vendedor', 'consultor', 'funcionario'));

-- ------------------------------------------------------------
-- 2. Helper: é balcão e está ativo?
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_balcao()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_user_role() = 'funcionario', FALSE);
$$;

REVOKE ALL ON FUNCTION public.is_balcao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_balcao() TO authenticated;

-- ------------------------------------------------------------
-- 3. Policies do balcão (sem DELETE em lugar nenhum)
-- ------------------------------------------------------------

-- Clientes
DROP POLICY IF EXISTS clients_balcao_select ON public.clients;
CREATE POLICY clients_balcao_select
  ON public.clients FOR SELECT TO authenticated
  USING (public.is_balcao());
DROP POLICY IF EXISTS clients_balcao_insert ON public.clients;
CREATE POLICY clients_balcao_insert
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_balcao());
DROP POLICY IF EXISTS clients_balcao_update ON public.clients;
CREATE POLICY clients_balcao_update
  ON public.clients FOR UPDATE TO authenticated
  USING (public.is_balcao())
  WITH CHECK (public.is_balcao());

-- Receitas / grau
DROP POLICY IF EXISTS prescriptions_balcao_select ON public.client_prescriptions;
CREATE POLICY prescriptions_balcao_select
  ON public.client_prescriptions FOR SELECT TO authenticated
  USING (public.is_balcao());
DROP POLICY IF EXISTS prescriptions_balcao_insert ON public.client_prescriptions;
CREATE POLICY prescriptions_balcao_insert
  ON public.client_prescriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_balcao());
DROP POLICY IF EXISTS prescriptions_balcao_update ON public.client_prescriptions;
CREATE POLICY prescriptions_balcao_update
  ON public.client_prescriptions FOR UPDATE TO authenticated
  USING (public.is_balcao())
  WITH CHECK (public.is_balcao());

-- Família (só leitura e criação de grupo; os RPCs de vínculo rodam como
-- o próprio usuário e passam a funcionar com estas policies)
DROP POLICY IF EXISTS family_groups_balcao_select ON public.family_groups;
CREATE POLICY family_groups_balcao_select
  ON public.family_groups FOR SELECT TO authenticated
  USING (public.is_balcao());
DROP POLICY IF EXISTS family_groups_balcao_insert ON public.family_groups;
CREATE POLICY family_groups_balcao_insert
  ON public.family_groups FOR INSERT TO authenticated
  WITH CHECK (public.is_balcao());
DROP POLICY IF EXISTS family_relationships_balcao_select ON public.family_relationships;
CREATE POLICY family_relationships_balcao_select
  ON public.family_relationships FOR SELECT TO authenticated
  USING (public.is_balcao());
DROP POLICY IF EXISTS family_relationships_balcao_insert ON public.family_relationships;
CREATE POLICY family_relationships_balcao_insert
  ON public.family_relationships FOR INSERT TO authenticated
  WITH CHECK (public.is_balcao());
DROP POLICY IF EXISTS family_relationships_balcao_delete ON public.family_relationships;
CREATE POLICY family_relationships_balcao_delete
  ON public.family_relationships FOR DELETE TO authenticated
  USING (public.is_balcao());

-- Ordem de Serviço
DROP POLICY IF EXISTS service_orders_balcao_select ON public.service_orders;
CREATE POLICY service_orders_balcao_select
  ON public.service_orders FOR SELECT TO authenticated
  USING (public.is_balcao());
DROP POLICY IF EXISTS service_orders_balcao_insert ON public.service_orders;
CREATE POLICY service_orders_balcao_insert
  ON public.service_orders FOR INSERT TO authenticated
  WITH CHECK (public.is_balcao());
DROP POLICY IF EXISTS service_orders_balcao_update ON public.service_orders;
CREATE POLICY service_orders_balcao_update
  ON public.service_orders FOR UPDATE TO authenticated
  USING (public.is_balcao())
  WITH CHECK (public.is_balcao());

-- Tarefas
DROP POLICY IF EXISTS tasks_balcao_select ON public.tasks;
CREATE POLICY tasks_balcao_select
  ON public.tasks FOR SELECT TO authenticated
  USING (public.is_balcao());
DROP POLICY IF EXISTS tasks_balcao_insert ON public.tasks;
CREATE POLICY tasks_balcao_insert
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_balcao());
DROP POLICY IF EXISTS tasks_balcao_update ON public.tasks;
CREATE POLICY tasks_balcao_update
  ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_balcao())
  WITH CHECK (public.is_balcao());

-- Agenda
DROP POLICY IF EXISTS bookings_balcao_select ON public.bookings;
CREATE POLICY bookings_balcao_select
  ON public.bookings FOR SELECT TO authenticated
  USING (public.is_balcao());
DROP POLICY IF EXISTS bookings_balcao_insert ON public.bookings;
CREATE POLICY bookings_balcao_insert
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (public.is_balcao());
DROP POLICY IF EXISTS bookings_balcao_update ON public.bookings;
CREATE POLICY bookings_balcao_update
  ON public.bookings FOR UPDATE TO authenticated
  USING (public.is_balcao())
  WITH CHECK (public.is_balcao());

-- Vendas: SOMENTE as linhas geradas por uma O.S. Orçamento avulso fica
-- invisível, e ele não consegue criar venda solta nem apagar nada.
DROP POLICY IF EXISTS sales_balcao_os_select ON public.sales;
CREATE POLICY sales_balcao_os_select
  ON public.sales FOR SELECT TO authenticated
  USING (public.is_balcao() AND service_order_id IS NOT NULL);
DROP POLICY IF EXISTS sales_balcao_os_insert ON public.sales;
CREATE POLICY sales_balcao_os_insert
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (public.is_balcao() AND service_order_id IS NOT NULL);
DROP POLICY IF EXISTS sales_balcao_os_update ON public.sales;
CREATE POLICY sales_balcao_os_update
  ON public.sales FOR UPDATE TO authenticated
  USING (public.is_balcao() AND service_order_id IS NOT NULL)
  WITH CHECK (public.is_balcao() AND service_order_id IS NOT NULL);

-- ------------------------------------------------------------
-- 4. O cadastro pelo app passa a aceitar a função nova
--    (mesmo corpo da migration 025, só a lista de funções muda)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_team_member(
  p_email TEXT,
  p_password TEXT,
  p_nome TEXT,
  p_cargo TEXT,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_pw TEXT;
  v_email TEXT := lower(trim(p_email));
  v_nome TEXT := trim(p_nome);
  v_role TEXT := lower(trim(p_role));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores ativos podem criar membros'
      USING ERRCODE = '42501';
  END IF;

  IF v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR char_length(v_email) > 254
  THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '22023';
  END IF;

  IF char_length(p_password) < 12 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 12 caracteres'
      USING ERRCODE = '22023';
  END IF;

  IF char_length(v_nome) < 2 OR char_length(v_nome) > 120 THEN
    RAISE EXCEPTION 'Nome inválido' USING ERRCODE = '22023';
  END IF;

  IF v_role NOT IN ('admin', 'gestor', 'vendedor', 'consultor', 'funcionario') THEN
    RAISE EXCEPTION 'Função inválida' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Usuário com este e-mail já existe.'
    );
  END IF;

  v_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nome', v_nome),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id, 'email', v_email),
    'email',
    now(),
    now(),
    now()
  );

  UPDATE public.profiles
  SET nome = v_nome,
      email = v_email,
      cargo = NULLIF(trim(p_cargo), ''),
      role = v_role,
      ativo = TRUE
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, nome, email, cargo, role, ativo)
    VALUES (
      v_user_id,
      v_nome,
      v_email,
      NULLIF(trim(p_cargo), ''),
      v_role,
      TRUE
    );
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'user_id', v_user_id);
EXCEPTION
  WHEN insufficient_privilege OR invalid_parameter_value THEN
    RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Não foi possível criar o usuário.');
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_member(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_member(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

COMMIT;
