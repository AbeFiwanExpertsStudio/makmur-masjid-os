-- 20260226000001_add_lost_found_and_facility_booking.sql
-- Adds two new modules: Lost & Found + Facility Booking

-- ═══════════════════════════════════════════════════════════════
-- 1. LOST & FOUND
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.lost_found_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('lost', 'found')),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'other',
  location_found text,          -- e.g., "Main Prayer Hall", "Parking Area"
  image_url text,               -- optional photo
  contact_info text,            -- phone or name for follow-up
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'resolved')),
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lost_found_items ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read
DROP POLICY IF EXISTS "anyone_read_lost_found" ON public.lost_found_items;
CREATE POLICY "anyone_read_lost_found"
  ON public.lost_found_items FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert their own posts
DROP POLICY IF EXISTS "user_insert_lost_found" ON public.lost_found_items;
CREATE POLICY "user_insert_lost_found"
  ON public.lost_found_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND posted_by = auth.uid());

-- Users can update their own posts, admins can update any
DROP POLICY IF EXISTS "user_update_own_lost_found" ON public.lost_found_items;
CREATE POLICY "user_update_own_lost_found"
  ON public.lost_found_items FOR UPDATE
  USING (posted_by = auth.uid() OR public.is_admin());

-- Admins can delete any post; users can delete their own
DROP POLICY IF EXISTS "user_delete_own_lost_found" ON public.lost_found_items;
CREATE POLICY "user_delete_own_lost_found"
  ON public.lost_found_items FOR DELETE
  USING (posted_by = auth.uid() OR public.is_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lost_found_type ON public.lost_found_items (type);
CREATE INDEX IF NOT EXISTS idx_lost_found_status ON public.lost_found_items (status);
CREATE INDEX IF NOT EXISTS idx_lost_found_created ON public.lost_found_items (created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- 2. FACILITY BOOKING
-- ═══════════════════════════════════════════════════════════════

-- Available facilities (managed by admin)
CREATE TABLE IF NOT EXISTS public.facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  location text,                -- e.g., "Level 2, Block A"
  capacity int,                 -- max number of people
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read facilities
DROP POLICY IF EXISTS "anyone_read_facilities" ON public.facilities;
CREATE POLICY "anyone_read_facilities"
  ON public.facilities FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete facilities
DROP POLICY IF EXISTS "admin_manage_facilities" ON public.facilities;
CREATE POLICY "admin_manage_facilities"
  ON public.facilities FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Booking records
CREATE TABLE IF NOT EXISTS public.facility_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  booked_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  purpose text,
  attendees int DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note text,              -- reason for rejection etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

ALTER TABLE public.facility_bookings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read bookings (to see availability)
DROP POLICY IF EXISTS "anyone_read_bookings" ON public.facility_bookings;
CREATE POLICY "anyone_read_bookings"
  ON public.facility_bookings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can create their own bookings
DROP POLICY IF EXISTS "user_insert_booking" ON public.facility_bookings;
CREATE POLICY "user_insert_booking"
  ON public.facility_bookings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND booked_by = auth.uid());

-- Users can update their own bookings (cancel), admins can update any
DROP POLICY IF EXISTS "user_update_own_booking" ON public.facility_bookings;
CREATE POLICY "user_update_own_booking"
  ON public.facility_bookings FOR UPDATE
  USING (booked_by = auth.uid() OR public.is_admin());

-- Users can delete their own bookings, admins can delete any
DROP POLICY IF EXISTS "user_delete_own_booking" ON public.facility_bookings;
CREATE POLICY "user_delete_own_booking"
  ON public.facility_bookings FOR DELETE
  USING (booked_by = auth.uid() OR public.is_admin());

-- Prevent double-booking: no two approved/pending bookings for same facility+date+time
CREATE UNIQUE INDEX IF NOT EXISTS idx_facility_no_overlap
  ON public.facility_bookings (facility_id, booking_date, start_time, end_time)
  WHERE status IN ('pending', 'approved');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_facility ON public.facility_bookings (facility_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON public.facility_bookings (booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.facility_bookings (booked_by);

-- Enable Realtime for new tables
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lost_found_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.facility_bookings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.facilities;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
