import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client to bypass RLS for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { campaignId, amount, donorName, donorEmail, donorPhone } = body;

    if (!campaignId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Missing required fields or invalid amount" },
        { status: 400 }
      );
    }

    if (amount > 100000) {
      return NextResponse.json(
        { error: "Donation amount cannot exceed RM100,000" },
        { status: 400 }
      );
    }

    // 1. Fetch campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("crowdfund_campaigns")
      .select("title")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // 2. Create a pending donation record in Supabase
    const { data: donation, error: donationError } = await supabaseAdmin
      .from("donations")
      .insert({
        campaign_id: campaignId,
        amount: amount,
        donor_name: donorName || "Anonymous",
        donor_email: donorEmail || null,
        donor_phone: donorPhone || null,
        status: "pending",
        payment_gateway: "toyyibpay",
      })
      .select()
      .single();

    if (donationError) {
      console.error("Error creating donation record:", donationError);
      return NextResponse.json(
        { error: "Failed to create donation record" },
        { status: 500 }
      );
    }

    // 3. Create ToyyibPay Bill
    const toyyibpaySecretKey = process.env.TOYYIBPAY_SECRET_KEY;
    const toyyibpayCategoryCode = process.env.TOYYIBPAY_CATEGORY_CODE;
    const isDev = process.env.NODE_ENV === "development";
    const toyyibpayUrl = isDev
      ? "https://dev.toyyibpay.com"
      : "https://toyyibpay.com";

    if (!toyyibpaySecretKey || !toyyibpayCategoryCode) {
      console.error("Missing ToyyibPay credentials in environment variables");
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Append the callback secret to the webhook URL so ToyyibPay includes it
    // in every callback, allowing the webhook handler to verify the source.
    const callbackSecret = process.env.TOYYIBPAY_CALLBACK_SECRET;
    const callbackUrl = callbackSecret
      ? `${appUrl}/api/webhooks/toyyibpay?secret=${callbackSecret}`
      : `${appUrl}/api/webhooks/toyyibpay`;

    const billPayload = new URLSearchParams({
      userSecretKey: toyyibpaySecretKey,
      categoryCode: toyyibpayCategoryCode,
      billName: `Donation: ${campaign.title.substring(0, 20)}`,
      billDescription: `Donation for ${campaign.title}`,
      billPriceSetting: "1", // 1 = Fixed amount
      billPayorInfo: "1", // 1 = Required
      billAmount: (amount * 100).toString(), // Amount in cents
      billReturnUrl: `${appUrl}/crowdfunding?payment=success&donation_id=${donation.id}`,
      billCallbackUrl: callbackUrl,
      billExternalReferenceNo: donation.id,
      billTo: donorName || "Anonymous Donor",
      billEmail: donorEmail || "no-reply@makmur.os",
      billPhone: donorPhone || "0123456789",
      billSplitPayment: "0",
      billSplitPaymentArgs: "",
      billPaymentChannel: "0", // 0 = FPX & Credit Card
      billDisplayMerchant: "1",
      billContentEmail: "Thank you for your donation to Project Makmur!",
      billChargeToCustomer: "1", // 1 = Charge to customer
    });

    const response = await fetch(`${toyyibpayUrl}/index.php/api/createBill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: billPayload.toString(),
    });

    const result = await response.json();

    if (result && result[0] && result[0].BillCode) {
      const billCode = result[0].BillCode;

      // Update donation record with bill code
      await supabaseAdmin
        .from("donations")
        .update({ payment_intent_id: billCode })
        .eq("id", donation.id);

      return NextResponse.json({
        url: `${toyyibpayUrl}/${billCode}`,
        billCode,
      });
    } else {
      console.error("ToyyibPay API Error:", result);
      return NextResponse.json(
        { error: "Failed to create payment bill" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Checkout API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
