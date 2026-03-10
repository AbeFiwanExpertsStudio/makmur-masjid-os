-- ===========================================================
-- FIX: Restore Food Capacity when Kupon is Canceled (Deleted)
-- ===========================================================
CREATE OR REPLACE FUNCTION public.restore_kupon_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only restore capacity if the kupon wasn't already scanned (used)
  IF OLD.is_scanned = false THEN
    UPDATE public.food_events
    SET remaining_capacity = remaining_capacity + 1
    WHERE id = OLD.event_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_kupon_capacity ON public.kupon_claims;
CREATE TRIGGER trg_restore_kupon_capacity
  AFTER DELETE ON public.kupon_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_kupon_capacity();


-- ===========================================================
-- FIX: Prevent Overbooking Volunteer Gigs
-- ===========================================================
CREATE OR REPLACE FUNCTION public.check_gig_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_claims int;
  v_required_pax int;
BEGIN
  -- 1. Get current claim count
  SELECT COUNT(*) INTO v_current_claims
  FROM public.gig_claims
  WHERE gig_id = NEW.gig_id;

  -- 2. Get required pax for this gig
  SELECT required_pax INTO v_required_pax
  FROM public.volunteer_gigs
  WHERE id = NEW.gig_id;

  -- 3. Check if full
  IF v_required_pax IS NOT NULL AND v_current_claims >= v_required_pax THEN
    RAISE EXCEPTION 'This gig is already full (Limit: % Pax)', v_required_pax;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_gig_capacity ON public.gig_claims;
CREATE TRIGGER trg_check_gig_capacity
  BEFORE INSERT ON public.gig_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.check_gig_capacity();
