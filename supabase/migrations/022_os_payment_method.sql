-- ============================================================
-- CRM Nossa Ótica - Migration 022: forma de pagamento na O.S.
-- ============================================================
-- A ordem de serviço passa a registrar como o cliente pagou
-- (dinheiro, pix, cartão, crediário...).

ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
