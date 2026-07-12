-- ============================================================
-- CRM Vittus - Migration 014: Update Lead Origem Check Constraint
-- ============================================================

-- Drop the old constraint
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_origem_check;

-- Re-create the constraint supporting the new values used in the application ('manual' and 'google')
ALTER TABLE public.leads ADD CONSTRAINT leads_origem_check CHECK (
  origem IN (
    'quiz-instagram', 'instagram', 'facebook', 'google-ads', 'google',
    'indicacao', 'site', 'linkedin', 'manual', 'outro'
  )
);
