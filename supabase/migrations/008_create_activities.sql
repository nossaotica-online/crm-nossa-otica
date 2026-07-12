-- ============================================
-- CRM Vittus - Migration 008: Activities
-- ============================================

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('nota', 'ligacao', 'email', 'whatsapp', 'reuniao', 'status_change')),
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_activities_lead_id ON activities(lead_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
