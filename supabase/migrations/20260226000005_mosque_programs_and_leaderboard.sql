-- ═══════════════════════════════════════════════════════════════════
-- Migration: Mosque Programs + Volunteer Leaderboard RPC
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. mosque_programs table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mosque_programs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  description     text,
  program_type    text        NOT NULL DEFAULT 'lecture'
                              CHECK (program_type IN ('lecture','halaqah','jumuah','other')),
  program_date    date        NOT NULL,
  start_time      time        NOT NULL,
  end_time        time        NOT NULL,
  speaker         text,
  location        text,
  is_recurring    boolean     NOT NULL DEFAULT false,
  recurrence_note text,       -- e.g. "Every Friday after Isyak"
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Enable Realtime ──────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mosque_programs;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already a member, skip
END;
$$;

-- ── 3. RLS for mosque_programs ──────────────────────────────────────
ALTER TABLE public.mosque_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mosque_programs_public_read"  ON public.mosque_programs;
DROP POLICY IF EXISTS "mosque_programs_admin_insert" ON public.mosque_programs;
DROP POLICY IF EXISTS "mosque_programs_admin_update" ON public.mosque_programs;
DROP POLICY IF EXISTS "mosque_programs_admin_delete" ON public.mosque_programs;

CREATE POLICY "mosque_programs_public_read"
  ON public.mosque_programs FOR SELECT
  USING (is_active = true OR public.is_admin());

CREATE POLICY "mosque_programs_admin_insert"
  ON public.mosque_programs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "mosque_programs_admin_update"
  ON public.mosque_programs FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "mosque_programs_admin_delete"
  ON public.mosque_programs FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ── 4. Index for fast date-filtered queries ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_mosque_programs_date
  ON public.mosque_programs(program_date DESC);

-- ── 5. get_volunteer_leaderboard() RPC ──────────────────────────────
-- Returns top 10 users by total_points, joined with profiles.display_name.
DROP FUNCTION IF EXISTS public.get_volunteer_leaderboard();
CREATE OR REPLACE FUNCTION public.get_volunteer_leaderboard()
RETURNS TABLE (
  rank          int,
  user_id       uuid,
  display_name  text,
  total_points  integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY ur.total_points DESC)::int AS rank,
    ur.user_id,
    COALESCE(p.display_name, 'Anonymous Volunteer') AS display_name,
    COALESCE(ur.total_points, 0)                    AS total_points
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE COALESCE(ur.total_points, 0) > 0
    AND ur.role IN ('admin', 'volunteer')
  ORDER BY ur.total_points DESC
  LIMIT 10;
$$;

-- ── 6. Fix complete_gig: upsert user_roles so points always land ─────
-- Previously a plain UPDATE silently did nothing for users who only
-- have an auth.users row but no user_roles row yet.

-- Ensure columns exist (idempotent — safe if add_admin_rpcs.sql ran first)
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS total_points integer DEFAULT 0;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

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

  -- Get gig title for notification
  SELECT title INTO v_title FROM public.volunteer_gigs WHERE id = p_gig_id;

  -- Mark gig as completed
  UPDATE public.volunteer_gigs
  SET is_completed = true, completed_at = now()
  WHERE id = p_gig_id;

  -- Upsert 100 points for every volunteer who claimed this gig.
  -- INSERT creates the row if missing; ON CONFLICT accumulates points.
  INSERT INTO public.user_roles (user_id, role, total_points)
  SELECT gc.guest_uuid, 'volunteer', 100
  FROM public.gig_claims gc
  WHERE gc.gig_id = p_gig_id
  ON CONFLICT (user_id) DO UPDATE
    SET total_points = COALESCE(user_roles.total_points, 0) + 100;

  -- Insert periodic notifications for all participants
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT gc.guest_uuid, 'gig_completed', jsonb_build_object(
    'gig_title', v_title,
    'points_awarded', 100
  )
  FROM public.gig_claims gc
  WHERE gc.gig_id = p_gig_id;
END;
$$;

-- Grant execute to authenticated users (RPC is SECURITY DEFINER so
-- it runs with definer privileges, but caller still needs EXECUTE).
GRANT EXECUTE ON FUNCTION public.get_volunteer_leaderboard() TO authenticated, anon;

-- ── 7. Seed: example programs for Ramadan 1447H ─────────────────────
INSERT INTO public.mosque_programs
  (id, title, description, program_type, program_date, start_time, end_time, speaker, location, is_recurring, recurrence_note)
VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'Kuliah Maghrib Harian',
    'Kuliah ringkas selepas solat Maghrib membincangkan hadith-hadith pilihan.',
    'lecture', CURRENT_DATE, '19:30', '20:00',
    'Ustaz Hafiz Ibrahim', 'Dewan Utama', true, 'Setiap malam Ramadan'
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'Halaqah Tafsir Al-Quran',
    'Perbincangan mendalam tafsir surah-surah pilihan bersama jemaah.',
    'halaqah', CURRENT_DATE + 1, '21:30', '22:15',
    'Ustaz Dr. Zulkifli Mohamad', 'Bilik Kuliah Al-Hikmah', true, 'Setiap malam selepas Terawih'
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'Kuliah Jumaat Khas Ramadan',
    'Ceramah khas sempena Jumaat Ramadan — tema: Memperbanyak Amal Pada 10 Malam Terakhir.',
    'jumuah', CURRENT_DATE + 1, '20:15', '21:00',
    'Tuan Haji Roslan Daud', 'Dewan Utama', false, NULL
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'Forum Zakat & Infaq di Era Digital',
    'Perbincangan panel tentang zakat, infaq, dan wakaf dalam konteks semasa.',
    'lecture', CURRENT_DATE + 5, '14:00', '16:00',
    'Panel Pelbagai Penceramah', 'Dewan Serbaguna', false, NULL
  ),
  (
    'b1000000-0000-0000-0000-000000000005',
    'Halaqah Wanita — Fiqh Ramadan',
    'Sesi khas untuk muslimah membincangkan hukum-hakam Ramadan.',
    'halaqah', CURRENT_DATE + 2, '10:00', '11:30',
    'Ustazah Nurul Ain', 'Ruang Solat Wanita', true, 'Setiap Selasa & Khamis'
  )
ON CONFLICT (id) DO NOTHING;
