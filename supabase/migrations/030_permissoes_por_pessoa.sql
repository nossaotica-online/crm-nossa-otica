-- ============================================================
-- CRM Nossa Ótica - Migration 030: permissão marcada por pessoa
-- ============================================================
-- Antes o acesso vinha de um cargo fechado ('funcionario', 'vendedor'...):
-- para mudar o que alguém enxergava era preciso mexer no código. Agora a
-- administradora marca numa lista, na própria tela de Equipe, o que cada
-- pessoa vê — e pode voltar depois e desmarcar.
--
-- Três coisas ficam gravadas no profile:
--   permissoes    lista das telas que a pessoa abre
--   pode_excluir  se ela apaga registros ou só cadastra e edita
--   ve_tudo       se enxerga a loja inteira ou só o que ela mesma cadastrou
--
-- IMPORTANTE: esconder o item do menu não protege nada — quem barra de
-- verdade são as policies abaixo. Elas passam a ler a marcação em vez do
-- cargo, então desmarcar uma tela realmente corta o dado.
--
-- Quem já tem acesso hoje NÃO perde nada: o passo 2 converte o cargo atual
-- na marcação equivalente antes de qualquer policy mudar.
--
-- 'admin' continua sendo o interruptor mestre: administradora vê tudo,
-- exclui tudo e é a única que mexe em Equipe e Configurações.

BEGIN;

-- ------------------------------------------------------------
-- 1. As três colunas novas
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissoes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pode_excluir BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ve_tudo BOOLEAN NOT NULL DEFAULT FALSE;

-- Só estas chaves existem. Um erro de digitação no app vira erro na hora,
-- em vez de virar uma permissão que nunca funciona e ninguém entende.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_permissoes_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_permissoes_check CHECK (
    permissoes <@ ARRAY[
      'inicio', 'clientes', 'ordens', 'calendario',
      'vendas', 'metas', 'equipe', 'configuracoes'
    ]::TEXT[]
  );

-- ------------------------------------------------------------
-- 2. Converte o cargo atual na marcação equivalente
-- ------------------------------------------------------------
-- Roda só em quem ainda está com a lista vazia, para não desfazer marcação
-- feita na tela caso a migration seja aplicada duas vezes.
UPDATE public.profiles SET
  permissoes = CASE role
    WHEN 'admin' THEN ARRAY['inicio','clientes','ordens','calendario','vendas','metas','equipe','configuracoes']
    WHEN 'gestor' THEN ARRAY['inicio','clientes','ordens','calendario','vendas','metas']
    WHEN 'funcionario' THEN ARRAY['clientes','ordens','calendario']
    ELSE ARRAY['inicio','clientes','ordens','calendario','vendas']
  END,
  pode_excluir = role IN ('admin', 'gestor'),
  -- O balcão precisa achar o cliente que entrou na loja mesmo que outra
  -- pessoa tenha cadastrado; vendedor e consultor enxergam só o deles.
  ve_tudo = role IN ('admin', 'gestor', 'funcionario')
WHERE permissoes = '{}';

-- ------------------------------------------------------------
-- 3. As três perguntas que as policies fazem
-- ------------------------------------------------------------
-- Administradora responde SIM para tudo sem depender da marcação: é o que
-- garante que ninguém se tranque para fora editando a própria lista.

CREATE OR REPLACE FUNCTION public.tem_permissao(p_chave TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.ativo IS TRUE
      AND (p.role = 'admin' OR p_chave = ANY (p.permissoes))
  );
$$;

CREATE OR REPLACE FUNCTION public.pode_excluir()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.ativo IS TRUE
      AND (p.role = 'admin' OR p.pode_excluir IS TRUE)
  );
$$;

CREATE OR REPLACE FUNCTION public.ve_tudo()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.ativo IS TRUE
      AND (p.role = 'admin' OR p.ve_tudo IS TRUE)
  );
$$;

REVOKE ALL ON FUNCTION public.tem_permissao(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode_excluir() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ve_tudo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_permissao(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_excluir() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ve_tudo() TO authenticated;

-- Receitas e família seguem o acesso ao cliente dono delas.
CREATE OR REPLACE FUNCTION public.can_access_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.tem_permissao('clientes')
    AND EXISTS (
      SELECT 1
      FROM public.clients AS c
      WHERE c.id = p_client_id
        AND (
          public.ve_tudo()
          OR c.responsavel_id = (SELECT auth.uid())
          OR c.responsavel_id IS NULL
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_client(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_client(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 4. Policies das telas marcáveis
-- ------------------------------------------------------------
-- Só as tabelas destas telas são refeitas. profiles, activities,
-- notifications, services, schedule_config, leads e audit_logs continuam
-- com as regras da 025 — não estão na lista de marcar.
--
-- Como as policies se somam (basta UMA liberar), as antigas por cargo
-- precisam sair, senão o balcão da 029 continuaria entrando por fora.
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'clients', 'client_prescriptions', 'family_groups',
        'family_relationships', 'service_orders', 'tasks',
        'bookings', 'sales', 'goals'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  END LOOP;
END;
$$;

-- CLIENTES -----------------------------------------------------
CREATE POLICY clients_permissao_select
  ON public.clients FOR SELECT TO authenticated
  USING (
    public.tem_permissao('clientes')
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  );
CREATE POLICY clients_permissao_insert
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_permissao('clientes')
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  );
CREATE POLICY clients_permissao_update
  ON public.clients FOR UPDATE TO authenticated
  USING (
    public.tem_permissao('clientes')
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  )
  WITH CHECK (
    public.tem_permissao('clientes')
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  );
CREATE POLICY clients_permissao_delete
  ON public.clients FOR DELETE TO authenticated
  USING (
    public.tem_permissao('clientes')
    AND public.pode_excluir()
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()))
  );

-- RECEITAS / GRAU ----------------------------------------------
CREATE POLICY prescriptions_permissao_select
  ON public.client_prescriptions FOR SELECT TO authenticated
  USING (public.can_access_client(client_id));
CREATE POLICY prescriptions_permissao_insert
  ON public.client_prescriptions FOR INSERT TO authenticated
  WITH CHECK (public.can_access_client(client_id));
CREATE POLICY prescriptions_permissao_update
  ON public.client_prescriptions FOR UPDATE TO authenticated
  USING (public.can_access_client(client_id))
  WITH CHECK (public.can_access_client(client_id));
CREATE POLICY prescriptions_permissao_delete
  ON public.client_prescriptions FOR DELETE TO authenticated
  USING (public.can_access_client(client_id) AND public.pode_excluir());

-- FAMÍLIA -------------------------------------------------------
CREATE POLICY family_groups_permissao_select
  ON public.family_groups FOR SELECT TO authenticated
  USING (public.tem_permissao('clientes'));
CREATE POLICY family_groups_permissao_insert
  ON public.family_groups FOR INSERT TO authenticated
  WITH CHECK (public.tem_permissao('clientes'));
CREATE POLICY family_groups_permissao_update
  ON public.family_groups FOR UPDATE TO authenticated
  USING (public.tem_permissao('clientes'))
  WITH CHECK (public.tem_permissao('clientes'));
CREATE POLICY family_groups_permissao_delete
  ON public.family_groups FOR DELETE TO authenticated
  USING (public.tem_permissao('clientes') AND public.pode_excluir());

-- O vínculo entre dois clientes exige acesso aos dois lados. Desfazer um
-- vínculo não apaga cliente nenhum, por isso não pede 'pode_excluir'.
CREATE POLICY family_relationships_permissao_all
  ON public.family_relationships FOR ALL TO authenticated
  USING (
    public.can_access_client(client_id)
    AND public.can_access_client(related_client_id)
  )
  WITH CHECK (
    public.can_access_client(client_id)
    AND public.can_access_client(related_client_id)
  );

-- ORDEM DE SERVIÇO ---------------------------------------------
CREATE POLICY service_orders_permissao_select
  ON public.service_orders FOR SELECT TO authenticated
  USING (
    public.tem_permissao('ordens')
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()) OR vendedor_id IS NULL)
  );
CREATE POLICY service_orders_permissao_insert
  ON public.service_orders FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_permissao('ordens')
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()) OR vendedor_id IS NULL)
  );
CREATE POLICY service_orders_permissao_update
  ON public.service_orders FOR UPDATE TO authenticated
  USING (
    public.tem_permissao('ordens')
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()) OR vendedor_id IS NULL)
  )
  WITH CHECK (
    public.tem_permissao('ordens')
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()) OR vendedor_id IS NULL)
  );
CREATE POLICY service_orders_permissao_delete
  ON public.service_orders FOR DELETE TO authenticated
  USING (
    public.tem_permissao('ordens')
    AND public.pode_excluir()
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()))
  );

-- CALENDÁRIO: agenda e tarefas andam juntas na mesma tela --------
CREATE POLICY bookings_permissao_select
  ON public.bookings FOR SELECT TO authenticated
  USING (
    public.tem_permissao('calendario')
    AND (public.ve_tudo() OR consultor_id = (SELECT auth.uid()) OR consultor_id IS NULL)
  );
CREATE POLICY bookings_permissao_insert
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_permissao('calendario')
    AND (public.ve_tudo() OR consultor_id = (SELECT auth.uid()) OR consultor_id IS NULL)
  );
CREATE POLICY bookings_permissao_update
  ON public.bookings FOR UPDATE TO authenticated
  USING (
    public.tem_permissao('calendario')
    AND (public.ve_tudo() OR consultor_id = (SELECT auth.uid()) OR consultor_id IS NULL)
  )
  WITH CHECK (
    public.tem_permissao('calendario')
    AND (public.ve_tudo() OR consultor_id = (SELECT auth.uid()) OR consultor_id IS NULL)
  );
CREATE POLICY bookings_permissao_delete
  ON public.bookings FOR DELETE TO authenticated
  USING (
    public.tem_permissao('calendario')
    AND public.pode_excluir()
    AND (public.ve_tudo() OR consultor_id = (SELECT auth.uid()))
  );

CREATE POLICY tasks_permissao_select
  ON public.tasks FOR SELECT TO authenticated
  USING (
    public.tem_permissao('calendario')
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  );
CREATE POLICY tasks_permissao_insert
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_permissao('calendario')
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  );
CREATE POLICY tasks_permissao_update
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.tem_permissao('calendario')
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  )
  WITH CHECK (
    public.tem_permissao('calendario')
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  );
CREATE POLICY tasks_permissao_delete
  ON public.tasks FOR DELETE TO authenticated
  USING (
    public.tem_permissao('calendario')
    AND public.pode_excluir()
    AND (public.ve_tudo() OR responsavel_id = (SELECT auth.uid()))
  );

-- ORÇAMENTOS ----------------------------------------------------
-- Toda O.S. grava uma linha em `sales` para o valor chegar ao painel. Quem
-- tem O.S. mas não tem Orçamentos mexe SÓ nessas linhas amarradas a uma
-- O.S. (service_order_id preenchido); orçamento avulso continua invisível.
CREATE POLICY sales_permissao_select
  ON public.sales FOR SELECT TO authenticated
  USING (
    (
      public.tem_permissao('vendas')
      OR (service_order_id IS NOT NULL AND public.tem_permissao('ordens'))
    )
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()) OR vendedor_id IS NULL)
  );
CREATE POLICY sales_permissao_insert
  ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.tem_permissao('vendas')
      OR (service_order_id IS NOT NULL AND public.tem_permissao('ordens'))
    )
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()) OR vendedor_id IS NULL)
  );
CREATE POLICY sales_permissao_update
  ON public.sales FOR UPDATE TO authenticated
  USING (
    (
      public.tem_permissao('vendas')
      OR (service_order_id IS NOT NULL AND public.tem_permissao('ordens'))
    )
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()) OR vendedor_id IS NULL)
  )
  WITH CHECK (
    (
      public.tem_permissao('vendas')
      OR (service_order_id IS NOT NULL AND public.tem_permissao('ordens'))
    )
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()) OR vendedor_id IS NULL)
  );
CREATE POLICY sales_permissao_delete
  ON public.sales FOR DELETE TO authenticated
  USING (
    (
      public.tem_permissao('vendas')
      OR (service_order_id IS NOT NULL AND public.tem_permissao('ordens'))
    )
    AND public.pode_excluir()
    AND (public.ve_tudo() OR vendedor_id = (SELECT auth.uid()))
  );

-- METAS ---------------------------------------------------------
CREATE POLICY goals_permissao_select
  ON public.goals FOR SELECT TO authenticated
  USING (
    public.tem_permissao('metas')
    AND (public.ve_tudo() OR user_id = (SELECT auth.uid()) OR user_id IS NULL)
  );
CREATE POLICY goals_permissao_insert
  ON public.goals FOR INSERT TO authenticated
  WITH CHECK (
    public.tem_permissao('metas')
    AND (public.ve_tudo() OR user_id = (SELECT auth.uid()) OR user_id IS NULL)
  );
CREATE POLICY goals_permissao_update
  ON public.goals FOR UPDATE TO authenticated
  USING (
    public.tem_permissao('metas')
    AND (public.ve_tudo() OR user_id = (SELECT auth.uid()) OR user_id IS NULL)
  )
  WITH CHECK (
    public.tem_permissao('metas')
    AND (public.ve_tudo() OR user_id = (SELECT auth.uid()) OR user_id IS NULL)
  );
CREATE POLICY goals_permissao_delete
  ON public.goals FOR DELETE TO authenticated
  USING (
    public.tem_permissao('metas')
    AND public.pode_excluir()
    AND (public.ve_tudo() OR user_id = (SELECT auth.uid()))
  );

-- ------------------------------------------------------------
-- 5. Criar acesso já com a marcação escolhida na tela
-- ------------------------------------------------------------
-- Mesmo corpo da 029; o que muda é receber a lista em vez do cargo.
-- 'admin' vem de um interruptor separado no formulário: marcar "Equipe"
-- sem ser administradora não faz sentido, então a tela envia p_admin.
CREATE OR REPLACE FUNCTION public.create_team_member(
  p_email TEXT,
  p_password TEXT,
  p_nome TEXT,
  p_cargo TEXT,
  p_permissoes TEXT[],
  p_pode_excluir BOOLEAN DEFAULT FALSE,
  p_ve_tudo BOOLEAN DEFAULT FALSE,
  p_admin BOOLEAN DEFAULT FALSE
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
  v_role TEXT := CASE WHEN p_admin THEN 'admin' ELSE 'funcionario' END;
  v_permissoes TEXT[] := COALESCE(p_permissoes, '{}');
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

  IF NOT (v_permissoes <@ ARRAY[
    'inicio','clientes','ordens','calendario','vendas','metas','equipe','configuracoes'
  ]::TEXT[]) THEN
    RAISE EXCEPTION 'Permissão inválida' USING ERRCODE = '22023';
  END IF;

  -- Um acesso sem nenhuma tela marcada entra e não vê nada: quase sempre é
  -- esquecimento de marcar, e o motivo precisa aparecer na tela.
  IF NOT p_admin AND cardinality(v_permissoes) = 0 THEN
    RAISE EXCEPTION 'Marque pelo menos uma tela que esta pessoa pode abrir'
      USING ERRCODE = '22023';
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
      permissoes = v_permissoes,
      pode_excluir = COALESCE(p_pode_excluir, FALSE),
      ve_tudo = COALESCE(p_ve_tudo, FALSE),
      ativo = TRUE
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (
      id, nome, email, cargo, role, permissoes, pode_excluir, ve_tudo, ativo
    )
    VALUES (
      v_user_id,
      v_nome,
      v_email,
      NULLIF(trim(p_cargo), ''),
      v_role,
      v_permissoes,
      COALESCE(p_pode_excluir, FALSE),
      COALESCE(p_ve_tudo, FALSE),
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

-- A versão antiga (que recebia p_role) sai de circulação: se ficasse, uma
-- tela desatualizada continuaria criando acesso por cargo, sem marcação.
DROP FUNCTION IF EXISTS public.create_team_member(TEXT, TEXT, TEXT, TEXT, TEXT);

REVOKE ALL ON FUNCTION public.create_team_member(TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_member(TEXT, TEXT, TEXT, TEXT, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN)
  TO authenticated;

-- ------------------------------------------------------------
-- 6. Mudar a marcação de quem já existe
-- ------------------------------------------------------------
-- Vai por função, e não por UPDATE direto, por causa da última trava: tirar
-- o 'admin' da única administradora ativa deixaria a loja sem ninguém que
-- consiga criar ou corrigir acesso.
CREATE OR REPLACE FUNCTION public.atualizar_permissoes(
  p_user_id UUID,
  p_permissoes TEXT[],
  p_pode_excluir BOOLEAN,
  p_ve_tudo BOOLEAN,
  p_admin BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_permissoes TEXT[] := COALESCE(p_permissoes, '{}');
  v_era_admin BOOLEAN;
  v_admins_ativos INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores ativos podem mudar permissões'
      USING ERRCODE = '42501';
  END IF;

  SELECT role = 'admin' INTO v_era_admin
  FROM public.profiles WHERE id = p_user_id;

  IF v_era_admin IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Esse acesso não existe mais.');
  END IF;

  IF NOT (v_permissoes <@ ARRAY[
    'inicio','clientes','ordens','calendario','vendas','metas','equipe','configuracoes'
  ]::TEXT[]) THEN
    RAISE EXCEPTION 'Permissão inválida' USING ERRCODE = '22023';
  END IF;

  IF NOT p_admin AND cardinality(v_permissoes) = 0 THEN
    RAISE EXCEPTION 'Marque pelo menos uma tela que esta pessoa pode abrir'
      USING ERRCODE = '22023';
  END IF;

  IF v_era_admin AND NOT p_admin THEN
    SELECT count(*) INTO v_admins_ativos
    FROM public.profiles
    WHERE role = 'admin' AND ativo IS TRUE;

    IF v_admins_ativos <= 1 THEN
      RAISE EXCEPTION 'Esta é a única administradora ativa: tirar o acesso de administradora trancaria todo mundo para fora'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.profiles
  SET permissoes = v_permissoes,
      pode_excluir = COALESCE(p_pode_excluir, FALSE),
      ve_tudo = COALESCE(p_ve_tudo, FALSE),
      role = CASE WHEN p_admin THEN 'admin' ELSE 'funcionario' END
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', TRUE);
EXCEPTION
  WHEN insufficient_privilege OR invalid_parameter_value THEN
    RAISE;
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Não foi possível salvar as permissões.');
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_permissoes(UUID, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_permissoes(UUID, TEXT[], BOOLEAN, BOOLEAN, BOOLEAN)
  TO authenticated;

COMMIT;
