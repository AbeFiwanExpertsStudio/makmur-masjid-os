-- ============================================================
-- Add Admin RPCs (User Management, Gigs, Broadcasts)
-- Run this in Supabase SQL Editor to enable all admin features
-- ============================================================

-- ----------------------------------------------------------
-- 0. ADD MISSING COLUMNS
-- ----------------------------------------------------------
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS total_points integer DEFAULT 0;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT FALSE;

-- Add gig completion tracking columns if not already present
ALTER TABLE public.volunteer_gigs ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT FALSE;
ALTER TABLE public.volunteer_gigs ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Create broadcasts view with security_invoker so RLS of the querying user is respected
DROP VIEW IF EXISTS public.broadcasts CASCADE;
CREATE OR REPLACE VIEW public.broadcasts
WITH (security_invoker = on)
AS
SELECT * FROM public.system_broadcasts;

-- ----------------------------------------------------------
-- 1. USER MANAGEMENT
-- ----------------------------------------------------------

-- Demote Admin to Volunteer
CREATE OR REPLACE FUNCTION public.demote_admin(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can demote users.';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found.', target_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'volunteer')
  ON CONFLICT (user_id) DO UPDATE
  SET role = 'volunteer', created_at = now();
END;
$$;

-- Ban User
CREATE OR REPLACE FUNCTION public.ban_user(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can ban users.';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found.', target_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role, is_banned)
  VALUES (target_user_id, 'volunteer', TRUE)
  ON CONFLICT (user_id) DO UPDATE SET is_banned = TRUE;
END;
$$;

-- Unban User
CREATE OR REPLACE FUNCTION public.unban_user(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can unban users.';
  END IF;

  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found.', target_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role, is_banned)
  VALUES (target_user_id, 'volunteer', FALSE)
  ON CONFLICT (user_id) DO UPDATE SET is_banned = FALSE;
END;
$$;

-- admin_get_all_users — fresh name to avoid PostgREST cache issues
DROP FUNCTION IF EXISTS public.get_all_users();
DROP FUNCTION IF EXISTS public.admin_get_all_users();
CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  role text,
  is_banned boolean,
  total_points integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view user list.';
  END IF;

  RETURN QUERY
  SELECT
    au.id,
    au.email::text,
    COALESCE(au.raw_user_meta_data->>'display_name', au.email::text)::text AS display_name,
    COALESCE(ur.role, 'volunteer')::text AS role,
    COALESCE(ur.is_banned, FALSE) AS is_banned,
    COALESCE(ur.total_points, 0) AS total_points
  FROM auth.users au
  LEFT JOIN public.user_roles ur ON au.id = ur.user_id
  ORDER BY au.email ASC;
END;
$$;

-- ----------------------------------------------------------
-- 2. GIGS & BROADCASTS
-- ----------------------------------------------------------

-- Claim Gig with overlap check
DROP FUNCTION IF EXISTS public.claim_gig(uuid, uuid);
CREATE OR REPLACE FUNCTION public.claim_gig(p_gig_id uuid, p_guest_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_date date;
  new_start time;
  new_end   time;
BEGIN
  -- Get new gig's date and time range
  SELECT gig_date, start_time, end_time
  INTO new_date, new_start, new_end
  FROM public.volunteer_gigs
  WHERE id = p_gig_id;

  IF new_date IS NULL THEN
    RAISE EXCEPTION 'Gig not found.';
  END IF;

  -- Block if user already claimed an overlapping gig on the same date that is STILL active/future
  IF EXISTS (
    SELECT 1
    FROM public.gig_claims gc
    JOIN public.volunteer_gigs vg ON vg.id = gc.gig_id
    WHERE gc.guest_uuid = p_guest_uuid
      AND vg.gig_date = new_date
      AND vg.id != p_gig_id
      AND vg.is_cancelled = false
      AND vg.is_completed = false
      -- Ignore overlaps with gigs that have already ended (to allow joining a new one if it overlaps with the "past" part of a completed/expired gig)
      AND (vg.gig_date + vg.end_time) > now()
      AND new_start < vg.end_time
      AND new_end   > vg.start_time
  ) THEN
    RAISE EXCEPTION 'You already have an active gig that overlaps with this time slot.';
  END IF;

  -- Insert the claim (will throw 23505 if duplicate)
  INSERT INTO public.gig_claims (gig_id, guest_uuid)
  VALUES (p_gig_id, p_guest_uuid);
END;
$$;

-- Complete Gig (Award Points)
DROP FUNCTION IF EXISTS public.complete_gig(uuid);
CREATE OR REPLACE FUNCTION public.complete_gig(p_gig_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can complete gigs.';
  END IF;

  -- Ensure the notifications table has the columns we need (safety check)
  BEGIN
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}';
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;

    -- PRE-REQUISITE: Populate any existing NULL values first to avoid constraint errors
    UPDATE public.notifications SET type = 'legacy' WHERE type IS NULL;
    UPDATE public.notifications SET payload = '{}'::jsonb WHERE payload IS NULL;
    UPDATE public.notifications SET is_read = false WHERE is_read IS NULL;

    -- CRITICAL: If a 'message' column exists (from an old schema), it must be nullable
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'message') THEN
      ALTER TABLE public.notifications ALTER COLUMN message DROP NOT NULL;
    END IF;

    -- Finalize constraints
    ALTER TABLE public.notifications ALTER COLUMN type SET NOT NULL;
    ALTER TABLE public.notifications ALTER COLUMN payload SET NOT NULL;
    ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Get gig title for notification
  SELECT title INTO v_title FROM public.volunteer_gigs WHERE id = p_gig_id;

  -- Mark gig as completed
  UPDATE public.volunteer_gigs
  SET is_completed = true, completed_at = now()
  WHERE id = p_gig_id;

  -- Award 100 points (using robust UPSERT to user_roles)
  INSERT INTO public.user_roles (user_id, role, total_points)
  SELECT gc.guest_uuid, 'volunteer', 100
  FROM public.gig_claims gc
  WHERE gc.gig_id = p_gig_id
  ON CONFLICT (user_id) DO UPDATE
    SET total_points = COALESCE(user_roles.total_points, 0) + 100;

  -- Send persistent notifications to all volunteers who claimed this gig
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT 
    gc.guest_uuid, 
    'gig_completed', 
    jsonb_build_object(
      'gig_id', p_gig_id, 
      'gig_title', vg.title,           -- Key must match Navbar.tsx expectations
      'points_awarded', 100,           -- Key must match Navbar.tsx expectations
      'completed_at', now()
    )
  FROM public.gig_claims gc
  JOIN public.volunteer_gigs vg ON vg.id = gc.gig_id
  WHERE gc.gig_id = p_gig_id;
END;
$$;

-- Send Broadcast
CREATE OR REPLACE FUNCTION public.send_broadcast(msg text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can send broadcasts.';
  END IF;

  INSERT INTO public.system_broadcasts (message, is_active)
  VALUES (msg, true);
END;
$$;

-- Delete Broadcast
CREATE OR REPLACE FUNCTION public.delete_broadcast(broadcast_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete broadcasts.';
  END IF;

  DELETE FROM public.system_broadcasts WHERE id = broadcast_id;
END;
$$;

-- ----------------------------------------------------------
-- 3. RELOAD POSTGREST SCHEMA CACHE
-- ----------------------------------------------------------

-- Get all unclaimed kupons with guest display names (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_unclaimed_kupons()
RETURNS TABLE (
  id          uuid,
  event_id    uuid,
  event_name  text,
  guest_uuid  uuid,
  display_name text,
  claimed_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    kc.id,
    kc.event_id,
    fe.name AS event_name,
    kc.guest_uuid,
    COALESCE(au.raw_user_meta_data->>'display_name', au.email) AS display_name,
    kc.claimed_at
  FROM public.kupon_claims kc
  JOIN public.food_events fe ON fe.id = kc.event_id
  LEFT JOIN auth.users au ON au.id = kc.guest_uuid
  WHERE kc.is_scanned = false
    AND (fe.event_date + fe.start_time) AT TIME ZONE 'Asia/Kuala_Lumpur' <= NOW()  -- event has started (MYT)
    AND (fe.event_date + fe.end_time)   AT TIME ZONE 'Asia/Kuala_Lumpur' >  NOW()  -- event not yet ended (MYT)
  ORDER BY kc.claimed_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_unclaimed_kupons() TO authenticated;

NOTIFY pgrst, 'reload schema';
