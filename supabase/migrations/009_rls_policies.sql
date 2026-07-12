-- ============================================
-- CRM Vittus - Migration 009: RLS Policies
-- ============================================

-- ─────────────────────────────────────────────
-- Helper function: get current user role
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if current user is admin or gestor
CREATE OR REPLACE FUNCTION public.is_admin_or_gestor()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() IN ('admin', 'gestor');
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═════════════════════════════════════════════
-- PROFILES
-- ═════════════════════════════════════════════
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all active profiles
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admin can insert any profile
CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin can update any profile
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin can delete any profile
CREATE POLICY "profiles_delete_admin"
  ON profiles FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ═════════════════════════════════════════════
-- LEADS
-- ═════════════════════════════════════════════
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all leads
CREATE POLICY "leads_select_authenticated"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert leads
CREATE POLICY "leads_insert_authenticated"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update leads
CREATE POLICY "leads_update_authenticated"
  ON leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admin/gestor can delete leads
CREATE POLICY "leads_delete_admin_gestor"
  ON leads FOR DELETE
  TO authenticated
  USING (public.is_admin_or_gestor());


-- ═════════════════════════════════════════════
-- BOOKINGS
-- ═════════════════════════════════════════════
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all bookings
CREATE POLICY "bookings_select_authenticated"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert bookings
CREATE POLICY "bookings_insert_authenticated"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update bookings
CREATE POLICY "bookings_update_authenticated"
  ON bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admin can delete bookings
CREATE POLICY "bookings_delete_admin"
  ON bookings FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ═════════════════════════════════════════════
-- SCHEDULE_CONFIG
-- ═════════════════════════════════════════════
ALTER TABLE schedule_config ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all schedule configs
CREATE POLICY "schedule_config_select_authenticated"
  ON schedule_config FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert their own schedule config
CREATE POLICY "schedule_config_insert_own"
  ON schedule_config FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Users can update their own schedule config
CREATE POLICY "schedule_config_update_own"
  ON schedule_config FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Users can delete their own schedule config, admin can delete any
CREATE POLICY "schedule_config_delete_own"
  ON schedule_config FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());


-- ═════════════════════════════════════════════
-- SERVICES
-- ═════════════════════════════════════════════
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view active services
CREATE POLICY "services_select_active"
  ON services FOR SELECT
  TO authenticated
  USING (ativo = true);

-- Only admin can insert services
CREATE POLICY "services_insert_admin"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Only admin can update services
CREATE POLICY "services_update_admin"
  ON services FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admin can delete services
CREATE POLICY "services_delete_admin"
  ON services FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ═════════════════════════════════════════════
-- SALES
-- ═════════════════════════════════════════════
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all sales
CREATE POLICY "sales_select_authenticated"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert sales
CREATE POLICY "sales_insert_authenticated"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update sales
CREATE POLICY "sales_update_authenticated"
  ON sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admin can delete sales
CREATE POLICY "sales_delete_admin"
  ON sales FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ═════════════════════════════════════════════
-- GOALS
-- ═════════════════════════════════════════════
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all goals
CREATE POLICY "goals_select_authenticated"
  ON goals FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/gestor can insert goals
CREATE POLICY "goals_insert_admin_gestor"
  ON goals FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_gestor());

-- Only admin/gestor can update goals
CREATE POLICY "goals_update_admin_gestor"
  ON goals FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_gestor())
  WITH CHECK (public.is_admin_or_gestor());

-- Only admin/gestor can delete goals
CREATE POLICY "goals_delete_admin_gestor"
  ON goals FOR DELETE
  TO authenticated
  USING (public.is_admin_or_gestor());


-- ═════════════════════════════════════════════
-- ACTIVITIES
-- ═════════════════════════════════════════════
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all activities
CREATE POLICY "activities_select_authenticated"
  ON activities FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert activities
CREATE POLICY "activities_insert_authenticated"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only admin can delete activities
CREATE POLICY "activities_delete_admin"
  ON activities FOR DELETE
  TO authenticated
  USING (public.is_admin());
