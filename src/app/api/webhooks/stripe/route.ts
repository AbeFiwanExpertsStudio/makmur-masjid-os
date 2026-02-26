import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe lazily to prevent build-time crashes if keys are missing
let stripeInstance: Stripe | null = null;
const getStripe = () => {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is missing");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16" as any,
    });
  }
  return stripeInstance;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Verify the event came from Stripe
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig ?? "", webhookSecret);
  } catch (err) {
    console.warn("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const donationId = session.metadata?.donation_id;

      if (!donationId) {
        console.warn("Webhook: no donation_id in session metadata");
        return NextResponse.json({ received: true });
      }

      // Fetch the donation
      const { data: donation, error } = await supabaseAdmin
        .from("donations")
        .select("id, status, campaign_id, amount")
        .eq("id", donationId)
        .single();

      if (error || !donation) {
        console.error("Webhook: donation not found:", donationId);
        return NextResponse.json({ error: "Donation not found" }, { status: 404 });
      }

      // Idempotency — skip if already completed
      if (donation.status === "completed") {
        return NextResponse.json({ received: true });
      }

      // Mark donation as completed
      await supabaseAdmin
        .from("donations")
        .update({
          status: "completed",
          payment_intent_id: session.payment_intent as string ?? session.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", donationId)
        .neq("status", "completed");

      // Atomically increment campaign amount
      if (donation.campaign_id) {
        const { error: rpcError } = await supabaseAdmin.rpc("increment_campaign_amount", {
          p_campaign_id: donation.campaign_id,
          p_amount: donation.amount,
        });
        if (rpcError) {
          console.error("Webhook: failed to increment campaign amount:", rpcError);
        }
      }

      console.log(`Webhook: donation ${donationId} completed via Stripe`);
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const donationId = session.metadata?.donation_id;
      if (donationId) {
        await supabaseAdmin
          .from("donations")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", donationId)
          .eq("status", "pending");
        console.log(`Webhook: donation ${donationId} expired`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
