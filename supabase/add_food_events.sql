-- =====================================================================
-- Project Makmur — Add Food Events (E-Kupon)
-- =====================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- This inserts 2 real food events into food_events table
-- using the SAME UUIDs as the fallback data in the frontend code.
-- This way, even if the app shows fallback data, claims still work!
-- =====================================================================

-- Insert food events using the same UUIDs as the frontend fallback data
INSERT INTO public.food_events (id, name, total_capacity, remaining_capacity, event_date, start_time, end_time)
VALUES
  (
    '11111111-1111-4111-a111-111111111111',
    'Bubur Lambuk Daging',
    500,
    500,
    CURRENT_DATE,       -- today's date
    '17:00:00',
    '19:00:00'
  ),
  (
    '22222222-2222-4222-a222-222222222222',
    'Iftar Perdana Nasi Tomato',
    300,
    300,
    CURRENT_DATE,       -- today's date
    '18:00:00',
    '20:00:00'
  )
ON CONFLICT (id) DO UPDATE
  SET
    event_date         = EXCLUDED.event_date,
    remaining_capacity = EXCLUDED.remaining_capacity,
    name               = EXCLUDED.name;

-- Verify the rows were inserted
SELECT id, name, total_capacity, remaining_capacity, event_date, start_time, end_time
FROM public.food_events
ORDER BY event_date;
