-- ============================================================
-- Drop the original scan_kupon(uuid) overload so only the
-- scan_kupon(text) v2 version remains, eliminating the
-- "Could not choose the best candidate function" ambiguity.
-- ============================================================

DROP FUNCTION IF EXISTS public.scan_kupon(uuid);
