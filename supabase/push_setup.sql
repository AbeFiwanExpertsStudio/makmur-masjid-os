-- ============================================================
-- PROJECT MAKMUR: PUSH NOTIFICATION SETUP
-- Adds fcm_tokens column to track user devices
-- ============================================================

-- 1. Add the column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS fcm_tokens text[] DEFAULT '{}';

-- 2. Ensure users can update their own tokens
DROP POLICY IF EXISTS "Users can update their own fcm_tokens" ON public.profiles;
CREATE POLICY "Users can update their own fcm_tokens"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 3. Reload schema
NOTIFY pgrst, 'reload schema';
