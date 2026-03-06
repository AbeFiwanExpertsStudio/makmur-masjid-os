-- 1. Add tracking columns for reminders
ALTER TABLE public.gig_claims 
ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.volunteer_gigs 
ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '[]'::jsonb;

-- 2. Function to send gig reminders
CREATE OR REPLACE FUNCTION public.send_gig_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
  v_interval INT;
  v_msg_participant TEXT;
  v_msg_broadcast TEXT;
  v_needed INT;
BEGIN
  -- Intervals we care about: 24, 12, and 6 hours
  FOR v_interval IN SELECT UNNEST(ARRAY[24, 12, 6]) LOOP
    
    -- ── A: PARTICIPANT REMINDERS ──
    -- Find claims for gigs starting in [v_interval, v_interval-1] hours that haven't received THIS reminder yet
    FOR v_rec IN 
      SELECT g.id, g.title, c.id as claim_id, c.guest_uuid, c.reminders_sent as claim_reminders
      FROM public.volunteer_gigs g
      JOIN public.gig_claims c ON c.gig_id = g.id
      WHERE g.is_completed = false 
        AND g.is_cancelled = false
        AND (g.gig_date::timestamp + g.start_time) <= (NOW() + (v_interval || ' hours')::interval)
        AND (g.gig_date::timestamp + g.start_time) > (NOW() + ((v_interval - 1) || ' hours')::interval)
        AND NOT (c.reminders_sent @> (v_interval::text)::jsonb)
    LOOP
      v_msg_participant := 'Reminder: Your volunteer gig "' || v_rec.title || '" starts in ' || v_interval || ' hours! See you there.';
      
      -- Insert in-app notification for participant
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (
        v_rec.guest_uuid, 
        'gig_reminder', 
        jsonb_build_object(
          'gig_id', v_rec.id,
          'gig_title', v_rec.title,
          'hours_remaining', v_interval,
          'message', v_msg_participant
        )
      );

      -- Mark as sent
      UPDATE public.gig_claims 
      SET reminders_sent = reminders_sent || (v_interval::text)::jsonb
      WHERE id = v_rec.claim_id;
    END LOOP;

    -- ── B: LOW-ATTENDANCE BROADCASTS ──
    -- Find gigs that aren't full yet for the same intervals
    FOR v_rec IN 
      SELECT g.*, (SELECT count(*) FROM public.gig_claims WHERE gig_id = g.id) as current_pax
      FROM public.volunteer_gigs g
      WHERE g.is_completed = false 
        AND g.is_cancelled = false
        AND (g.gig_date::timestamp + g.start_time) <= (NOW() + (v_interval || ' hours')::interval)
        AND (g.gig_date::timestamp + g.start_time) > (NOW() + ((v_interval - 1) || ' hours')::interval)
        AND NOT (g.reminders_sent @> (v_interval::text)::jsonb)
    LOOP
      v_needed := v_rec.required_pax - v_rec.current_pax;
      
      IF v_needed > 0 THEN
        v_msg_broadcast := 'Wait! We still need ' || v_needed || ' more volunteers for "' || v_rec.title || '" starting in ' || v_interval || ' hours. Can you help?';
        
        -- Insert global broadcast
        INSERT INTO public.system_broadcasts (message)
        VALUES (v_msg_broadcast);
      END IF;

      -- Mark as sent (even if not needed, so we don't re-check this interval)
      UPDATE public.volunteer_gigs 
      SET reminders_sent = reminders_sent || (v_interval::text)::jsonb
      WHERE id = v_rec.id;
    END LOOP;

  END LOOP;
END;
$$;

-- 3. Schedule the function to run every hour
-- Note: Requires pg_cron to be active in your Supabase instance.
SELECT cron.schedule('send_gig_reminders_hourly', '0 * * * *', 'SELECT public.send_gig_reminders();');
