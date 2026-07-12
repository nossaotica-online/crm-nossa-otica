-- ============================================
-- CRM Vittus - Migration 002: Leads
-- ============================================

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  origem TEXT NOT NULL DEFAULT 'quiz-instagram'
    CHECK (origem IN (
      'quiz-instagram', 'instagram', 'facebook', 'google-ads',
      'indicacao', 'site', 'linkedin', 'outro'
    )),
  status TEXT NOT NULL DEFAULT 'novo'
    CHECK (status IN (
      'novo', 'qualificado', 'agendado', 'em_reuniao',
      'proposta', 'fechado', 'perdido'
    )),
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  respostas_quiz JSONB,
  empresa TEXT,
  segmento TEXT,
  notas TEXT,
  valor_estimado DECIMAL(10, 2),
  motivo_perda TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Updated_at trigger
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Performance indexes
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_responsavel_id ON leads(responsavel_id);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_origem ON leads(origem);
