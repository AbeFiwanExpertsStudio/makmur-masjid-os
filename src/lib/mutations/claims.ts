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
  guestUuid: string,
  deviceUuid?: string
): Promise<ClaimResult & { claimId?: string }> {
  try {
    // If this is a fallback/demo event (no real DB row), allow local claim only.
    if (FALLBACK_EVENT_IDS.has(eventId)) {
      console.info("Demo event — local claim only (no DB row exists).");
      return { success: true };
    }

    const supabase = createClient();

    const result = await Promise.race([
      supabase.from("kupon_claims").insert({
        event_id: eventId,
        guest_uuid: guestUuid,
        ...(deviceUuid ? { device_uuid: deviceUuid } : {}),
      }).select("id").single().then(r => r),
      new Promise<{ data: any, error: { code: string; message: string } | null }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { code: "TIMEOUT", message: "Request timed out" } }), 5000)
      ),
    ]);

    if (result.error) {
      if (result.error.code === "23505") {
        // Could be either guest_uuid or device_uuid constraint violation
        return { success: false, error: "A kupon for this event has already been claimed on this device." };
      }
      // Foreign key violation — the event_id doesn't exist in food_events
      if (result.error.code === "23503") {
        return { success: false, error: "This event no longer exists. Please refresh the page." };
      }
      // Timeout — do NOT silently succeed; ask user to retry
      if (result.error.code === "TIMEOUT") {
        return { success: false, error: "Request timed out. Please check your connection and try again." };
      }
      // RLS / permission error — return failure (never fake a successful claim)
      if (result.error.code === "42501" || result.error.message?.includes("policy")) {
        return { success: false, error: "You are not authorized to claim this kupon." };
      }
      return { success: false, error: result.error.message };
    }
    return { success: true, claimId: result.data?.id };
  } catch (err: any) {
    console.error("Kupon claim request failed:", err);
    return { success: false, error: err?.message || "Failed to claim kupon. Please try again." };
  }
}

/**
 * Cancel a food kupon claim for the given event.
 */
export async function cancelKupon(
  claimId: string
): Promise<ClaimResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_kupon", {
      p_claim_id: claimId,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.warn("Kupon cancel request failed:", err);
    return { success: false, error: err?.message || "Failed to cancel kupon" };
  }
}

/**
 * Claim a volunteer gig slot.
 * Uses the claim_gig RPC which enforces time-overlap validation server-side.
 */
export async function claimGig(
  gigId: string,
  guestUuid: string
): Promise<ClaimResult> {
  try {
    const supabase = createClient();

    const result = await Promise.race([
      supabase.rpc('claim_gig', { p_gig_id: gigId, p_guest_uuid: guestUuid }),
      new Promise<{ error: { code: string; message: string } | null }>((resolve) =>
        setTimeout(() => resolve({ error: { code: "TIMEOUT", message: "Request timed out" } }), 5000)
      ),
    ]);

    if (result.error) {
      if ((result.error as any).code === "23505" || (result.error as any).message?.includes('already claimed')) {
        return { success: false, error: "You have already claimed this gig." };
      }
      if ((result.error as any).message?.includes('overlaps')) {
        return { success: false, error: "You already have a gig that overlaps with this time slot." };
      }
      if ((result.error as any).code === '23503') {
        return { success: false, error: "This gig no longer exists. Please refresh the page." };
      }
      return { success: false, error: (result.error as any).message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Gig claim request failed:", err);
    return { success: false, error: err.message || "Failed to claim gig" };
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

/**
 * Scan a kupon claim as an admin.
 */
export async function scanKupon(
  claimInput: string
): Promise<ClaimResult & { remaining?: number }> {
  try {
    const supabase = createClient();

    // The admin scans a truncated ID (first 8 chars of guest_uuid or id).
    // Let's resolve the full claim ID first.
    let resolvedClaimId = claimInput;

    // Instead of querying by UUID (which causes error if input is not a full UUID),
    // we fetch unscanned claims and find the match.
    // (In production with high volume, a dedicated RPC or text casting view is better).
    const { data: claims, error: searchError } = await supabase
      .from("kupon_claims")
      .select("id, guest_uuid")
      .eq("is_scanned", false);

    if (searchError) {
      console.warn("Error searching for claim:", searchError.message);
      return { success: false, error: "Database error while searching for Kupon." };
    }

    if (claims && claims.length > 0) {
      const inputLower = claimInput.toLowerCase();
      const matches = claims.filter(c =>
        c.guest_uuid.toLowerCase().startsWith(inputLower) ||
        c.id.toLowerCase().startsWith(inputLower)
      );

      if (matches.length === 0) {
        return { success: false, error: "Kupon not found or already scanned." };
      }
      if (matches.length > 1) {
        return { success: false, error: "Multiple matching Kupons found. Please provide a more specific ID." };
      }

      resolvedClaimId = matches[0].id;
    }

    // Call the RPC with the resolved full UUID
    const { data, error } = await supabase.rpc("scan_kupon", {
      p_claim_id: resolvedClaimId,
    });

    if (error) {
      // Handle the case where the provided claimId wasn't found in active claims 
      // (e.g. if claims dataset was empty, resolvedClaimId = claimInput)
      if (error.code === "22P02") {
        return { success: false, error: "Invalid Kupon ID format." };
      }
      console.warn("scan_kupon RPC error:", error.message);
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.error };
    }

    return { success: true, remaining: data?.remaining };
  } catch (err: any) {
    console.warn("scanKupon exception:", err?.message);
    return { success: false, error: "Unexpected error. Please try again." };
  }
}
