/**
 * src/types/database.ts
 * TypeScript interfaces mirroring every public Supabase table.
 * Keep in sync with supabase/migrations/*.sql.
 */

// ── user_roles ─────────────────────────────────────────────
export interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "volunteer";
  is_banned?: boolean;
  created_at: string;
}

// ── profiles ───────────────────────────────────────────────
export interface Profile {
  id: string;           // matches auth.users.id
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── crowdfund_campaigns ────────────────────────────────────
export interface CrowdfundCampaign {
  id: string;
  title: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  images: string[];
  created_at: string;
}

// ── donations ──────────────────────────────────────────────
export type DonationStatus = "pending" | "completed" | "failed" | "cancelled";

export interface Donation {
  id: string;
  campaign_id: string;
  amount: number;
  donor_name: string | null;
  donor_email: string | null;
  donor_phone: string | null;
  status: DonationStatus;
  payment_gateway: string | null;   // 'toyyibpay' | 'stripe'
  payment_intent_id: string | null; // billCode from ToyyibPay / session from Stripe
  stripe_session_id: string | null; // legacy — prefer payment_intent_id
  created_at: string;
  updated_at: string | null;
}

// ── food_events ────────────────────────────────────────────
export interface FoodEvent {
  id: string;
  name: string;
  total_capacity: number;
  remaining_capacity: number;
  event_date: string;   // ISO date "YYYY-MM-DD"
  start_time: string;   // "HH:MM:SS"
  end_time: string;     // "HH:MM:SS"
  location: string | null;
  created_at: string;
}

// ── kupon_claims ───────────────────────────────────────────
export interface KuponClaim {
  id: string;
  event_id: string;
  guest_uuid: string;
  is_scanned: boolean;
  claimed_at: string;
}

// ── volunteer_gigs ─────────────────────────────────────────
export interface VolunteerGig {
  id: string;
  title: string;
  description: string | null;
  required_pax: number;
  created_by: string | null;
  gig_date: string | null;    // "YYYY-MM-DD"
  start_time: string | null;  // "HH:MM:SS"
  end_time: string | null;    // "HH:MM:SS"
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

// ── gig_claims ─────────────────────────────────────────────
export interface GigClaim {
  id: string;
  gig_id: string;
  guest_uuid: string;
  created_at: string;
}

// ── zakat_counters ─────────────────────────────────────────
export interface ZakatCounter {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  hours: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

// ── system_broadcasts ──────────────────────────────────────
export interface SystemBroadcast {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

// ── system_settings ────────────────────────────────────────
export interface SystemSettings {
  id: string;
  key: string;
  value: string;
  updated_at: string | null;
}

// ── RPC return types ───────────────────────────────────────
export interface ScanKuponResult {
  success: boolean;
  remaining?: number;
  error?: string;
}

export interface UnclaimedKupon {
  id: string;
  event_id: string;
  event_name: string;
  guest_uuid: string;
  display_name: string;
  claimed_at: string;
}

export interface GetAllUsersRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_banned: boolean;
  total_points: number;
}
