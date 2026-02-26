-- ═══════════════════════════════════════════════════════════════════
-- Migration: Persistent Notifications + Booking QR RPC
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. notifications table ──────────────────────────────────────────
-- Stores durable, per-user notifications so users see them even after
-- they come back online (unlike ephemeral Realtime channel messages).

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text        NOT NULL,      -- 'booking_approved' | 'booking_rejected' | 'booking_cancelled'
  payload    jsonb       NOT NULL DEFAULT '{}',
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

-- ── 2. RLS for notifications ────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own"  ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own"  ON public.notifications;

-- Users can only read their own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Any authenticated user may insert (admin inserts for another user_id)
-- The service role used by Supabase functions bypasses RLS entirely.
CREATE POLICY "notifications_insert_auth"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can mark their own as read
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- ── 3. Enable Realtime for notifications ────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

-- ── 4. verify_booking_token RPC ─────────────────────────────────────
-- Called by /admin/scan-booking to validate a scanned QR code.
-- Returns the booking details if valid + approved, or valid=false.
--
-- Usage: SELECT * FROM verify_booking_token('some-uuid');

DROP FUNCTION IF EXISTS public.verify_booking_token(uuid);

CREATE OR REPLACE FUNCTION public.verify_booking_token(p_booking_id uuid)
RETURNS TABLE (
  valid          boolean,
  is_today       boolean,   -- true when booking_date = today (useful for staff warning)
  booking_status text,
  purpose        text,
  facility_name  text,
  booking_date   date,
  start_time     time,
  end_time       time,
  booked_by_name text,
  attendees      integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    (fb.status = 'approved')                                          AS valid,
    (fb.booking_date = CURRENT_DATE)                                  AS is_today,
    fb.status                                                         AS booking_status,
    fb.purpose                                                        AS purpose,
    COALESCE(f.name, 'Unknown Facility')                              AS facility_name,
    fb.booking_date                                                   AS booking_date,
    fb.start_time                                                     AS start_time,
    fb.end_time                                                       AS end_time,
    -- Prefer profiles.display_name, fall back to auth.users metadata, then email
    COALESCE(
      NULLIF(p.display_name, ''),
      au.raw_user_meta_data->>'display_name',
      au.email,
      'Unknown'
    )                                                                 AS booked_by_name,
    COALESCE(fb.attendees, 1)                                         AS attendees
  FROM   public.facility_bookings fb
  LEFT   JOIN public.facilities    f  ON f.id  = fb.facility_id
  LEFT   JOIN public.profiles      p  ON p.id  = fb.booked_by
  LEFT   JOIN auth.users           au ON au.id = fb.booked_by
  WHERE  fb.id = p_booking_id;
$$;

GRANT EXECUTE ON FUNCTION public.verify_booking_token(uuid) TO authenticated, anon;
