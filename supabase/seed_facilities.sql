-- Seed data for Facilities
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/jtzogceyyycixxonfann/sql/new
-- safe to re-run (uses ON CONFLICT DO NOTHING with fixed UUIDs)

INSERT INTO public.facilities (id, name, description, location, capacity, image_url, is_active)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'Dewan Serbaguna',
    'Ruang besar yang sesuai untuk majlis, ceramah, dan program komuniti. Dilengkapi sistem bunyi dan projektor.',
    'Tingkat Bawah, Bangunan Utama',
    200,
    NULL,
    true
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'Bilik Kuliah Al-Hikmah',
    'Bilik kuliah ber-AC untuk kelas agama, bengkel, dan perjumpaan kecil. Dilengkapi papan putih dan projektor berkadar.',
    'Tingkat 1, Bangunan Utama',
    40,
    NULL,
    true
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'Ruang Mesyuarat Ikhwan',
    'Bilik mesyuarat untuk AJK dan perbincangan rasmi. Meja bulat, kapasiti 12 orang.',
    'Tingkat 2, Bangunan Utama',
    12,
    NULL,
    true
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'Kawasan Laman Masjid',
    'Kawasan luar yang luas untuk bazar, program keluarga, dan acara komuniti.',
    'Perkarangan Masjid',
    500,
    NULL,
    true
  ),
  (
    'a1000000-0000-0000-0000-000000000005',
    'Bilik Tayangan',
    'Mini-dewan untuk pemutaran video, ceramah interaktif, dan taklimat. Kerusi teater 30 orang.',
    'Tingkat 1, Sayap Selatan',
    30,
    NULL,
    true
  ),
  (
    'a1000000-0000-0000-0000-000000000006',
    'Ruang Solat Wanita',
    'Ruang tambahan untuk solat jemaah khas wanita dan kelas Quran ibu-ibu.',
    'Tingkat 1, Sayap Utara',
    80,
    NULL,
    true
  )
ON CONFLICT (id) DO NOTHING;
