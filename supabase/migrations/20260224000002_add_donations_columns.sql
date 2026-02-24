-- ============================================================
-- Migration: Add missing columns to donations table
-- The original schema only had: id, campaign_id, amount,
-- stripe_session_id, created_at.
-- The ToyyibPay webhook and checkout routes expect these extras.
-- ============================================================

-- Donor identity
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS donor_name     text,
  ADD COLUMN IF NOT EXISTS donor_email    text,
  ADD COLUMN IF NOT EXISTS donor_phone    text;

-- Payment lifecycle
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS payment_gateway text,          -- 'toyyibpay' | 'stripe' etc.
  ADD COLUMN IF NOT EXISTS payment_intent_id text,        -- ToyyibPay billCode / Stripe session id
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz;

-- Back-fill updated_at for existing rows
UPDATE public.donations SET updated_at = created_at WHERE updated_at IS NULL;

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_donations_updated_at ON public.donations;
CREATE TRIGGER trg_donations_updated_at
  BEFORE UPDATE ON public.donations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Index for fast webhook idempotency look-ups
CREATE INDEX IF NOT EXISTS idx_donations_payment_intent
  ON public.donations (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- Allow service-role inserts (webhook) for status writes
-- (the webhook uses supabaseAdmin which bypasses RLS anyway, but good hygiene)
DROP POLICY IF EXISTS "service_insert_donations" ON public.donations;
CREATE POLICY "service_insert_donations"
  ON public.donations
  FOR INSERT
  WITH CHECK (true);
