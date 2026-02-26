-- Storage bucket for user profile avatars
-- Run in Supabase SQL Editor

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Public Read avatars" ON storage.objects;
CREATE POLICY "Public Read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar (path starts with their user id)
DROP POLICY IF EXISTS "Auth Insert avatars" ON storage.objects;
CREATE POLICY "Auth Insert avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update (upsert) their own avatar
DROP POLICY IF EXISTS "Auth Update avatars" ON storage.objects;
CREATE POLICY "Auth Update avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
DROP POLICY IF EXISTS "Auth Delete avatars" ON storage.objects;
CREATE POLICY "Auth Delete avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
