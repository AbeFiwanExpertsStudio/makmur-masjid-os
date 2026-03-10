-- ============================================================
-- Add dedup column for Azan Cron Job
-- Stores the last fired azan notification key (e.g. "2026-03-11:maghrib")
-- to prevent duplicate push notifications.
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS last_azan_cron TEXT DEFAULT '';
