-- ─────────────────────────────────────────────────────────────
--  Mosque Screen Display System
--  1. screen_config JSONB column on system_settings
--  2. screen_slides table
--  3. Storage buckets: screen-slides, screen-assets
-- ─────────────────────────────────────────────────────────────

-- 1. Add screen_config to system_settings
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS screen_config jsonb NOT NULL DEFAULT jsonb_build_object(
  'gambar_masjid', jsonb_build_object('enabled', true, 'url', ''),
  'alert_masuk',   jsonb_build_object('enabled', true),
  'alert_iqamat',  jsonb_build_object('enabled', true, 'delay_minutes', 10),
  'slideshow',     jsonb_build_object('enabled', true, 'interval_seconds', 8),
  'panel_waktu',   jsonb_build_object('enabled', true),
  'bunyi_azan',    jsonb_build_object('enabled', true),
  'zone',          'WLY01'
);

-- Back-fill existing row
UPDATE public.system_settings SET screen_config = jsonb_build_object(
  'gambar_masjid', jsonb_build_object('enabled', true, 'url', ''),
  'alert_masuk',   jsonb_build_object('enabled', true),
  'alert_iqamat',  jsonb_build_object('enabled', true, 'delay_minutes', 10),
  'slideshow',     jsonb_build_object('enabled', true, 'interval_seconds', 8),
  'panel_waktu',   jsonb_build_object('enabled', true),
  'bunyi_azan',    jsonb_build_object('enabled', true),
  'zone',          'WLY01'
) WHERE id = 1 AND screen_config = '{}'::jsonb;

-- 2. Slides table
CREATE TABLE IF NOT EXISTS public.screen_slides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text        NOT NULL,
  caption     text        NOT NULL DEFAULT '',
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.screen_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_slides" ON public.screen_slides;
CREATE POLICY "admin_manage_slides"
  ON public.screen_slides FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "public_read_slides" ON public.screen_slides;
CREATE POLICY "public_read_slides"
  ON public.screen_slides FOR SELECT
  USING (true);

-- Enable realtime for slides
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.screen_slides;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('screen-slides', 'screen-slides', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('screen-assets', 'screen-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "admin_upload_screen_slides" ON storage.objects;
CREATE POLICY "admin_upload_screen_slides" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'screen-slides' AND public.is_admin());

DROP POLICY IF EXISTS "public_read_screen_slides" ON storage.objects;
CREATE POLICY "public_read_screen_slides" ON storage.objects
  FOR SELECT USING (bucket_id = 'screen-slides');

DROP POLICY IF EXISTS "admin_delete_screen_slides" ON storage.objects;
CREATE POLICY "admin_delete_screen_slides" ON storage.objects
  FOR DELETE USING (bucket_id = 'screen-slides' AND public.is_admin());

DROP POLICY IF EXISTS "admin_upload_screen_assets" ON storage.objects;
CREATE POLICY "admin_upload_screen_assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'screen-assets' AND public.is_admin());

DROP POLICY IF EXISTS "public_read_screen_assets" ON storage.objects;
CREATE POLICY "public_read_screen_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'screen-assets');

DROP POLICY IF EXISTS "admin_delete_screen_assets" ON storage.objects;
CREATE POLICY "admin_delete_screen_assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'screen-assets' AND public.is_admin());
