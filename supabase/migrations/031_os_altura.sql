-- ============================================================
-- CRM Nossa Ótica - Migration 031: altura de montagem na O.S.
-- ============================================================
-- A altura (em mm, do centro da pupila até a borda de baixo da lente) é o que
-- falta para o laboratório montar multifocal e progressiva. Sem ela a O.S.
-- saía incompleta e a informação ia por WhatsApp, fora do sistema.
--
-- Texto livre, igual à DNP: a loja escreve como está acostumada ("21/21",
-- "21 e 20"), e cada laboratório pede de um jeito.

ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS altura TEXT;

-- Guardado para a migration poder ser rodada de novo sem erro: ADD CONSTRAINT
-- não tem IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.service_orders'::regclass
      AND conname = 'service_orders_altura_limit'
  ) THEN
    ALTER TABLE public.service_orders
      ADD CONSTRAINT service_orders_altura_limit
      CHECK (char_length(COALESCE(altura, '')) <= 60) NOT VALID;
  END IF;
END $$;
