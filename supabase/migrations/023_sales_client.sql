-- ============================================================
-- CRM Nossa Ótica - Migration 023: vendas por CLIENTE
-- ============================================================
-- Igual bookings/tasks (migration 019): a venda passa a referenciar
-- o cadastro de CLIENTES da ótica, não mais o "lead" do funil antigo.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_client_id ON public.sales(client_id);
