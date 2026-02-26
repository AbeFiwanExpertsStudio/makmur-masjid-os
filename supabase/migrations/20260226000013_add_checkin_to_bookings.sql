-- ═══════════════════════════════════════════════════════════════════
-- Migration: Facility Booking Check-In
-- Adds checked_in_at to facility_bookings, updates the verify RPC
-- to return booking_id + checked_in_at, and adds a secure checkin RPC.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Add checked_in_at column ─────────────────────────────────────
ALTER TABLE public.facility_bookings
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

-- ── 2. record_booking_checkin RPC ───────────────────────────────────
-- Called by /admin/scan-booking when admin presses "Confirm Check-In".
-- SECURITY DEFINER so it bypasses row-level security on the table.
-- Only admins may call it; it only touches approved + not-yet-checked rows.

DROP FUNCTION IF EXISTS public.record_booking_checkin(uuid);

CREATE OR REPLACE FUNCTION public.record_booking_checkin(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Restrict to admins only
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;

  UPDATE public.facility_bookings
  SET    checked_in_at = now()
  WHERE  id            = p_booking_id
    AND  status        = 'approved'
    AND  checked_in_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_booking_checkin(uuid) TO authenticated;

-- ── 3. Update verify_booking_token to expose booking_id + checked_in_at ──
DROP FUNCTION IF EXISTS public.verify_booking_token(uuid);

CREATE OR REPLACE FUNCTION public.verify_booking_token(p_booking_id uuid)
RETURNS TABLE (
  booking_id     uuid,
  valid          boolean,
  is_today       boolean,
  booking_status text,
  purpose        text,
  facility_name  text,
  booking_date   date,
  start_time     time,
  end_time       time,
  booked_by_name text,
  attendees      integer,
  checked_in_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    fb.id                                                             AS booking_id,
    (fb.status = 'approved')                                          AS valid,
    (fb.booking_date = CURRENT_DATE)                                  AS is_today,
    fb.status                                                         AS booking_status,
    fb.purpose                                                        AS purpose,
    COALESCE(f.name, 'Unknown Facility')                             AS facility_name,
    fb.booking_date                                                   AS booking_date,
    fb.start_time                                                     AS start_time,
    fb.end_time                                                       AS end_time,
    COALESCE(
      NULLIF(p.display_name, ''),
      au.raw_user_meta_data->>'display_name',
      au.email,
      'Unknown'
    )                                                                 AS booked_by_name,
    COALESCE(fb.attendees, 1)                                         AS attendees,
    fb.checked_in_at                                                  AS checked_in_at
  FROM   public.facility_bookings fb
  LEFT   JOIN public.facilities    f  ON f.id  = fb.facility_id
  LEFT   JOIN public.profiles      p  ON p.id  = fb.booked_by
  LEFT   JOIN auth.users           au ON au.id = fb.booked_by
  WHERE  fb.id = p_booking_id;
$$;

GRANT EXECUTE ON FUNCTION public.verify_booking_token(uuid) TO authenticated, anon;
