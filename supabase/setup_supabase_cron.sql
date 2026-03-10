-- ============================================================
-- Supabase Free Azan Cron Job (Alternative to Vercel Cron)
-- ============================================================
-- This script enables per-minute scheduling for azan push 
-- notifications on a Supabase FREE tier project.
-- Run this in your Supabase SQL Editor.

-- 1. Enable needed extensions
create extension if not exists pg_cron;
create extension if not exists http;

-- 2. Schedule the azan check (runs every minute)
-- Replace [YOUR_APP_URL] with your real URL (e.g. https://makmur-masjid.vercel.app)
-- Replace [YOUR_CRON_SECRET] with the value of CRON_SECRET from your .env.local
select cron.schedule(
  'azan-push-cron',
  '* * * * *',
  $$
  select
    status,
    content::json
  from
    http((
      'GET',
      'https://makmur-my.vercel.app/api/cron/azan',
      null,
      null,
      null
    )::http_request)
  $$
);

-- TO CHECK IF IT IS RUNNING:
-- select * from cron.job_run_details order by start_time desc limit 10;

-- TO REMOVE THE CRON:
-- select cron.unschedule('azan-push-cron');
