-- Storage bucket for Lost & Found item photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lost-found', 'lost-found', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (anyone can view images)
DROP POLICY IF EXISTS "Public Read lost-found" ON storage.objects;
CREATE POLICY "Public Read lost-found"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lost-found');

-- Authenticated users can upload
DROP POLICY IF EXISTS "Auth Insert lost-found" ON storage.objects;
CREATE POLICY "Auth Insert lost-found"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lost-found');

-- Users can delete their own uploads, admins can delete any
DROP POLICY IF EXISTS "Auth Delete lost-found" ON storage.objects;
CREATE POLICY "Auth Delete lost-found"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lost-found' AND (owner = auth.uid() OR public.is_admin()));
