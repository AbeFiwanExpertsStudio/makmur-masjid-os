-- ============================================================
-- Migration: Fix kupon capacity — BEFORE INSERT trigger
-- The original AFTER INSERT trigger decrements capacity AFTER
-- the row is already written, so two concurrent claims can
-- both succeed even if remaining_capacity was 1.
-- A BEFORE INSERT trigger can RAISE EXCEPTION to abort the
-- INSERT before it commits, eliminating the race condition.
-- ============================================================

-- Replace the trigger function
CREATE OR REPLACE FUNCTION public.decrement_kupon_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining int;
BEGIN
  -- Lock the event row for update to serialize concurrent claims
  SELECT remaining_capacity
  INTO v_remaining
  FROM public.food_events
  WHERE id = NEW.event_id
  FOR UPDATE;

  IF v_remaining IS NULL OR v_remaining <= 0 THEN
    RAISE EXCEPTION 'CAPACITY_FULL: No remaining capacity for this event.';
  END IF;

  -- Decrement within the same transaction
  UPDATE public.food_events
  SET remaining_capacity = remaining_capacity - 1
  WHERE id = NEW.event_id;

  RETURN NEW;
END;
$$;

-- Drop old AFTER trigger, create new BEFORE trigger
DROP TRIGGER IF EXISTS trg_decrement_kupon_capacity ON public.kupon_claims;
CREATE TRIGGER trg_decrement_kupon_capacity
  BEFORE INSERT ON public.kupon_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_kupon_capacity();
