-- ============================================================
-- Migration: Facility booking overlap prevention + auto-timestamps
-- Run in Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. OVERLAP PREVENTION TRIGGER
-- Prevents two bookings on the same facility/date overlapping.
-- Only checks pending + approved bookings (cancelled/rejected
-- are free slots again).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_facility_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.facility_bookings
    WHERE facility_id  = NEW.facility_id
      AND booking_date = NEW.booking_date
      AND status       IN ('pending', 'approved')
      AND id           != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND start_time   <  NEW.end_time
      AND end_time     >  NEW.start_time
  ) THEN
    RAISE EXCEPTION 'BOOKING_OVERLAP: This facility already has a booking during that time slot.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_facility_booking_overlap ON public.facility_bookings;
CREATE TRIGGER trg_facility_booking_overlap
  BEFORE INSERT OR UPDATE ON public.facility_bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_facility_booking_overlap();


-- ─────────────────────────────────────────────────────────────
-- 2. AUTO-UPDATE updated_at ON facility_bookings
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_facility_booking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_facility_bookings_updated_at ON public.facility_bookings;
CREATE TRIGGER trg_facility_bookings_updated_at
  BEFORE UPDATE ON public.facility_bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_booking_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 3. AUTO-CREATE PROFILE ROW ON AUTH USER SIGN-UP
-- Ensures every new user gets a profiles row automatically.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- 4. RLS on profiles (if not already set)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read any profile (for display names)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert/update their own profile
DROP POLICY IF EXISTS "profiles_upsert_own" ON public.profiles;
CREATE POLICY "profiles_upsert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());
