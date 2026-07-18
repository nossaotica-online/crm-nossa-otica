-- ============================================================
-- CRM Nossa Ótica - Migration 024: Ordem de Serviço vira Venda
-- ============================================================
-- Toda O.S. criada gera automaticamente o registro correspondente
-- em Vendas (faturamento), mantidos em sincronia por service_order_id.

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS service_order_id UUID REFERENCES public.service_orders(id) ON DELETE CASCADE;

-- Único (com NULLs distintos, então vendas sem O.S. continuam livres)
-- para permitir "upsert" de 1 venda por O.S. e evitar duplicatas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_service_order_unique ON public.sales(service_order_id);
