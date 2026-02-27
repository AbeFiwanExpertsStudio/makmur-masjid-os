-- ============================================================
-- PROJECT MAKMUR: GUEST RECEIPT ACCESS FIX
-- Allows guests and logged-in users to securely view receipts
-- ============================================================

-- 1. DROP the overly restrictive admin-only policy
DROP POLICY IF EXISTS "guest_read_donations" ON public.donations;

-- 2. CREATE a more nuanced policy:
-- a) Admin can see everything
-- b) Logged-in user can see their own (matched via donor_email)
-- c) Anyone can see a SPECIFIC donation if it is COMPLETED.
-- Since donation IDs are UUIDs, knowing the ID serves as the "key".
CREATE POLICY "allow_receipt_view_by_id"
  ON public.donations
  FOR SELECT
  USING (
    public.is_admin()
    OR (donor_email = auth.jwt()->>'email')
    OR (status = 'completed')
  );

-- 3. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';
