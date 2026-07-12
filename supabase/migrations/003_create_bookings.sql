-- ============================================
-- CRM Vittus - Migration 003: Bookings
-- ============================================

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  consultor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmado'
    CHECK (status IN ('confirmado', 'realizado', 'cancelado', 'no_show')),
  tipo TEXT NOT NULL DEFAULT 'diagnostico'
    CHECK (tipo IN ('diagnostico', 'followup', 'proposta')),
  zoom_link TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Updated_at trigger
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Performance indexes
CREATE INDEX idx_bookings_data ON bookings(data);
CREATE INDEX idx_bookings_consultor_id ON bookings(consultor_id);
CREATE INDEX idx_bookings_lead_id ON bookings(lead_id);

-- Prevent double-booking: unique constraint on consultant + date + start time
-- Only applies to non-cancelled bookings
CREATE UNIQUE INDEX idx_bookings_no_double
  ON bookings(consultor_id, data, horario_inicio)
  WHERE status != 'cancelado';
