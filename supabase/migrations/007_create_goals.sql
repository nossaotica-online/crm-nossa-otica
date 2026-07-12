-- ============================================
-- CRM Vittus - Migration 007: Goals
-- ============================================

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('vendas', 'faturamento', 'leads_convertidos')),
  meta_valor DECIMAL(10, 2) NOT NULL,
  valor_atual DECIMAL(10, 2) DEFAULT 0,
  periodo TEXT NOT NULL
    CHECK (periodo IN ('semanal', 'mensal', 'trimestral')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
