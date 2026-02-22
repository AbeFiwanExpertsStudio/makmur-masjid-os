-- =====================================================================
-- Project Makmur — Seed Volunteer Gigs into Supabase
-- =====================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- This inserts the 4 default Ramadan volunteer gigs into the
-- volunteer_gigs table using the same UUIDs as the old hardcoded data.
-- Safe to run multiple times (ON CONFLICT DO NOTHING).
-- =====================================================================

-- Insert the 4 demo gigs (auto-picks the first admin user as created_by)
INSERT INTO public.volunteer_gigs (id, title, description, required_pax, created_by)
VALUES
  (
    'a1111111-1111-4111-a111-111111111111',
    'Kacau Bubur Lambuk',
    'Join the team to stir and pack traditional Bubur Lambuk for the community.',
    15,
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
  ),
  (
    'a2222222-2222-4222-a222-222222222222',
    'Tarawih Traffic Control',
    'Manage car flow and parking for smooth Tarawih arrival.',
    10,
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
  ),
  (
    'a3333333-3333-4333-a333-333333333333',
    'Susun Sejadah & Saf',
    'Arrange prayer mats and align saf lines in the main prayer hall.',
    5,
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
  ),
  (
    'a4444444-4444-4444-a444-444444444444',
    'Clean Up Kitchen',
    'Help the kitchen team clean and pack up after Iftar preparation.',
    8,
    (SELECT id FROM auth.users ORDER BY created_at LIMIT 1)
  )
ON CONFLICT (id) DO NOTHING;

-- Verify the rows were inserted correctly
SELECT
  id,
  title,
  required_pax,
  (SELECT COUNT(*) FROM public.gig_claims WHERE gig_id = vg.id) AS claimed_count,
  created_at
FROM public.volunteer_gigs vg
ORDER BY created_at;
