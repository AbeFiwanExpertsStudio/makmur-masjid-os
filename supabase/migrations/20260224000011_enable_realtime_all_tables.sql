-- ================================================================
-- REPLICA IDENTITY FULL
-- Required for Supabase postgres_changes to work correctly with RLS.
-- Without this, Supabase cannot evaluate row-level security policies
-- on change events and silently drops them — causing real-time
-- subscriptions to appear broken even though the code is correct.
-- ================================================================

ALTER TABLE public.system_broadcasts   REPLICA IDENTITY FULL;
ALTER TABLE public.food_events         REPLICA IDENTITY FULL;
ALTER TABLE public.kupon_claims        REPLICA IDENTITY FULL;
ALTER TABLE public.volunteer_gigs      REPLICA IDENTITY FULL;
ALTER TABLE public.gig_claims          REPLICA IDENTITY FULL;
ALTER TABLE public.donations           REPLICA IDENTITY FULL;
ALTER TABLE public.crowdfund_campaigns REPLICA IDENTITY FULL;
ALTER TABLE public.zakat_counters      REPLICA IDENTITY FULL;
ALTER TABLE public.screen_slides       REPLICA IDENTITY FULL;
ALTER TABLE public.system_settings     REPLICA IDENTITY FULL;

-- ================================================================
-- Add missing tables to the realtime publication
-- ================================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.kupon_claims;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.volunteer_gigs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.gig_claims;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crowdfund_campaigns;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.zakat_counters;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ================================================================
-- Explicit SELECT grants so the Supabase Realtime service can
-- evaluate RLS policies on behalf of anon / authenticated clients.
-- Without these, postgres_changes events are silently filtered out.
-- ================================================================
GRANT SELECT ON public.system_broadcasts   TO anon, authenticated;
GRANT SELECT ON public.food_events         TO anon, authenticated;
GRANT SELECT ON public.kupon_claims        TO anon, authenticated;
GRANT SELECT ON public.volunteer_gigs      TO anon, authenticated;
GRANT SELECT ON public.gig_claims          TO anon, authenticated;
GRANT SELECT ON public.donations           TO anon, authenticated;
GRANT SELECT ON public.crowdfund_campaigns TO anon, authenticated;
GRANT SELECT ON public.zakat_counters      TO anon, authenticated;
GRANT SELECT ON public.screen_slides       TO anon, authenticated;
GRANT SELECT ON public.system_settings     TO anon, authenticated;
