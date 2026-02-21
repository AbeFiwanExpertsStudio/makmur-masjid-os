-- ============================================================
-- Project Makmur — Database Seed Script
-- Realistic Malaysian Ramadan Dummy Data
-- ============================================================

-- ------------------------------------------------------------
-- 0. SEED AUTH USERS (Admin + Volunteer for demo login)
-- ------------------------------------------------------------
-- NOTE: In production, create users via Supabase Dashboard or Auth API.
-- This direct-insert approach is for hackathon/demo purposes only.

-- Ensure pgcrypto is enabled for crypt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_admin_id uuid := '550e8400-e29b-41d4-a716-446655440000';
    v_volunteer_id uuid := '660e8400-e29b-41d4-a716-446655440001';
BEGIN
    -- Create/Update admin user
    INSERT INTO auth.users (
        id, instance_id, email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data, raw_app_meta_data,
        aud, role, created_at, updated_at,
        is_anonymous
    ) VALUES (
        v_admin_id,
        '00000000-0000-0000-0000-000000000000',
        'admin@makmur.os',
        crypt('makmur123', gen_salt('bf')),
        NOW(),
        '{"full_name": "Ahmad (AJK)"}',
        '{"provider": "email", "providers": ["email"]}',
        'authenticated', 'authenticated', NOW(), NOW(),
        false
    ) 
    ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        updated_at = NOW();

    -- Create/Update admin identity
    INSERT INTO auth.identities (
        id, user_id, provider_id, provider,
        identity_data, last_sign_in_at,
        created_at, updated_at
    ) VALUES (
        v_admin_id, v_admin_id, 'admin@makmur.os', 'email',
        jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@makmur.os', 'email_verified', true, 'full_name', 'Ahmad (AJK)'),
        NOW(), NOW(), NOW()
    ) 
    ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = NOW();

    -- Create/Update volunteer user
    INSERT INTO auth.users (
        id, instance_id, email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data, raw_app_meta_data,
        aud, role, created_at, updated_at,
        is_anonymous
    ) VALUES (
        v_volunteer_id,
        '00000000-0000-0000-0000-000000000000',
        'volunteer@makmur.os',
        crypt('makmur123', gen_salt('bf')),
        NOW(),
        '{"full_name": "Siti (Volunteer)"}',
        '{"provider": "email", "providers": ["email"]}',
        'authenticated', 'authenticated', NOW(), NOW(),
        false
    ) 
    ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        updated_at = NOW();

    -- Create/Update volunteer identity
    INSERT INTO auth.identities (
        id, user_id, provider_id, provider,
        identity_data, last_sign_in_at,
        created_at, updated_at
    ) VALUES (
        v_volunteer_id, v_volunteer_id, 'volunteer@makmur.os', 'email',
        jsonb_build_object('sub', v_volunteer_id::text, 'email', 'volunteer@makmur.os', 'email_verified', true, 'full_name', 'Siti (Volunteer)'),
        NOW(), NOW(), NOW()
    ) 
    ON CONFLICT (provider_id, provider) DO UPDATE SET
        identity_data = EXCLUDED.identity_data,
        updated_at = NOW();

    -- Assign roles
    INSERT INTO public.user_roles (user_id, role) VALUES
        (v_admin_id, 'admin'),
        (v_volunteer_id, 'volunteer')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

    -- Now insert the gigs using the valid admin ID
    INSERT INTO public.volunteer_gigs (id, title, description, required_pax, created_by) VALUES
    ('a1111111-1111-4111-a111-111111111111', 'Kacau Bubur Lambuk', 'Join the team to stir and pack the traditional Bubur Lambuk for the community.', 15, v_admin_id),
    ('a2222222-2222-4222-a222-222222222222', 'Tarawih Traffic Control', 'Assist in managing car flow and parking to ensure smooth Tarawih prayer arrival.', 10, v_admin_id),
    ('a3333333-3333-4333-a333-333333333333', 'Susun Sejadah & Saf', 'Help prepare the main prayer hall by arranging prayer mats and aligning saf lines.', 5, v_admin_id),
    ('a4444444-4444-4444-a444-444444444444', 'Clean Up Kitchen', 'Helping the kitchen team clean up after Iftar preparation.', 8, v_admin_id)
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        required_pax = EXCLUDED.required_pax;

END $$;

-- ------------------------------------------------------------
-- 1. GIG CLAIMS (using the volunteer user ID)
-- ------------------------------------------------------------
INSERT INTO public.gig_claims (id, gig_id, guest_uuid, claimed_at) VALUES
(gen_random_uuid(), 'a1111111-1111-4111-a111-111111111111', '660e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '4 hours'),
(gen_random_uuid(), 'a2222222-2222-4222-a222-222222222222', '660e8400-e29b-41d4-a716-446655440001', NOW() - INTERVAL '2 hours')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 2. CROWDFUND CAMPAIGNS
-- ------------------------------------------------------------
INSERT INTO public.crowdfund_campaigns (id, title, description, target_amount, current_amount) VALUES
('c1111111-1111-4111-c111-111111111111', 'Tabung Iftar Asnaf', 'Providing free Iftar meals for the underprivileged families in the neighborhood.', 15000.00, 8450.00),
('c2222222-2222-4222-c222-222222222222', 'Repair Aircond Dewan Solat', 'Fundraiser to fix and service the main prayer hall air conditioning system.', 5000.00, 1200.00),
('c3333333-3333-4333-c333-333333333333', 'Sadaqah Jariyah Anak Yatim', 'Education fund and Eid clothes for orphans supported by the mosque.', 10000.00, 4500.00)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    target_amount = EXCLUDED.target_amount;

-- ------------------------------------------------------------
-- 3. DONATIONS
-- ------------------------------------------------------------
INSERT INTO public.donations (id, campaign_id, amount, stripe_session_id, created_at) VALUES
(gen_random_uuid(), 'c1111111-1111-4111-c111-111111111111', 100.00, 'cs_test_a1', NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'c1111111-1111-4111-c111-111111111111', 50.00, 'cs_test_a2', NOW() - INTERVAL '12 hours'),
(gen_random_uuid(), 'c2222222-2222-4222-c222-222222222222', 200.00, 'cs_test_b1', NOW() - INTERVAL '2 days'),
(gen_random_uuid(), 'c3333333-3333-4333-c333-333333333333', 150.00, 'cs_test_c1', NOW() - INTERVAL '5 hours')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 4. FOOD EVENTS
-- ------------------------------------------------------------
INSERT INTO public.food_events (id, name, total_capacity, remaining_capacity, event_date, start_time, end_time) VALUES
('e1111111-1111-4111-e111-111111111111', 'Bubur Lambuk Daging (Active Now)', 500, 450, CURRENT_DATE, (CURRENT_TIME - INTERVAL '1 hour')::time, (CURRENT_TIME + INTERVAL '2 hours')::time),
('e2222222-2222-4222-e222-222222222222', 'Iftar Perdana Nasi Tomato (Scheduled)', 300, 120, CURRENT_DATE, (CURRENT_TIME + INTERVAL '2 hours')::time, (CURRENT_TIME + INTERVAL '5 hours')::time),
('e3333333-3333-4333-e333-333333333333', 'Sahur Pack (Tomorrow)', 200, 200, CURRENT_DATE + INTERVAL '1 day', '03:00:00', '05:00:00'),
('e4444444-4444-4444-e444-444444444444', 'Nasi Lemak Pagi (Expired)', 200, 10, CURRENT_DATE, (CURRENT_TIME - INTERVAL '5 hours')::time, (CURRENT_TIME - INTERVAL '3 hours')::time)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    total_capacity = EXCLUDED.total_capacity;

-- ------------------------------------------------------------
-- 5. KUPON CLAIMS
-- ------------------------------------------------------------
INSERT INTO public.kupon_claims (id, event_id, guest_uuid, is_scanned, claimed_at) VALUES
(gen_random_uuid(), 'e1111111-1111-4111-e111-111111111111', '660e8400-e29b-41d4-a716-446655440001', false, NOW() - INTERVAL '1 hour'),
(gen_random_uuid(), 'e2222222-2222-4222-e222-222222222222', '660e8400-e29b-41d4-a716-446655440001', true, NOW() - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 6. ZAKAT COUNTERS
-- ------------------------------------------------------------
INSERT INTO public.zakat_counters (id, name, latitude, longitude, address, hours, start_date, end_date, start_time, end_time, is_active, expires_at) VALUES
(gen_random_uuid(), 'Masjid Al-Makmur Main Counter (2 Days)', 3.1390, 101.6869, '123 Jalan Ampang, Kuala Lumpur', '48 Hours Continuous', CURRENT_DATE, CURRENT_DATE + INTERVAL '1 day', '00:00:00', '23:59:00', true, NOW() + INTERVAL '30 days'),
(gen_random_uuid(), 'Taman Jaya Mobile Booth (Active Now)', 3.1065, 101.6444, 'Taman Jaya LRT Station', 'Current Time block', CURRENT_DATE, CURRENT_DATE, (CURRENT_TIME - INTERVAL '1 hour')::time, (CURRENT_TIME + INTERVAL '2 hours')::time, true, NOW() + INTERVAL '10 days'),
(gen_random_uuid(), 'Kampung Baru Drive-Thru (Scheduled Today)', 3.1616, 101.7042, 'Jalan Raja Muda Musa', 'Future block today', CURRENT_DATE, CURRENT_DATE, (CURRENT_TIME + INTERVAL '2 hours')::time, (CURRENT_TIME + INTERVAL '5 hours')::time, true, NOW() + INTERVAL '15 days'),
(gen_random_uuid(), 'Mall Booth KLCC (Expired)', 3.1579, 101.7123, 'Level 1, Suria KLCC', 'Past block', CURRENT_DATE - INTERVAL '2 days', CURRENT_DATE - INTERVAL '1 day', '10:00:00', '22:00:00', true, NOW() - INTERVAL '4 days'),
(gen_random_uuid(), 'Dataran Merdeka Ramadhan Tent (Future)', 3.1476, 101.6938, 'Dataran Merdeka', 'Special Ramadhan 2026', '2026-02-23', '2026-02-23', '15:00:00', '19:00:00', true, NOW() + INTERVAL '20 days')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 7. SYSTEM BROADCASTS
-- ------------------------------------------------------------
INSERT INTO public.system_broadcasts (id, message, is_active, created_at) VALUES
(gen_random_uuid(), 'Reminder: Tarawih tonight will be led by Sheikh Al-Afasy starting 8:45 PM.', false, NOW() - INTERVAL '1 day'),
(gen_random_uuid(), 'Food Distribution: Bubur Lambuk collection starts at 5:00 PM at Gate B.', true, NOW() - INTERVAL '2 hours')
ON CONFLICT DO NOTHING;
