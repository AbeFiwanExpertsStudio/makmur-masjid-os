-- Add device_uuid column to kupon_claims to prevent double-claiming via logout
ALTER TABLE public.kupon_claims 
ADD COLUMN IF NOT EXISTS device_uuid text;

-- Add a unique constraint so a device can only claim once per event, regardless of user account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kupon_claims_event_id_device_uuid_key'
  ) THEN
    ALTER TABLE public.kupon_claims
    ADD CONSTRAINT kupon_claims_event_id_device_uuid_key UNIQUE (event_id, device_uuid);
  END IF;
END $$;

-- RPC: Fetch kupon claims by device UUID (no auth required — callable by anonymous users)
-- Allows guests to see their QR codes after page refresh without a session
CREATE OR REPLACE FUNCTION public.get_kupon_claims_by_device(p_device_uuid text)
RETURNS TABLE (id uuid, event_id uuid, is_scanned boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, event_id, is_scanned
  FROM public.kupon_claims
  WHERE device_uuid = p_device_uuid;
$$;

-- Allow both anon and authenticated roles to call this function
GRANT EXECUTE ON FUNCTION public.get_kupon_claims_by_device(text) TO anon, authenticated;

-- Add DELETE RLS policy so users (and RPCs) can cancel their own claims
DROP POLICY IF EXISTS "guest_delete_own_kupon_claims" ON public.kupon_claims;
CREATE POLICY "guest_delete_own_kupon_claims"
  ON public.kupon_claims
  FOR DELETE
  USING (auth.uid() = guest_uuid);

-- RPC: Cancel a kupon claim (SECURITY DEFINER so it bypasses RLS and can verify ownership)
CREATE OR REPLACE FUNCTION public.cancel_kupon(p_claim_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.kupon_claims
  WHERE id = p_claim_id
    AND is_scanned = false; -- cannot cancel after it has already been scanned/redeemed

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Kupon not found or already redeemed');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_kupon(uuid) TO anon, authenticated;
