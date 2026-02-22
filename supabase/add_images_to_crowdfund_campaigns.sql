ALTER TABLE public.crowdfund_campaigns ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
