import { createClient } from "@/lib/supabase/client";

interface ClaimResult {
  success: boolean;
  error?: string;
}

// These are the hardcoded fallback IDs used when food_events table is empty.
// Claims for these IDs should be allowed locally without hitting the DB
// (the real rows don't exist in the database, so FK constraint would fail).
const FALLBACK_EVENT_IDS = new Set([
  "11111111-1111-4111-a111-111111111111",
  "22222222-2222-4222-a222-222222222222",
]);

/**
 * Claim a food kupon for the given event.
 * Falls back to local-only claim if DB is unreachable.
 */
export async function claimKupon(
  eventId: string,
  guestUuid: string
): Promise<ClaimResult> {
  try {
    // If this is a fallback/demo event (no real DB row), allow local claim only.
    if (FALLBACK_EVENT_IDS.has(eventId)) {
      console.info("Demo event — local claim only (no DB row exists).");
      return { success: true };
    }

    const supabase = createClient();

    const result = await Promise.race([
      supabase.from("kupon_claims").insert({ event_id: eventId, guest_uuid: guestUuid }).then(r => r),
      new Promise<{ error: { code: string; message: string } | null }>((resolve) =>
        setTimeout(() => resolve({ error: { code: "TIMEOUT", message: "Request timed out" } }), 5000)
      ),
    ]);

    if (result.error) {
      if (result.error.code === "23505") {
        return { success: false, error: "You have already claimed this kupon." };
      }
      // Foreign key violation — the event_id doesn't exist in food_events
      if (result.error.code === "23503") {
        return { success: false, error: "This event no longer exists. Please refresh the page." };
      }
      // RLS or permission error — still allow local claim for demo
      if (result.error.code === "42501" || result.error.code === "TIMEOUT" || result.error.message?.includes("policy")) {
        console.warn("Kupon claim blocked/timed out, proceeding with local claim");
        return { success: true };
      }
      return { success: false, error: result.error.message };
    }
    return { success: true };
  } catch (err) {
    console.warn("Kupon claim request failed, proceeding with local claim:", err);
    return { success: true };
  }
}

// These are the hardcoded fallback IDs from the initialGigs array in gigs/page.tsx.
// Claims for these IDs should be allowed locally without hitting the DB
// (the real rows may not exist in the database yet).
const FALLBACK_GIG_IDS = new Set([
  "a1111111-1111-4111-a111-111111111111",
  "a2222222-2222-4222-a222-222222222222",
  "a3333333-3333-4333-a333-333333333333",
  "a4444444-4444-4444-a444-444444444444",
]);

/**
 * Claim a volunteer gig slot.
 * Falls back to local-only claim if DB is unreachable or ID is demo-only.
 */
export async function claimGig(
  gigId: string,
  guestUuid: string
): Promise<ClaimResult> {
  try {
    // If this is a fallback/demo gig (no real DB row), allow local claim only.
    if (FALLBACK_GIG_IDS.has(gigId)) {
      console.info("Demo gig — local claim only (no DB row exists).");
      return { success: true };
    }

    const supabase = createClient();

    const result = await Promise.race([
      supabase.from("gig_claims").insert({ gig_id: gigId, guest_uuid: guestUuid }).then(r => r),
      new Promise<{ error: { code: string; message: string } | null }>((resolve) =>
        setTimeout(() => resolve({ error: { code: "TIMEOUT", message: "Request timed out" } }), 5000)
      ),
    ]);

    if (result.error) {
      if (result.error.code === "23505") {
        return { success: false, error: "You have already claimed this gig." };
      }
      // Foreign key violation — the gig_id doesn't exist in volunteer_gigs
      if (result.error.code === "23503") {
        return { success: false, error: "This gig no longer exists. Please refresh the page." };
      }
      // Invalid UUID format — gig was created locally without a real UUID
      if (result.error.message?.includes("invalid input syntax for type uuid")) {
        console.warn("Invalid UUID for gig claim, proceeding with local claim");
        return { success: true };
      }
      if (result.error.code === "42501" || result.error.code === "TIMEOUT" || result.error.message?.includes("policy")) {
        console.warn("Gig claim blocked/timed out, proceeding with local claim");
        return { success: true };
      }
      return { success: false, error: result.error.message };
    }
    return { success: true };
  } catch (err) {
    console.warn("Gig claim request failed, proceeding with local claim:", err);
    return { success: true };
  }
}

/**
 * Cancel / unclaim a volunteer gig slot.
 * Uses .select() so we can detect when RLS silently blocks the DELETE
 * (Supabase returns no error but 0 rows deleted when policy denies it).
 */
export async function cancelGig(
  gigId: string,
  guestUuid: string
): Promise<ClaimResult> {
  try {
    const supabase = createClient();

    const { data, error } = await Promise.race([
      supabase
        .from("gig_claims")
        .delete()
        .eq("gig_id", gigId)
        .eq("guest_uuid", guestUuid)
        .select(), // ← crucial: returns deleted rows so we can verify
      new Promise<{ data: null; error: { code: string; message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: { code: "TIMEOUT", message: "Request timed out" } }),
          5000
        )
      ),
    ]);

    if (error) {
      if ((error as any).code === "TIMEOUT") {
        console.warn("Cancel gig timed out.");
        return { success: false, error: "Request timed out. Please try again." };
      }
      console.warn("cancelGig DB error:", (error as any).message);
      return { success: false, error: (error as any).message };
    }

    // If the delete was blocked by RLS, data will be an empty array (no rows deleted)
    if (!data || (data as any[]).length === 0) {
      console.warn("cancelGig: 0 rows deleted — RLS policy likely blocked it. Run supabase/fix_cancel_gig_rls.sql in Supabase.");
      return {
        success: false,
        error: "Permission denied. The AJK may need to enable cancellations in Supabase settings.",
      };
    }

    return { success: true };
  } catch (err: any) {
    console.warn("cancelGig exception:", err?.message);
    return { success: false, error: "Unexpected error. Please try again." };
  }
}
