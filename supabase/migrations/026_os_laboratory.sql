-- ============================================================
-- CRM Nossa Ótica - Migration 026: laboratório na Ordem de Serviço
-- ============================================================
-- A O.S. passa a registrar em qual laboratório a lente foi pedida
-- (Unilentes, Vision Lab, Prolentes, Art Lentes, Hoya, Orlac ou outro).

ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS laboratory TEXT;

CREATE INDEX IF NOT EXISTS idx_service_orders_laboratory
  ON public.service_orders(laboratory);

-- Mesmo padrão das demais validações: o banco é a fronteira de confiança.
-- NOT VALID preserva dados antigos e bloqueia apenas gravações novas fora da regra.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_orders_laboratory_limit'
      AND conrelid = 'public.service_orders'::regclass
  ) THEN
    ALTER TABLE public.service_orders
      ADD CONSTRAINT service_orders_laboratory_limit
      CHECK (char_length(COALESCE(laboratory, '')) <= 120) NOT VALID;
  END IF;
END;
$$;
