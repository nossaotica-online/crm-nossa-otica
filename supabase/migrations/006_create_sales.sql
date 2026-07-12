-- ============================================
-- CRM Vittus - Migration 006: Sales
-- ============================================

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  servico_id UUID REFERENCES services(id) ON DELETE SET NULL,
  servico_nome TEXT,
  valor DECIMAL(10, 2) NOT NULL,
  parcelas INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'proposta'
    CHECK (status IN ('proposta', 'negociacao', 'fechado', 'cancelado')),
  data_fechamento DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Updated_at trigger
CREATE TRIGGER sales_updated_at
  BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Performance indexes
CREATE INDEX idx_sales_lead_id ON sales(lead_id);
CREATE INDEX idx_sales_vendedor_id ON sales(vendedor_id);
CREATE INDEX idx_sales_status ON sales(status);
