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
  is_cancelled: boolean;
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

// ── lost_found_items ───────────────────────────────────────
export type LostFoundType = "lost" | "found";
export type LostFoundStatus = "open" | "claimed" | "resolved";

export interface LostFoundItem {
  id: string;
  type: LostFoundType;
  title: string;
  description: string | null;
  category: string;
  location_found: string | null;
  image_url: string | null;
  contact_info: string | null;
  status: LostFoundStatus;
  posted_by: string | null;
  resolved_at: string | null;
  created_at: string;
  // joined fields
  profiles?: { display_name: string | null } | null;
}

// ── facilities ─────────────────────────────────────────────
export interface Facility {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

// ── facility_bookings ──────────────────────────────────────
export type BookingStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface FacilityBooking {
  id: string;
  facility_id: string;
  booked_by: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  purpose: string | null;
  attendees: number;
  status: BookingStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
  // joined fields
  facilities?: { name: string } | null;
  profiles?: { display_name: string | null } | null;
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

// ── mosque_programs ────────────────────────────────────────
export type ProgramType = "lecture" | "halaqah" | "jumuah" | "other";

export interface MosqueProgram {
  id: string;
  title: string;
  description: string | null;
  program_type: ProgramType;
  program_date: string;    // "YYYY-MM-DD"
  start_time: string;      // "HH:MM:SS"
  end_time: string;        // "HH:MM:SS"
  speaker: string | null;
  location: string | null;
  is_recurring: boolean;
  recurrence_note: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

// ── volunteer leaderboard RPC row ──────────────────────────
export interface LeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  total_points: number;
}

// ── notifications ──────────────────────────────────────────
export type NotificationType = "booking_approved" | "booking_rejected";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

// ── verify_booking_token RPC row ───────────────────────────
export interface VerifyBookingResult {
  valid: boolean;
  is_today: boolean;         // true when booking_date = today
  booking_status: string;
  purpose: string | null;
  facility_name: string;
  booking_date: string;      // "YYYY-MM-DD"
  start_time: string;        // "HH:MM:SS"
  end_time: string;          // "HH:MM:SS"
  booked_by_name: string;
  attendees: number;
}
