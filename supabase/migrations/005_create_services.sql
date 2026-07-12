-- ============================================
-- CRM Vittus - Migration 005: Services
-- ============================================

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_base DECIMAL(10, 2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
