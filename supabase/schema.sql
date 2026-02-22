-- ============================================================
-- Project Makmur — Supabase PostgreSQL Schema & RLS Policies
-- ============================================================
-- IDEMPOTENT: Safe to re-run. All policies/triggers are dropped first.
-- Run this script in your Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

-- ----------------------------------------------------------
-- 0A. USER ROLES TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'volunteer' CHECK (role IN ('admin', 'volunteer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_user_roles" ON public.user_roles;
CREATE POLICY "anyone_read_user_roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_manage_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin_insert_user_roles" ON public.user_roles;
CREATE POLICY "admin_insert_user_roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK ( public.is_admin() );

DROP POLICY IF EXISTS "admin_update_user_roles" ON public.user_roles;
CREATE POLICY "admin_update_user_roles"
  ON public.user_roles
  FOR UPDATE
  USING ( public.is_admin() );

DROP POLICY IF EXISTS "admin_delete_user_roles" ON public.user_roles;
CREATE POLICY "admin_delete_user_roles"
  ON public.user_roles
  FOR DELETE
  USING ( public.is_admin() );

-- ----------------------------------------------------------
-- 0B. HELPER: Check if the current user is an AJK admin
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;


-- ===========================================================
-- 1. VOLUNTEER GIGS
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.volunteer_gigs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  required_pax int NOT NULL DEFAULT 1,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.volunteer_gigs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_volunteer_gigs" ON public.volunteer_gigs;
CREATE POLICY "admin_full_volunteer_gigs"
  ON public.volunteer_gigs
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "guest_read_volunteer_gigs" ON public.volunteer_gigs;
CREATE POLICY "guest_read_volunteer_gigs"
  ON public.volunteer_gigs
  FOR SELECT
  USING (true);


-- ===========================================================
-- 2. GIG CLAIMS  (unique per guest + gig)
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.gig_claims (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id     uuid NOT NULL REFERENCES public.volunteer_gigs(id) ON DELETE CASCADE,
  guest_uuid uuid NOT NULL DEFAULT auth.uid(),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gig_id, guest_uuid)
);

ALTER TABLE public.gig_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_gig_claims" ON public.gig_claims;
CREATE POLICY "admin_full_gig_claims"
  ON public.gig_claims
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "guest_read_own_gig_claims" ON public.gig_claims;
CREATE POLICY "guest_read_own_gig_claims"
  ON public.gig_claims
  FOR SELECT
  USING (true); -- Allow counting for landing page stats

DROP POLICY IF EXISTS "guest_insert_gig_claims" ON public.gig_claims;
DROP POLICY IF EXISTS "registered_insert_gig_claims" ON public.gig_claims;
CREATE POLICY "registered_insert_gig_claims"
  ON public.gig_claims
  FOR INSERT
  WITH CHECK (
    auth.uid() = guest_uuid
    AND auth.uid() IS NOT NULL
  );

-- Allow any logged-in user to cancel (delete) their own gig claim
DROP POLICY IF EXISTS "registered_delete_own_gig_claims" ON public.gig_claims;
CREATE POLICY "registered_delete_own_gig_claims"
  ON public.gig_claims
  FOR DELETE
  USING (
    auth.uid() = guest_uuid
    AND auth.uid() IS NOT NULL
  );


-- ===========================================================
-- 3. CROWDFUND CAMPAIGNS
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.crowdfund_campaigns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL,
  description    text,
  target_amount  numeric(12,2) NOT NULL DEFAULT 0,
  current_amount numeric(12,2) NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crowdfund_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_crowdfund_campaigns" ON public.crowdfund_campaigns;
CREATE POLICY "admin_full_crowdfund_campaigns"
  ON public.crowdfund_campaigns
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "guest_read_crowdfund_campaigns" ON public.crowdfund_campaigns;
CREATE POLICY "guest_read_crowdfund_campaigns"
  ON public.crowdfund_campaigns
  FOR SELECT
  USING (true);


-- ===========================================================
-- 4. DONATIONS
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.donations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       uuid NOT NULL REFERENCES public.crowdfund_campaigns(id) ON DELETE CASCADE,
  amount            numeric(12,2) NOT NULL,
  stripe_session_id text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_donations" ON public.donations;
CREATE POLICY "admin_full_donations"
  ON public.donations
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "guest_read_donations" ON public.donations;
CREATE POLICY "guest_read_donations"
  ON public.donations
  FOR SELECT
  USING (true); -- Allow summing for landing page stats


-- ===========================================================
-- 5. FOOD EVENTS
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.food_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  total_capacity     int  NOT NULL DEFAULT 500,
  remaining_capacity int  NOT NULL DEFAULT 500,
  event_date         date NOT NULL DEFAULT CURRENT_DATE,
  start_time         time NOT NULL DEFAULT '17:00:00',
  end_time           time NOT NULL DEFAULT '19:00:00',
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.food_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_food_events" ON public.food_events;
CREATE POLICY "admin_full_food_events"
  ON public.food_events
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "guest_read_food_events" ON public.food_events;
CREATE POLICY "guest_read_food_events"
  ON public.food_events
  FOR SELECT
  USING (true); -- Allow counting for landing page stats


-- ===========================================================
-- 6. KUPON CLAIMS  (unique per guest + event)
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.kupon_claims (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES public.food_events(id) ON DELETE CASCADE,
  guest_uuid uuid NOT NULL DEFAULT auth.uid(),
  is_scanned boolean NOT NULL DEFAULT false,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, guest_uuid)
);

ALTER TABLE public.kupon_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_kupon_claims" ON public.kupon_claims;
CREATE POLICY "admin_full_kupon_claims"
  ON public.kupon_claims
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "guest_read_own_kupon_claims" ON public.kupon_claims;
CREATE POLICY "guest_read_own_kupon_claims"
  ON public.kupon_claims
  FOR SELECT
  USING (auth.uid() = guest_uuid);

DROP POLICY IF EXISTS "guest_insert_kupon_claims" ON public.kupon_claims;
CREATE POLICY "guest_insert_kupon_claims"
  ON public.kupon_claims
  FOR INSERT
  WITH CHECK (auth.uid() = guest_uuid);


-- ===========================================================
-- 7. ZAKAT COUNTERS
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.zakat_counters (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  latitude   double precision NOT NULL,
  longitude  double precision NOT NULL,
  address    text,
  hours      text,
  start_date date,
  end_date   date,
  start_time time,
  end_time   time,
  is_active  boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zakat_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_zakat_counters" ON public.zakat_counters;
CREATE POLICY "admin_full_zakat_counters"
  ON public.zakat_counters
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "guest_read_zakat_counters" ON public.zakat_counters;
CREATE POLICY "guest_read_zakat_counters"
  ON public.zakat_counters
  FOR SELECT
  USING (is_active = true);


-- ===========================================================
-- 8. SYSTEM BROADCASTS  (only one active broadcast at a time)
-- ===========================================================
CREATE TABLE IF NOT EXISTS public.system_broadcasts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message    text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_system_broadcasts" ON public.system_broadcasts;
CREATE POLICY "admin_full_system_broadcasts"
  ON public.system_broadcasts
  FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "guest_read_system_broadcasts" ON public.system_broadcasts;
CREATE POLICY "guest_read_system_broadcasts"
  ON public.system_broadcasts
  FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Auto-deactivate old broadcasts when a new one is inserted
CREATE OR REPLACE FUNCTION public.deactivate_old_broadcasts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.system_broadcasts
  SET is_active = false
  WHERE id != NEW.id AND is_active = true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_old_broadcasts ON public.system_broadcasts;
CREATE TRIGGER trg_deactivate_old_broadcasts
  AFTER INSERT ON public.system_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION public.deactivate_old_broadcasts();


-- ===========================================================
-- 9. SUPABASE REALTIME —-- Enable Realtime (ignore if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.food_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_broadcasts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ===========================================================
-- 10. DECREMENT FOOD CAPACITY RPC (called when admin scans a kupon)
-- ===========================================================
CREATE OR REPLACE FUNCTION public.scan_kupon(p_claim_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
  v_remaining int;
BEGIN
  -- Mark the kupon as scanned
  UPDATE public.kupon_claims
  SET is_scanned = true
  WHERE id = p_claim_id AND is_scanned = false
  RETURNING event_id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Kupon not found or already scanned');
  END IF;

  -- Decrement remaining capacity
  UPDATE public.food_events
  SET remaining_capacity = remaining_capacity - 1
  WHERE id = v_event_id AND remaining_capacity > 0
  RETURNING remaining_capacity INTO v_remaining;

  IF v_remaining IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No remaining capacity');
  END IF;

  RETURN json_build_object('success', true, 'remaining', v_remaining);
END;
$$;

-- Add public read policy for user roles so stats can count volunteers
DROP POLICY IF EXISTS "guest_read_user_roles" ON public.user_roles;
CREATE POLICY "guest_read_user_roles"
  ON public.user_roles
  FOR SELECT
  USING (true);

-- ===========================================================
-- 11. DECREMENT CAPACITY ON CLAIM (TRIGGER)
-- ===========================================================
CREATE OR REPLACE FUNCTION public.decrement_kupon_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.food_events
  SET remaining_capacity = remaining_capacity - 1
  WHERE id = NEW.event_id AND remaining_capacity > 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_kupon_capacity ON public.kupon_claims;
CREATE TRIGGER trg_decrement_kupon_capacity
  AFTER INSERT ON public.kupon_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_kupon_capacity();
