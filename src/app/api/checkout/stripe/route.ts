import { NextResponse } from "next/server";
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
      apiVersion: "2023-10-16" as any, // Standard stable version
    });
  }
  return stripeInstance;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { campaignId, amount, donorName, donorEmail } = body;

    if (!campaignId || !amount || amount <= 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("crowdfund_campaigns")
      .select("title")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // 2. Create a pending donation record
    const { data: donation, error: donationError } = await supabaseAdmin
      .from("donations")
      .insert({
        campaign_id: campaignId,
        amount,
        donor_name: donorName || "Anonymous",
        donor_email: donorEmail || null,
        status: "pending",
        payment_gateway: "stripe",
      })
      .select()
      .single();

    if (donationError || !donation) {
      console.error("Failed to create donation:", donationError);
      return NextResponse.json({ error: "Failed to create donation record" }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // 3. Create Stripe Checkout Session (test mode — no real charges)
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "myr",
            unit_amount: Math.round(amount * 100), // Stripe amounts are in cents
            product_data: {
              name: `Donation — ${campaign.title}`,
              description: `Thank you for supporting ${campaign.title}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: donorEmail || undefined,
      metadata: {
        donation_id: donation.id,
        campaign_id: campaignId,
      },
      success_url: `${appUrl}/crowdfunding?payment=success&donation_id=${donation.id}`,
      cancel_url: `${appUrl}/crowdfunding?payment=cancelled`,
    });

    // 4. Store the Stripe session ID on the donation row
    await supabaseAdmin
      .from("donations")
      .update({ stripe_session_id: session.id })
      .eq("id", donation.id);

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
