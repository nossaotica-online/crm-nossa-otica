-- ============================================
-- CRM Vittus - Migration 004: Schedule Config
-- ============================================

CREATE TABLE schedule_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME,
  hora_fim TIME,
  ativo BOOLEAN DEFAULT true,
  UNIQUE(user_id, dia_semana)
);
