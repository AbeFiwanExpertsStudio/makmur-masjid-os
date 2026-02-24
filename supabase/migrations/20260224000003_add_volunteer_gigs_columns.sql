-- ============================================================
-- Migration: Add missing columns to volunteer_gigs table
-- The gigs/page.tsx and admin/page.tsx both reference
-- gig_date, start_time, end_time which were never in schema.sql
-- ============================================================

-- Add timing columns
ALTER TABLE public.volunteer_gigs
  ADD COLUMN IF NOT EXISTS gig_date   date,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time   time;

-- Back-fill existing gigs with a reasonable default (Ramadan 2025 schedule)
-- Admins should update these via the UI once real dates are known.
UPDATE public.volunteer_gigs
SET
  gig_date   = COALESCE(gig_date,   CURRENT_DATE),
  start_time = COALESCE(start_time, '17:00:00'::time),
  end_time   = COALESCE(end_time,   '21:00:00'::time)
WHERE gig_date IS NULL;

-- Index for fast filtering of upcoming / past gigs
CREATE INDEX IF NOT EXISTS idx_volunteer_gigs_date
  ON public.volunteer_gigs (gig_date);
