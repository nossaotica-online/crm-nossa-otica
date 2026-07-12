-- ============================================================
-- CRM Nossa Ótica - Migration 017: origem, produtos e receitas
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS source_details TEXT,
  ADD COLUMN IF NOT EXISTS product_interests TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE public.clients
SET source = CASE WHEN referred_by_client_id IS NOT NULL THEN 'indicacao' ELSE 'outro' END
WHERE source IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN source SET DEFAULT 'outro',
  ALTER COLUMN source SET NOT NULL;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_source_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_source_check CHECK (
  source IN ('meta', 'google', 'instagram', 'indicacao', 'loja', 'cliente_antigo', 'whatsapp', 'outro')
);

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_product_interests_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_product_interests_check CHECK (
  product_interests <@ ARRAY[
    'oculos_completo', 'lentes', 'armacao', 'oculos_sol', 'manutencao'
  ]::TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_clients_source ON public.clients(source);
CREATE INDEX IF NOT EXISTS idx_clients_product_interests ON public.clients USING GIN(product_interests);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON public.clients(created_at DESC);

CREATE TABLE IF NOT EXISTS public.client_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  prescription_date DATE NOT NULL DEFAULT CURRENT_DATE,
  doctor_name TEXT,
  doctor_crm TEXT,
  od_sphere NUMERIC(5,2),
  od_cylinder NUMERIC(5,2),
  od_axis SMALLINT,
  od_addition NUMERIC(4,2),
  oe_sphere NUMERIC(5,2),
  oe_cylinder NUMERIC(5,2),
  oe_axis SMALLINT,
  oe_addition NUMERIC(4,2),
  dnp_right NUMERIC(4,1),
  dnp_left NUMERIC(4,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_prescriptions_od_sphere_check CHECK (od_sphere IS NULL OR od_sphere BETWEEN -30 AND 30),
  CONSTRAINT client_prescriptions_oe_sphere_check CHECK (oe_sphere IS NULL OR oe_sphere BETWEEN -30 AND 30),
  CONSTRAINT client_prescriptions_od_cylinder_check CHECK (od_cylinder IS NULL OR od_cylinder BETWEEN -10 AND 10),
  CONSTRAINT client_prescriptions_oe_cylinder_check CHECK (oe_cylinder IS NULL OR oe_cylinder BETWEEN -10 AND 10),
  CONSTRAINT client_prescriptions_od_axis_check CHECK (od_axis IS NULL OR od_axis BETWEEN 0 AND 180),
  CONSTRAINT client_prescriptions_oe_axis_check CHECK (oe_axis IS NULL OR oe_axis BETWEEN 0 AND 180),
  CONSTRAINT client_prescriptions_od_addition_check CHECK (od_addition IS NULL OR od_addition BETWEEN 0 AND 6),
  CONSTRAINT client_prescriptions_oe_addition_check CHECK (oe_addition IS NULL OR oe_addition BETWEEN 0 AND 6),
  CONSTRAINT client_prescriptions_dnp_right_check CHECK (dnp_right IS NULL OR dnp_right BETWEEN 20 AND 45),
  CONSTRAINT client_prescriptions_dnp_left_check CHECK (dnp_left IS NULL OR dnp_left BETWEEN 20 AND 45)
);

CREATE INDEX IF NOT EXISTS idx_client_prescriptions_client_date
  ON public.client_prescriptions(client_id, prescription_date DESC);

DROP TRIGGER IF EXISTS client_prescriptions_updated_at ON public.client_prescriptions;
CREATE TRIGGER client_prescriptions_updated_at
  BEFORE UPDATE ON public.client_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.client_prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_prescriptions_select_authenticated" ON public.client_prescriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "client_prescriptions_insert_authenticated" ON public.client_prescriptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "client_prescriptions_update_authenticated" ON public.client_prescriptions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "client_prescriptions_delete_authenticated" ON public.client_prescriptions FOR DELETE TO authenticated USING (true);

