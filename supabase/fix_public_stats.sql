-- ============================================================
-- Fix: get_public_stats RPC
-- Returns aggregated stats for the landing page counters.
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS TABLE (
  iftar_packs_distributed bigint,
  active_volunteers       bigint,
  donations_collected     numeric,
  zakat_counters_live     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Iftar packs: total claimed kupons across all food events
    -- (total_capacity - remaining_capacity = packs distributed)
    COALESCE(
      (SELECT SUM(total_capacity - remaining_capacity) FROM public.food_events),
      0
    )::bigint AS iftar_packs_distributed,

    -- Active volunteers: distinct users who claimed at least one gig
    COALESCE(
      (SELECT COUNT(DISTINCT guest_uuid) FROM public.gig_claims),
      0
    )::bigint AS active_volunteers,

    -- Donations collected: sum of COMPLETED donations only (in RM)
    COALESCE(
      (SELECT SUM(amount) FROM public.donations WHERE status = 'completed'),
      0
    )::numeric AS donations_collected,

    -- Active zakat counters: currently active AND not expired AND within date range
    COALESCE(
      (SELECT COUNT(*) FROM public.zakat_counters
       WHERE is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (start_date IS NULL OR start_date <= CURRENT_DATE)
         AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      ),
      0
    )::bigint AS zakat_counters_live;
$$;

-- Allow both anonymous and authenticated users to call this
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
