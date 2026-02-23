-- ─────────────────────────────────────────────────────────────
--  Add overlay_opacity to screen_slides
--  Allows per-slide custom dark overlay (0–80%)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.screen_slides
ADD COLUMN IF NOT EXISTS overlay_opacity int NOT NULL DEFAULT 0
  CHECK (overlay_opacity >= 0 AND overlay_opacity <= 80);
