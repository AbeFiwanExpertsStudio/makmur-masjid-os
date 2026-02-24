-- ============================================================
-- Fix scan_kupon: prevent multi-row LIKE attack,
-- restore event-active-time validation, and add admin guard.
-- Run this in Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.scan_kupon(p_claim_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim_id  uuid;
  v_event_id  uuid;
  v_remaining int;
  v_is_active boolean;
BEGIN
  -- Admin-only check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can scan kupons.';
  END IF;

  -- Resolve the claim ID:
  -- Accept either a full UUID or the 8-char prefix shown in the UI.
  -- For a prefix match we use LIMIT 1 on an index-backed cast to text,
  -- and only match against unscanned kupons.
  IF length(p_claim_id) = 36 THEN
    -- Full UUID provided — exact match
    BEGIN
      v_claim_id := p_claim_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN json_build_object('success', false, 'error', 'Invalid kupon ID format');
    END;
  ELSE
    -- Short prefix (e.g. first 8 chars from UI) — find the single matching claim
    SELECT id INTO v_claim_id
    FROM public.kupon_claims
    WHERE id::text LIKE (p_claim_id || '%')
      AND is_scanned = false
    ORDER BY claimed_at ASC
    LIMIT 1;

    IF v_claim_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Kupon not found or already scanned');
    END IF;
  END IF;

  -- Validate that the event is currently active (not expired or not yet started)
  SELECT
    fe.id,
    (
      (fe.event_date + fe.start_time) AT TIME ZONE 'Asia/Kuala_Lumpur' <= NOW()
      AND
      (fe.event_date + fe.end_time)   AT TIME ZONE 'Asia/Kuala_Lumpur' >  NOW()
    )
  INTO v_event_id, v_is_active
  FROM public.kupon_claims kc
  JOIN public.food_events fe ON fe.id = kc.event_id
  WHERE kc.id = v_claim_id;

  IF v_event_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Kupon or event not found');
  END IF;

  IF NOT v_is_active THEN
    RETURN json_build_object('success', false, 'error', 'This event is not currently active');
  END IF;

  -- Mark exactly one row as scanned using the resolved UUID (no LIKE needed)
  UPDATE public.kupon_claims
  SET is_scanned = true
  WHERE id = v_claim_id
    AND is_scanned = false;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Kupon already scanned');
  END IF;

  -- Return remaining capacity
  SELECT remaining_capacity INTO v_remaining
  FROM public.food_events
  WHERE id = v_event_id;

  RETURN json_build_object('success', true, 'remaining', v_remaining);
END;
$$;
