-- ============================================================
-- Migration: Add missing performance indexes
-- All hot query paths that were doing sequential scans.
-- ============================================================

-- kupon_claims — guest sees own claims; admin scans by guest_uuid
CREATE INDEX IF NOT EXISTS idx_kupon_claims_guest
  ON public.kupon_claims (guest_uuid);

-- kupon_claims — admin + scan_kupon queries by event
CREATE INDEX IF NOT EXISTS idx_kupon_claims_event
  ON public.kupon_claims (event_id);

-- kupon_claims — scan_kupon v2 short-prefix look-up (already has PK idx)
-- This partial index speeds up "show all unscanned for today"
CREATE INDEX IF NOT EXISTS idx_kupon_claims_unscanned
  ON public.kupon_claims (event_id, claimed_at)
  WHERE is_scanned = false;

-- gig_claims — volunteer history look-ups
CREATE INDEX IF NOT EXISTS idx_gig_claims_guest
  ON public.gig_claims (guest_uuid);

CREATE INDEX IF NOT EXISTS idx_gig_claims_gig
  ON public.gig_claims (gig_id);

-- donations — campaign total queries, webhook look-ups
CREATE INDEX IF NOT EXISTS idx_donations_campaign
  ON public.donations (campaign_id);

CREATE INDEX IF NOT EXISTS idx_donations_status
  ON public.donations (status)
  WHERE status <> 'completed';

-- food_events — date-range filtering (active today, upcoming)
CREATE INDEX IF NOT EXISTS idx_food_events_date
  ON public.food_events (event_date);

-- volunteer_gigs — upcoming / past filtering
CREATE INDEX IF NOT EXISTS idx_volunteer_gigs_date
  ON public.volunteer_gigs (gig_date);

-- user_roles — is_admin() checks (already has unique idx on user_id)
-- This ensures the role filter is covered:
CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON public.user_roles (user_id, role);

-- system_broadcasts — Navbar loads last 24h active broadcasts
CREATE INDEX IF NOT EXISTS idx_broadcasts_active_created
  ON public.system_broadcasts (created_at DESC)
  WHERE is_active = true;
