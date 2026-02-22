
CREATE OR REPLACE FUNCTION public.scan_kupon(p_claim_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
  v_remaining int;
BEGIN
  -- We allow the admin to scan just the first 8 characters of the guest_uuid (which is shown in the UI)
  -- Or they can just provide a generic string for demo fallback claims
  UPDATE public.kupon_claims
  SET is_scanned = true
  WHERE guest_uuid::text LIKE (p_claim_id || '%') AND is_scanned = false
  RETURNING event_id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Kupon not found or already scanned');
  END IF;

  -- Get remaining capacity (it was already decremented upon claim)
  SELECT remaining_capacity INTO v_remaining
  FROM public.food_events
  WHERE id = v_event_id;

  IF v_remaining IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  RETURN json_build_object('success', true, 'remaining', v_remaining);
END;
$$;

