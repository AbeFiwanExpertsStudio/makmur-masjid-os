-- =====================================================================
-- Project Makmur — Fix: Allow Any Logged-In User to Cancel Gig Claims
-- =====================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- The old fix used a JWT 'is_anonymous' check that was too restrictive
-- and silently blocked regular users from deleting. This fix uses the
-- simple and reliable: auth.uid() = guest_uuid.
-- =====================================================================

-- Fix INSERT policy (remove unreliable is_anonymous JWT check)
DROP POLICY IF EXISTS "registered_insert_gig_claims" ON public.gig_claims;
DROP POLICY IF EXISTS "guest_insert_gig_claims" ON public.gig_claims;
CREATE POLICY "registered_insert_gig_claims"
  ON public.gig_claims
  FOR INSERT
  WITH CHECK (
    auth.uid() = guest_uuid
    AND auth.uid() IS NOT NULL
  );

-- Fix DELETE policy: any logged-in user can delete their OWN claim row
DROP POLICY IF EXISTS "registered_delete_own_gig_claims" ON public.gig_claims;
CREATE POLICY "registered_delete_own_gig_claims"
  ON public.gig_claims
  FOR DELETE
  USING (
    auth.uid() = guest_uuid
    AND auth.uid() IS NOT NULL
  );

-- Verify: should now show 4 policies on gig_claims
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'gig_claims'
ORDER BY cmd;
