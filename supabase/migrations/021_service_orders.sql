-- ============================================================
-- CRM Nossa Ótica - Migration 021: Ordens de Serviço
-- ============================================================
-- A ótica trabalha com Ordem de Serviço (O.S.): cliente, CPF/RG,
-- produto, grau (receita), valores e status de produção/entrega.

-- CPF e RG passam a fazer parte do cadastro do cliente
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS rg TEXT;

CREATE TABLE IF NOT EXISTS public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_number BIGINT GENERATED ALWAYS AS IDENTITY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  phone TEXT,
  -- produto
  product_type TEXT,
  frame_description TEXT,
  lens_description TEXT,
  -- grau (receita da O.S.)
  od_sphere NUMERIC(5,2), od_cylinder NUMERIC(5,2), od_axis SMALLINT, od_addition NUMERIC(4,2),
  oe_sphere NUMERIC(5,2), oe_cylinder NUMERIC(5,2), oe_axis SMALLINT, oe_addition NUMERIC(4,2),
  dnp TEXT,
  -- financeiro
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  down_payment NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- status / datas
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'em_producao', 'pronta', 'entregue', 'cancelada')),
  delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_client ON public.service_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON public.service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_created ON public.service_orders(created_at DESC);

DROP TRIGGER IF EXISTS service_orders_updated_at ON public.service_orders;
CREATE TRIGGER service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_orders_select_authenticated" ON public.service_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_orders_insert_authenticated" ON public.service_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "service_orders_update_authenticated" ON public.service_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_orders_delete_authenticated" ON public.service_orders FOR DELETE TO authenticated USING (true);
