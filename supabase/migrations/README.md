# Supabase Migrations

Migrations are numbered `YYYYMMDDHHmmss_description.sql` and must be applied in order.

## Applying Migrations

### Option A — Supabase CLI (recommended)
```bash
npx supabase db push
```

### Option B — Manual (Supabase Dashboard → SQL Editor)
Run each file in ascending order.

## Migration Log

| File | Description | Status |
|------|-------------|--------|
| 20260224000001_initial_schema.sql | Seed from schema.sql — reference only | Applied |
| 20260224000002_add_donations_columns.sql | donor_name, status, payment_gateway, etc. | **Run me** |
| 20260224000003_add_volunteer_gigs_columns.sql | gig_date, start_time, end_time | **Run me** |
| 20260224000004_create_profiles_table.sql | Public user profiles with RLS | **Run me** |
| 20260224000005_add_indexes.sql | Performance indexes on hot columns | **Run me** |
| 20260224000006_fix_kupon_capacity_trigger.sql | BEFORE INSERT — abort if 0 remaining | **Run me** |
| 20260224000007_fix_scan_kupon_v2.sql | Replaces scan_kupon — no LIKE attack | **Run me** |
| 20260224000008_fix_security_rpcs.sql | admin guard + increment_campaign_amount | **Run me** |
