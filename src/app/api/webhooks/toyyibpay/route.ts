import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client to bypass RLS for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Webhook Secret Verification ────────────────────────────────────────────
// Set TOYYIBPAY_CALLBACK_SECRET in your .env.local and append it to the
// callback URL you register in ToyyibPay:
//   https://yourdomain.com/api/webhooks/toyyibpay?secret=YOUR_SECRET
// This prevents fraudulent callbacks from unknown sources.
const WEBHOOK_SECRET = process.env.TOYYIBPAY_CALLBACK_SECRET;

export async function POST(req: NextRequest) {
  try {
    // 0. Verify shared secret (if configured)
    if (WEBHOOK_SECRET) {
      const providedSecret = req.nextUrl.searchParams.get("secret");
      if (!providedSecret || providedSecret !== WEBHOOK_SECRET) {
        console.warn("Webhook: invalid or missing secret token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // ToyyibPay sends webhook data as form-urlencoded
    const text = await req.text();
    const params = new URLSearchParams(text);

    const refno    = params.get("refno");    // Our donation ID (UUID)
    const status   = params.get("status");   // 1 = Success, 2 = Pending, 3 = Fail
    const billcode = params.get("billcode"); // ToyyibPay bill code

    if (!refno || !status) {
      return NextResponse.json(
        { error: "Missing required webhook parameters" },
        { status: 400 }
      );
    }

    // 1. Fetch the donation record
    const { data: donation, error: donationError } = await supabaseAdmin
      .from("donations")
      .select("id, status, campaign_id, amount, payment_intent_id")
      .eq("id", refno)
      .single();

    if (donationError || !donation) {
      console.error("Webhook: donation not found for refno:", refno);
      return NextResponse.json({ error: "Donation not found" }, { status: 404 });
    }

    // 2. Idempotency — if already completed, do nothing and return 200
    //    This handles ToyyibPay retries without double-incrementing campaign amounts.
    if (donation.status === "completed") {
      console.info(`Webhook: donation ${refno} already completed, skipping.`);
      return NextResponse.json({ success: true });
    }

    // 3. Map ToyyibPay status codes to internal statuses
    let newStatus: string;
    if (status === "1") {
      newStatus = "completed";
    } else if (status === "3") {
      newStatus = "failed";
    } else {
      newStatus = "pending";
    }

    // Only write if status actually changed
    if (donation.status !== newStatus) {
      const { error: updateError } = await supabaseAdmin
        .from("donations")
        .update({
          status: newStatus,
          payment_intent_id: billcode || donation.payment_intent_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", refno)
        // Extra idempotency guard at DB level: only update non-completed rows
        .neq("status", "completed");

      if (updateError) {
        console.error("Webhook: failed to update donation status:", updateError);
        return NextResponse.json(
          { error: "Failed to update donation status" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
