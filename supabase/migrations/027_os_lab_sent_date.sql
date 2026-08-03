-- ============================================================
-- CRM Nossa Ótica - Migration 027: data de postagem no laboratório
-- ============================================================
-- A O.S. passa a registrar QUANDO o pedido foi enviado ao laboratório,
-- que é o que a loja acompanha no dia a dia para cobrar o prazo.

ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS lab_sent_date DATE;

CREATE INDEX IF NOT EXISTS idx_service_orders_lab_sent_date
  ON public.service_orders(lab_sent_date);
