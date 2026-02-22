-- =====================================================================
-- Project Makmur — Seed Crowdfunding Campaigns into Supabase
-- =====================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- =====================================================================

INSERT INTO public.crowdfund_campaigns (title, description, target_amount, current_amount)
VALUES 
  ('Tabung Iftar Asnaf', 'Providing free Iftar meals for the underprivileged families.', 15000, 8450),
  ('Repair Aircond Dewan Solat', 'Service and fix the main prayer hall air conditioning system.', 5000, 1200),
  ('Sadaqah Jariyah Anak Yatim', 'Education fund and Eid clothes for orphans.', 10000, 4500);

-- Verify
SELECT * FROM public.crowdfund_campaigns;
