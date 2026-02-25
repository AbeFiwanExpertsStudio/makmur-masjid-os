-- 20260226000000_trusted_identity_kupon.sql
-- Implements "Trusted Identity" logic for Kupon Claims

-- 1. Drop the strict unique constraint that blocks all secondary claims on a device
ALTER TABLE public.kupon_claims 
DROP CONSTRAINT IF EXISTS kupon_claims_event_id_device_uuid_key;

-- 2. Make sure we have the standard user-level unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kupon_claims_event_id_guest_uuid_key'
  ) THEN
    ALTER TABLE public.kupon_claims
    ADD CONSTRAINT kupon_claims_event_id_guest_uuid_key UNIQUE (event_id, guest_uuid);
  END IF;
END $$;

-- 3. Create a smart trigger to enforce strict device limits ONLY for guests (anonymous users)
CREATE OR REPLACE FUNCTION public.check_kupon_claim_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_anonymous boolean;
  v_device_has_claims int;
BEGIN
  -- Check if guest_uuid belongs to an auth.users record that is anonymous.
  -- This relies on the frontend passing the auth.uid() as guest_uuid for all users
  -- (which it does via signInAnonymously() for guests, or their real UUID for registered users)
  SELECT is_anonymous INTO v_is_anonymous
  FROM auth.users
  WHERE id = NEW.guest_uuid
  LIMIT 1;

  -- If no matching users record is found, assume it is an anonymous/legacy guest
  IF v_is_anonymous IS NULL THEN
     v_is_anonymous := true;
  END IF;

  -- -----------------------------------------------------------------------------------
  -- RULE 1: Guests (anonymous users) are subject to strict device limits.
  -- -----------------------------------------------------------------------------------
  IF v_is_anonymous = true THEN
    -- A guest can only claim if this EXACT device has NEVER claimed for this event.
    -- (This prevents a registered user from logging out and claiming an extra guest meal on the same phone)
    -- Wait, if we want to ensure max 1 *guest* claim per device, count records where THAT device claimed AS A GUEST?
    -- No, the simplest robust rule: 
    -- "This phone can claim 1 guest meal, OR any number of registered meals, BUT if it has ANY claim, it cannot claim as a guest anymore to prevent logging out abuse."
    -- So we just count ANY claims by this device_uuid for this event.
    
    SELECT count(*) INTO v_device_has_claims
    FROM public.kupon_claims
    WHERE event_id = NEW.event_id
      AND device_uuid = NEW.device_uuid;
      
    IF v_device_has_claims > 0 THEN
      RAISE EXCEPTION 'A kupon for this event has already been claimed on this device.' USING ERRCODE = '23505';
    END IF;
  END IF;

  -- -----------------------------------------------------------------------------------
  -- RULE 2: Registered users (v_is_anonymous = false) bypass the device check.
  -- -----------------------------------------------------------------------------------
  -- They rely ONLY on the unique constraint (event_id, guest_uuid) which prevents double-claiming per account.
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_kupon_claim_rules ON public.kupon_claims;
CREATE TRIGGER enforce_kupon_claim_rules
  BEFORE INSERT ON public.kupon_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.check_kupon_claim_rules();
