-- ============================================================
-- CRM Vittus - Migration 011: Allow Anonymous Inserts & Selects
-- ============================================================

-- Allow anonymous (public quiz) users to insert leads
CREATE POLICY "leads_insert_anon"
  ON public.leads FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous (public quiz) users to select bookings (to check slot availability)
CREATE POLICY "bookings_select_anon"
  ON public.bookings FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous (public quiz) users to insert bookings
CREATE POLICY "bookings_insert_anon"
  ON public.bookings FOR INSERT
  TO anon
  WITH CHECK (true);
