-- ============================================================
-- CRM Nossa Ótica - Migration 025: security hardening / RLS
-- ============================================================
-- Estado desejado:
--   * anon não possui privilégios diretos em nenhuma tabela do CRM;
--   * toda policy authenticated exige um profile ativo;
--   * admin/gestor gerenciam dados operacionais;
--   * vendedor/consultor acessam somente registros atribuídos a eles;
--   * somente admin gerencia perfis, funções e catálogo de serviços.
--
-- O formulário público antigo foi removido na migration 018. Uma futura
-- captação pública deve usar Edge Function com validação/rate-limit; não
-- recrie policies anon diretamente nas tabelas.

BEGIN;

-- Cadastros diretos pelo Auth nunca nascem autorizados. O fluxo administrativo
-- create_team_member ativa explicitamente apenas após validar o admin.
ALTER TABLE public.profiles ALTER COLUMN ativo SET DEFAULT FALSE;

-- Atribuição explícita para tabelas que antes não tinham dono.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS responsavel_id UUID
  REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.family_groups
  ADD COLUMN IF NOT EXISTS created_by UUID
  REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID
  REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role TEXT,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  target_table TEXT NOT NULL,
  record_id UUID,
  changed_fields TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ALTER COLUMN responsavel_id SET DEFAULT auth.uid();
ALTER TABLE public.family_groups ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.leads ALTER COLUMN responsavel_id SET DEFAULT auth.uid();
ALTER TABLE public.bookings ALTER COLUMN consultor_id SET DEFAULT auth.uid();
ALTER TABLE public.sales ALTER COLUMN vendedor_id SET DEFAULT auth.uid();
ALTER TABLE public.goals ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.tasks ALTER COLUMN responsavel_id SET DEFAULT auth.uid();
ALTER TABLE public.activities ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.service_orders ALTER COLUMN vendedor_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_clients_responsavel_id
  ON public.clients(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_family_groups_created_by
  ON public.family_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target
  ON public.audit_logs(target_table, record_id);

-- Validação no banco: o frontend nunca é a fronteira de confiança.
-- NOT VALID preserva dados legados fora da regra, mas bloqueia novos valores
-- inválidos e permite saneamento/VALIDATE posterior sem indisponibilidade.
ALTER TABLE public.sales
  ADD CONSTRAINT sales_value_nonnegative CHECK (valor >= 0) NOT VALID,
  ADD CONSTRAINT sales_installments_positive CHECK (parcelas >= 1) NOT VALID;
ALTER TABLE public.service_orders
  ADD CONSTRAINT service_orders_total_nonnegative CHECK (total >= 0) NOT VALID,
  ADD CONSTRAINT service_orders_down_payment_nonnegative CHECK (down_payment >= 0) NOT VALID,
  ADD CONSTRAINT service_orders_down_payment_lte_total CHECK (down_payment <= total) NOT VALID,
  ADD CONSTRAINT service_orders_text_limits CHECK (
    char_length(client_name) <= 160
    AND char_length(COALESCE(frame_description, '')) <= 500
    AND char_length(COALESCE(lens_description, '')) <= 500
    AND char_length(COALESCE(notes, '')) <= 5000
  ) NOT VALID;
ALTER TABLE public.goals
  ADD CONSTRAINT goals_values_nonnegative
  CHECK (meta_valor >= 0 AND valor_atual >= 0) NOT VALID;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_estimated_value_nonnegative
  CHECK (valor_estimado IS NULL OR valor_estimado >= 0) NOT VALID,
  ADD CONSTRAINT leads_text_limits CHECK (
    char_length(nome) <= 160
    AND char_length(COALESCE(email, '')) <= 254
    AND char_length(COALESCE(notas, '')) <= 5000
  ) NOT VALID;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_text_limits CHECK (
    char_length(name) <= 160
    AND char_length(COALESCE(email, '')) <= 254
    AND char_length(COALESCE(cpf, '')) <= 14
    AND char_length(COALESCE(rg, '')) <= 30
    AND char_length(COALESCE(notes, '')) <= 5000
  ) NOT VALID;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_text_limits CHECK (
    char_length(COALESCE(zoom_link, '')) <= 2048
    AND char_length(COALESCE(notas, '')) <= 5000
  ) NOT VALID;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_text_limits CHECK (
    char_length(titulo) <= 200
    AND char_length(COALESCE(descricao, '')) <= 5000
  ) NOT VALID;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_recipient_required
  CHECK (recipient_user_id IS NOT NULL) NOT VALID,
  ADD CONSTRAINT notifications_text_limits CHECK (
    char_length(title) <= 200
    AND char_length(message) <= 2000
  ) NOT VALID;

-- Helpers SECURITY DEFINER têm search_path fechado e só podem ser chamados
-- por authenticated. O owner da função consulta profiles sem recursão de RLS.
CREATE OR REPLACE FUNCTION public.is_active_user()
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
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
    AND p.ativo IS TRUE;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_user_role() = 'admin', FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_gestor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(public.get_user_role() IN ('admin', 'gestor'), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.can_access_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.clients AS c
      WHERE c.id = p_client_id
        AND (
          public.is_admin_or_gestor()
          OR c.responsavel_id = (SELECT auth.uid())
        )
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin_or_gestor() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_client(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_gestor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_client(UUID) TO authenticated;

-- Auditoria sem copiar valores pessoais: registra ator, ação, registro e nomes
-- dos campos alterados. Escritas só ocorrem pelos triggers SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.audit_sensitive_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  row_data JSONB;
  old_data JSONB := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  new_data JSONB := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  changed TEXT[];
BEGIN
  row_data := CASE WHEN TG_OP = 'DELETE' THEN old_data ELSE new_data END;

  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key ORDER BY key)
    INTO changed
    FROM (
      SELECT key
      FROM jsonb_object_keys(old_data || new_data) AS fields(key)
      WHERE old_data -> key IS DISTINCT FROM new_data -> key
    ) AS changed_keys;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_role,
    action,
    target_table,
    record_id,
    changed_fields
  ) VALUES (
    (SELECT auth.uid()),
    public.get_user_role(),
    TG_OP,
    TG_TABLE_NAME,
    NULLIF(row_data ->> 'id', '')::uuid,
    changed
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_sensitive_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_profiles_changes ON public.profiles;
CREATE TRIGGER audit_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS audit_clients_changes ON public.clients;
CREATE TRIGGER audit_clients_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS audit_service_orders_changes ON public.service_orders;
CREATE TRIGGER audit_service_orders_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS audit_sales_changes ON public.sales;
CREATE TRIGGER audit_sales_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();
DROP TRIGGER IF EXISTS audit_notifications_changes ON public.notifications;
CREATE TRIGGER audit_notifications_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

-- Impede que a policy "update own" seja usada para promover a própria role,
-- reativar a conta, trocar o e-mail ou alterar o UUID.
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.role IS DISTINCT FROM OLD.role
      OR NEW.ativo IS DISTINCT FROM OLD.ativo
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Somente administradores podem alterar campos privilegiados do perfil'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_sensitive_fields ON public.profiles;
CREATE TRIGGER profiles_protect_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();

REVOKE ALL ON FUNCTION public.protect_profile_sensitive_fields() FROM PUBLIC, anon, authenticated;

-- Corrige o RPC crítico: antes qualquer authenticated (inclusive vendedor)
-- podia criar um usuário e escolher role=admin.
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

  IF v_role NOT IN ('admin', 'gestor', 'vendedor', 'consultor') THEN
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

-- O trigger de signup não deve ser uma RPC pública.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, ativo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Funções de trigger/utilitárias antigas também não ficam publicadas como RPC.
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_client_phones() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.inverse_family_relationship(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inverse_family_relationship(TEXT) TO authenticated;

-- RPCs de família continuam SECURITY INVOKER, mas agora também verificam
-- conta ativa e não ficam executáveis pelo role anon/PUBLIC.
CREATE OR REPLACE FUNCTION public.set_family_relationship(
  p_client_id UUID,
  p_related_client_id UUID,
  p_relationship_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  inverse_type TEXT;
BEGIN
  IF NOT public.can_access_client(p_client_id)
    OR NOT public.can_access_client(p_related_client_id)
  THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  IF p_client_id = p_related_client_id THEN
    RAISE EXCEPTION 'Um cliente não pode ser familiar dele mesmo'
      USING ERRCODE = '22023';
  END IF;

  inverse_type := public.inverse_family_relationship(p_relationship_type);

  INSERT INTO public.family_relationships (
    client_id, related_client_id, relationship_type
  )
  VALUES (p_client_id, p_related_client_id, p_relationship_type)
  ON CONFLICT (client_id, related_client_id)
  DO UPDATE SET relationship_type = EXCLUDED.relationship_type;

  INSERT INTO public.family_relationships (
    client_id, related_client_id, relationship_type
  )
  VALUES (p_related_client_id, p_client_id, inverse_type)
  ON CONFLICT (client_id, related_client_id)
  DO UPDATE SET relationship_type = EXCLUDED.relationship_type;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_family_relationship(
  p_client_id UUID,
  p_related_client_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.can_access_client(p_client_id)
    OR NOT public.can_access_client(p_related_client_id)
  THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.family_relationships
  WHERE (client_id = p_client_id AND related_client_id = p_related_client_id)
     OR (client_id = p_related_client_id AND related_client_id = p_client_id);
END;
$$;

REVOKE ALL ON FUNCTION public.set_family_relationship(UUID, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_family_relationship(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_family_relationship(UUID, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_family_relationship(UUID, UUID)
  TO authenticated;

-- Habilita RLS em todas as tabelas, inclusive as auxiliares descobertas
-- durante a auditoria.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Remove todas as policies antigas para obter um estado final determinístico.
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'profiles', 'leads', 'bookings', 'sales', 'goals', 'tasks',
        'clients', 'service_orders', 'activities', 'notifications',
        'schedule_config', 'services', 'family_groups',
        'family_relationships', 'client_prescriptions', 'audit_logs'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END;
$$;

-- PROFILES: equipe ativa pode consultar o diretório ativo; admin vê tudo.
CREATE POLICY profiles_select_active_directory
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_active_user() AND ativo IS TRUE);
CREATE POLICY profiles_select_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_active_user() AND id = (SELECT auth.uid()))
  WITH CHECK (public.is_active_user() AND id = (SELECT auth.uid()));
CREATE POLICY profiles_insert_admin
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY profiles_update_admin
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
-- Exclusão de profile pela API fica negada. Desative o usuário; exclusão total
-- deve ocorrer em fluxo administrativo que remova auth.users e trate retenção.

-- LEADS: staff vê os próprios e os ainda não atribuídos; ao editar um lead
-- sem responsável, precisa assumi-lo. Gestores veem/gerenciam tudo.
CREATE POLICY leads_staff_select
  ON public.leads FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  );
CREATE POLICY leads_staff_insert
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND (responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  );
CREATE POLICY leads_staff_update
  ON public.leads FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND (responsavel_id = (SELECT auth.uid()) OR responsavel_id IS NULL)
  )
  WITH CHECK (
    public.is_active_user()
    AND responsavel_id = (SELECT auth.uid())
  );
CREATE POLICY leads_manager_all
  ON public.leads FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- BOOKINGS
CREATE POLICY bookings_staff_own
  ON public.bookings FOR ALL TO authenticated
  USING (
    public.is_active_user()
    AND consultor_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_active_user()
    AND consultor_id = (SELECT auth.uid())
  );
CREATE POLICY bookings_manager_all
  ON public.bookings FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- SALES
CREATE POLICY sales_staff_own
  ON public.sales FOR ALL TO authenticated
  USING (
    public.is_active_user()
    AND vendedor_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_active_user()
    AND vendedor_id = (SELECT auth.uid())
  );
CREATE POLICY sales_manager_all
  ON public.sales FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- GOALS: staff consulta/atualiza a própria meta; gestores definem metas.
CREATE POLICY goals_staff_select
  ON public.goals FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND user_id = (SELECT auth.uid())
  );
CREATE POLICY goals_staff_update
  ON public.goals FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_active_user()
    AND user_id = (SELECT auth.uid())
  );
CREATE POLICY goals_manager_all
  ON public.goals FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- TASKS
CREATE POLICY tasks_staff_own
  ON public.tasks FOR ALL TO authenticated
  USING (
    public.is_active_user()
    AND responsavel_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_active_user()
    AND responsavel_id = (SELECT auth.uid())
  );
CREATE POLICY tasks_manager_all
  ON public.tasks FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- CLIENTS
CREATE POLICY clients_staff_own
  ON public.clients FOR ALL TO authenticated
  USING (
    public.is_active_user()
    AND responsavel_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_active_user()
    AND responsavel_id = (SELECT auth.uid())
  );
CREATE POLICY clients_manager_all
  ON public.clients FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- SERVICE ORDERS
CREATE POLICY service_orders_staff_own
  ON public.service_orders FOR ALL TO authenticated
  USING (
    public.is_active_user()
    AND vendedor_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_active_user()
    AND vendedor_id = (SELECT auth.uid())
  );
CREATE POLICY service_orders_manager_all
  ON public.service_orders FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- ACTIVITIES
CREATE POLICY activities_staff_own
  ON public.activities FOR ALL TO authenticated
  USING (
    public.is_active_user()
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_active_user()
    AND user_id = (SELECT auth.uid())
  );
CREATE POLICY activities_manager_all
  ON public.activities FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- NOTIFICATIONS: cada usuário lê apenas as próprias; escrita gerencial.
CREATE POLICY notifications_recipient_select
  ON public.notifications FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND recipient_user_id = (SELECT auth.uid())
  );
CREATE POLICY notifications_manager_all
  ON public.notifications FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- SCHEDULE CONFIG: equipe consulta disponibilidade e altera a própria agenda.
CREATE POLICY schedule_config_active_select
  ON public.schedule_config FOR SELECT TO authenticated
  USING (public.is_active_user());
CREATE POLICY schedule_config_staff_own
  ON public.schedule_config FOR ALL TO authenticated
  USING (
    public.is_active_user()
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_active_user()
    AND user_id = (SELECT auth.uid())
  );
CREATE POLICY schedule_config_manager_all
  ON public.schedule_config FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- SERVICES: catálogo ativo é visível à equipe; só admin o administra.
CREATE POLICY services_active_select
  ON public.services FOR SELECT TO authenticated
  USING (public.is_active_user() AND ativo IS TRUE);
CREATE POLICY services_admin_all
  ON public.services FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tabelas auxiliares de clientes, também protegidas.
CREATE POLICY family_groups_staff_select
  ON public.family_groups FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      created_by = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.clients AS c
        WHERE c.family_group_id = family_groups.id
          AND c.responsavel_id = (SELECT auth.uid())
      )
    )
  );
CREATE POLICY family_groups_staff_insert
  ON public.family_groups FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY family_groups_staff_update
  ON public.family_groups FOR UPDATE TO authenticated
  USING (
    public.is_active_user()
    AND created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    public.is_active_user()
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY family_groups_staff_delete
  ON public.family_groups FOR DELETE TO authenticated
  USING (
    public.is_active_user()
    AND created_by = (SELECT auth.uid())
  );
CREATE POLICY family_groups_manager_all
  ON public.family_groups FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

CREATE POLICY family_relationships_staff_own
  ON public.family_relationships FOR ALL TO authenticated
  USING (
    public.can_access_client(client_id)
    AND public.can_access_client(related_client_id)
  )
  WITH CHECK (
    public.can_access_client(client_id)
    AND public.can_access_client(related_client_id)
  );
CREATE POLICY family_relationships_manager_all
  ON public.family_relationships FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

CREATE POLICY client_prescriptions_staff_own
  ON public.client_prescriptions FOR ALL TO authenticated
  USING (public.can_access_client(client_id))
  WITH CHECK (public.can_access_client(client_id));
CREATE POLICY client_prescriptions_manager_all
  ON public.client_prescriptions FOR ALL TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- AUDIT LOGS: somente gestão consulta; ninguém escreve diretamente.
CREATE POLICY audit_logs_manager_select
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin_or_gestor());

-- Defesa em profundidade: anon não tem nem os grants de tabela/sequência.
REVOKE ALL PRIVILEGES ON TABLE
  public.profiles,
  public.leads,
  public.bookings,
  public.sales,
  public.goals,
  public.tasks,
  public.clients,
  public.service_orders,
  public.activities,
  public.notifications,
  public.schedule_config,
  public.services,
  public.family_groups,
  public.family_relationships,
  public.client_prescriptions,
  public.audit_logs
FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles,
  public.leads,
  public.bookings,
  public.sales,
  public.goals,
  public.tasks,
  public.clients,
  public.service_orders,
  public.activities,
  public.notifications,
  public.schedule_config,
  public.services,
  public.family_groups,
  public.family_relationships,
  public.client_prescriptions
TO authenticated;

GRANT SELECT ON TABLE public.audit_logs TO authenticated;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, PUBLIC;

-- Falha a migration se alguma tabela auditada terminar sem RLS.
DO $$
DECLARE
  audited_tables CONSTANT TEXT[] := ARRAY[
    'profiles', 'leads', 'bookings', 'sales', 'goals', 'tasks',
    'clients', 'service_orders', 'activities', 'notifications',
    'schedule_config', 'services', 'family_groups',
    'family_relationships', 'client_prescriptions', 'audit_logs'
  ];
  missing_tables TEXT;
  unsafe_policies TEXT;
  unsafe_grants TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
  INTO missing_tables
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (audited_tables)
    AND c.relrowsecurity IS NOT TRUE;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'RLS não habilitado em: %', missing_tables;
  END IF;

  SELECT string_agg(format('%I.%I', tablename, policyname), ', ')
  INTO unsafe_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY (audited_tables)
    AND (
      roles && ARRAY['anon']::name[]
      OR roles && ARRAY['public']::name[]
    );

  IF unsafe_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Policies anon/PUBLIC remanescentes: %', unsafe_policies;
  END IF;

  SELECT string_agg(table_name, ', ' ORDER BY table_name)
  INTO unsafe_grants
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = ANY (audited_tables)
    AND (
      has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      OR has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      OR has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
      OR has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
    );

  IF unsafe_grants IS NOT NULL THEN
    RAISE EXCEPTION 'Grants anon remanescentes: %', unsafe_grants;
  END IF;
END;
$$;

COMMIT;
