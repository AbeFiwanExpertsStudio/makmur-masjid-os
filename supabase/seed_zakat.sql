-- =====================================================================
-- Project Makmur — Seed Zakat Counters into Supabase
-- =====================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- =====================================================================

INSERT INTO public.zakat_counters (name, address, latitude, longitude, is_active, start_time, end_time)
VALUES 
  ('Main Entrance (Gate A)', 'Masjid Al-Makmur Main Gate', 3.1612, 101.6934, true, '09:00:00', '22:00:00'),
  ('Dewan Solat Utama', 'Inside Main Prayer Hall area', 3.1614, 101.6936, true, '12:00:00', '23:00:00'),
  ('Pejabat Pentadbiran', 'Masjid Al-Makmur Management Office', 3.1610, 101.6932, true, '08:00:00', '17:00:00');

-- Verify
SELECT * FROM public.zakat_counters;
