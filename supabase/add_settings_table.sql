CREATE TABLE IF NOT EXISTS public.system_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  system_name text NOT NULL DEFAULT 'Makmur',
  system_desc text NOT NULL DEFAULT 'Mosque OS',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_system_settings" ON public.system_settings;
CREATE POLICY "admin_full_system_settings"
  ON public.system_settings
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "guest_read_system_settings" ON public.system_settings;
CREATE POLICY "guest_read_system_settings"
  ON public.system_settings
  FOR SELECT
  USING (true);

INSERT INTO public.system_settings (id, system_name, system_desc)
VALUES (1, 'Makmur', 'Mosque OS')
ON CONFLICT (id) DO NOTHING;

-- Enable realtime to update frontend instantly if needed
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
