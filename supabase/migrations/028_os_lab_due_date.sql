-- ============================================================
-- CRM Nossa Ótica - Migration 028: prazo de entrega do laboratório
-- ============================================================
-- Junto com lab_sent_date (migration 027), permite calcular quantos
-- dias o pedido fica no laboratório e comparar o prazo entre eles.

ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS lab_due_date DATE;

CREATE INDEX IF NOT EXISTS idx_service_orders_lab_due_date
  ON public.service_orders(lab_due_date);
