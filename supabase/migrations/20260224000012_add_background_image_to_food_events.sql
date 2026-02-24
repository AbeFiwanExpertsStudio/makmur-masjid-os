-- Add optional background image URL to food_events
-- Allows admins to set a custom card background (URL or path)

ALTER TABLE public.food_events
  ADD COLUMN IF NOT EXISTS background_image text;
