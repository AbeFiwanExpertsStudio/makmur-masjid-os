-- Insert new bucket for Campaigns
INSERT INTO storage.buckets (id, name, public) VALUES ('campaigns', 'campaigns', true) ON CONFLICT (id) DO NOTHING;

-- Remove any existing policies for campaigns
DROP POLICY IF EXISTS "Public Read Access for Campaigns" ON storage.objects;
DROP POLICY IF EXISTS "Admin Insert Access for Campaigns" ON storage.objects;

-- Create policy to allow public read access
CREATE POLICY "Public Read Access for Campaigns"
ON storage.objects FOR SELECT
USING ( bucket_id = 'campaigns' );

-- Create policy to allow authenticated admins to upload images
CREATE POLICY "Admin Insert Access for Campaigns"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campaigns' AND public.is_admin()
);
