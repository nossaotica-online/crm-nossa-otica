-- ============================================================
-- CRM Vittus - Migration 015: Allow users to view their own profile
-- ============================================================

-- Create policy allowing authenticated users to select their own profile, active or inactive
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());
