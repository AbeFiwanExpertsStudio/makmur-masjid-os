-- ============================================================
-- Security fixes for admin RPCs:
-- 1. Guard admin_get_unclaimed_kupons with is_admin() check
-- 2. Add increment_campaign_amount atomic RPC for webhook
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ----------------------------------------------------------
-- 1. Guard admin_get_unclaimed_kupons (was open to all authenticated users)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_unclaimed_kupons()
RETURNS TABLE (
  id           uuid,
  event_id     uuid,
  event_name   text,
  guest_uuid   uuid,
  display_name text,
  claimed_at   timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reject non-admin callers before touching any data
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can view unclaimed kupons.';
  END IF;

  RETURN QUERY
    SELECT
      kc.id,
      kc.event_id,
      fe.name AS event_name,
      kc.guest_uuid,
      COALESCE(au.raw_user_meta_data->>'display_name', au.email) AS display_name,
      kc.claimed_at
    FROM public.kupon_claims kc
    JOIN public.food_events fe ON fe.id = kc.event_id
    LEFT JOIN auth.users au    ON au.id = kc.guest_uuid
    WHERE kc.is_scanned = false
      AND (fe.event_date + fe.start_time) AT TIME ZONE 'Asia/Kuala_Lumpur' <= NOW()
      AND (fe.event_date + fe.end_time)   AT TIME ZONE 'Asia/Kuala_Lumpur' >  NOW()
    ORDER BY kc.claimed_at ASC;
END;
$$;

-- Keep the GRANT so admins (who are authenticated) can still call it
GRANT EXECUTE ON FUNCTION public.admin_get_unclaimed_kupons() TO authenticated;


-- ----------------------------------------------------------
-- 2. Atomic campaign amount increment (used by the webhook)
--    Avoids fetch→calculate→update race condition on concurrent donations.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_campaign_amount(
  p_campaign_id uuid,
  p_amount      numeric
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.crowdfund_campaigns
  SET current_amount = current_amount + p_amount
  WHERE id = p_campaign_id;
$$;

-- Only the service role (server-side webhook) should call this.
-- Revoke from end-users to prevent manual inflation.
REVOKE EXECUTE ON FUNCTION public.increment_campaign_amount(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_campaign_amount(uuid, numeric) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_campaign_amount(uuid, numeric) TO service_role;


NOTIFY pgrst, 'reload schema';
