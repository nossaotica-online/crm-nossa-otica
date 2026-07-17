-- ============================================================
-- CRM Nossa Ótica - Migration 020: WhatsApp principal opcional
-- ============================================================
-- Clientes de idade mais avançada muitas vezes não têm celular
-- próprio: o cadastro passa a aceitar só o telefone secundário
-- (recado — de um filho, neto etc.). Continua obrigatório ter
-- PELO MENOS UM telefone.

ALTER TABLE public.clients ALTER COLUMN whatsapp DROP NOT NULL;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_any_phone_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_any_phone_check
  CHECK (whatsapp IS NOT NULL OR secondary_phone IS NOT NULL);

-- O normalizador transformava NULL em '' (que viola o formato);
-- agora preserva NULL quando o campo fica vazio.
CREATE OR REPLACE FUNCTION public.normalize_client_phones()
RETURNS TRIGGER AS $$
BEGIN
  NEW.whatsapp := NULLIF(regexp_replace(COALESCE(NEW.whatsapp, ''), '[^0-9]', '', 'g'), '');
  IF NEW.whatsapp IS NOT NULL AND length(NEW.whatsapp) IN (12, 13) AND left(NEW.whatsapp, 2) = '55' THEN
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
