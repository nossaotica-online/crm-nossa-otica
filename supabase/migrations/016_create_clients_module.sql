-- ============================================================
-- CRM Nossa Ótica - Migration 016: módulo de clientes e famílias
-- ============================================================

CREATE TABLE IF NOT EXISTS public.family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS family_groups_name_unique
  ON public.family_groups (lower(trim(name)));

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  whatsapp TEXT NOT NULL CHECK (whatsapp ~ '^[0-9]{10,11}$'),
  secondary_phone TEXT,
  birth_date DATE,
  email TEXT,
  notes TEXT,
  family_group_id UUID REFERENCES public.family_groups(id) ON DELETE SET NULL,
  referred_by_client_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clients_referred_by_client_fk
    FOREIGN KEY (referred_by_client_id) REFERENCES public.clients(id) ON DELETE SET NULL,
  CONSTRAINT clients_cannot_refer_self CHECK (referred_by_client_id IS NULL OR referred_by_client_id <> id),
  CONSTRAINT clients_whatsapp_unique UNIQUE (whatsapp)
);

CREATE TABLE IF NOT EXISTS public.family_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  related_client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'pai', 'mãe', 'filho', 'filha', 'marido', 'esposa', 'companheiro', 'companheira',
    'irmão', 'irmã', 'avô', 'avó', 'neto', 'neta', 'tio', 'tia', 'primo', 'prima',
    'sogro', 'sogra', 'genro', 'nora', 'outro'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT family_relationships_distinct_clients CHECK (client_id <> related_client_id),
  CONSTRAINT family_relationships_unique_direction UNIQUE (client_id, related_client_id)
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients (lower(name));
CREATE INDEX IF NOT EXISTS idx_clients_whatsapp ON public.clients (whatsapp);
CREATE INDEX IF NOT EXISTS idx_clients_family_group ON public.clients (family_group_id);
CREATE INDEX IF NOT EXISTS idx_clients_referred_by ON public.clients (referred_by_client_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients (status);
CREATE INDEX IF NOT EXISTS idx_family_relationships_related ON public.family_relationships (related_client_id);

CREATE OR REPLACE FUNCTION public.normalize_client_phones()
RETURNS TRIGGER AS $$
BEGIN
  NEW.whatsapp := regexp_replace(COALESCE(NEW.whatsapp, ''), '[^0-9]', '', 'g');
  IF length(NEW.whatsapp) IN (12, 13) AND left(NEW.whatsapp, 2) = '55' THEN
    NEW.whatsapp := substring(NEW.whatsapp FROM 3);
  END IF;

  IF NEW.secondary_phone IS NOT NULL THEN
    NEW.secondary_phone := NULLIF(regexp_replace(NEW.secondary_phone, '[^0-9]', '', 'g'), '');
  END IF;

  NEW.name := trim(NEW.name);
  NEW.email := NULLIF(lower(trim(COALESCE(NEW.email, ''))), '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_normalize_phones ON public.clients;
CREATE TRIGGER clients_normalize_phones
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.normalize_client_phones();

DROP TRIGGER IF EXISTS clients_updated_at ON public.clients;
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.inverse_family_relationship(value TEXT)
RETURNS TEXT AS $$
  SELECT CASE value
    WHEN 'pai' THEN 'filho' WHEN 'mãe' THEN 'filho'
    WHEN 'filho' THEN 'pai' WHEN 'filha' THEN 'pai'
    WHEN 'marido' THEN 'esposa' WHEN 'esposa' THEN 'marido'
    WHEN 'companheiro' THEN 'companheira' WHEN 'companheira' THEN 'companheiro'
    WHEN 'irmão' THEN 'irmão' WHEN 'irmã' THEN 'irmã'
    WHEN 'avô' THEN 'neto' WHEN 'avó' THEN 'neto'
    WHEN 'neto' THEN 'avô' WHEN 'neta' THEN 'avô'
    WHEN 'tio' THEN 'outro' WHEN 'tia' THEN 'outro'
    WHEN 'primo' THEN 'primo' WHEN 'prima' THEN 'prima'
    WHEN 'sogro' THEN 'genro' WHEN 'sogra' THEN 'genro'
    WHEN 'genro' THEN 'sogro' WHEN 'nora' THEN 'sogro'
    ELSE 'outro'
  END;
$$ LANGUAGE sql IMMUTABLE;

-- Mantém a relação nos dois perfis em uma única operação atômica.
CREATE OR REPLACE FUNCTION public.set_family_relationship(
  p_client_id UUID,
  p_related_client_id UUID,
  p_relationship_type TEXT
)
RETURNS VOID AS $$
DECLARE
  inverse_type TEXT;
BEGIN
  IF p_client_id = p_related_client_id THEN
    RAISE EXCEPTION 'Um cliente não pode ser familiar dele mesmo';
  END IF;

  inverse_type := public.inverse_family_relationship(p_relationship_type);

  INSERT INTO public.family_relationships (client_id, related_client_id, relationship_type)
  VALUES (p_client_id, p_related_client_id, p_relationship_type)
  ON CONFLICT (client_id, related_client_id)
  DO UPDATE SET relationship_type = EXCLUDED.relationship_type;

  INSERT INTO public.family_relationships (client_id, related_client_id, relationship_type)
  VALUES (p_related_client_id, p_client_id, inverse_type)
  ON CONFLICT (client_id, related_client_id)
  DO UPDATE SET relationship_type = EXCLUDED.relationship_type;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.remove_family_relationship(
  p_client_id UUID,
  p_related_client_id UUID
)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.family_relationships
  WHERE (client_id = p_client_id AND related_client_id = p_related_client_id)
     OR (client_id = p_related_client_id AND related_client_id = p_client_id);
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_authenticated" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert_authenticated" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "clients_update_authenticated" ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "clients_delete_authenticated" ON public.clients FOR DELETE TO authenticated USING (true);

CREATE POLICY "family_groups_select_authenticated" ON public.family_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "family_groups_insert_authenticated" ON public.family_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "family_groups_update_authenticated" ON public.family_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "family_groups_delete_authenticated" ON public.family_groups FOR DELETE TO authenticated USING (true);

CREATE POLICY "family_relationships_select_authenticated" ON public.family_relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "family_relationships_insert_authenticated" ON public.family_relationships FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "family_relationships_update_authenticated" ON public.family_relationships FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "family_relationships_delete_authenticated" ON public.family_relationships FOR DELETE TO authenticated USING (true);

GRANT EXECUTE ON FUNCTION public.set_family_relationship(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_family_relationship(UUID, UUID) TO authenticated;
