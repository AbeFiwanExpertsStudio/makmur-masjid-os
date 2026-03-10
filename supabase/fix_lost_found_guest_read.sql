-- ============================================================
-- Fix: Allow guests (anonymous users) to view Lost & Found items
-- The SELECT policy currently restricts to 'authenticated' only.
-- This changes it to allow everyone (including anon/guest) to read.
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

-- Drop the old policy that only allows authenticated users
DROP POLICY IF EXISTS "anyone_read_lost_found" ON public.lost_found_items;

-- Create new policy that allows everyone (anon + authenticated) to read
CREATE POLICY "anyone_read_lost_found"
  ON public.lost_found_items FOR SELECT
  USING (true);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
