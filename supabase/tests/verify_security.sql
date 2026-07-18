-- Execute no SQL Editor após aplicar a migration 025.
-- O bloco falha se RLS/grants/policies anônimas regredirem.

DO $$
DECLARE
  audited_tables CONSTANT TEXT[] := ARRAY[
    'profiles', 'leads', 'bookings', 'sales', 'goals', 'tasks',
    'clients', 'service_orders', 'activities', 'notifications',
    'schedule_config', 'services', 'family_groups',
    'family_relationships', 'client_prescriptions', 'audit_logs'
  ];
  failures TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
  INTO failures
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (audited_tables)
    AND c.relrowsecurity IS NOT TRUE;

  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'Tabelas sem RLS: %', failures;
  END IF;

  SELECT string_agg(
    format('%I.%I/%I', schemaname, tablename, policyname),
    ', '
    ORDER BY tablename, policyname
  )
  INTO failures
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY (audited_tables)
    AND (
      roles && ARRAY['anon']::name[]
      OR roles && ARRAY['public']::name[]
    );

  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'Policies acessíveis por anon/PUBLIC: %', failures;
  END IF;

  SELECT string_agg(table_name, ', ' ORDER BY table_name)
  INTO failures
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = ANY (audited_tables)
    AND (
      has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
      OR has_table_privilege('anon', format('public.%I', table_name), 'INSERT')
      OR has_table_privilege('anon', format('public.%I', table_name), 'UPDATE')
      OR has_table_privilege('anon', format('public.%I', table_name), 'DELETE')
    );

  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'anon ainda tem grants em: %', failures;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'ativo'
      AND replace(column_default, '::boolean', '') = 'false'
  ) THEN
    RAISE EXCEPTION 'profiles.ativo deve nascer FALSE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'recipient_user_id'
  ) THEN
    RAISE EXCEPTION 'notifications.recipient_user_id ausente';
  END IF;

  RAISE NOTICE 'OK: RLS ativo, sem policies/grants anon nas % tabelas.', array_length(audited_tables, 1);
END;
$$;

-- Inventário legível do estado realmente instalado:
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
