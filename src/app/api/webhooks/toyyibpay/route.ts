import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase admin client to bypass RLS for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // ToyyibPay sends webhook data as form-urlencoded
    const text = await req.text();
    const params = new URLSearchParams(text);
    
    const refno = params.get("refno"); // This is our donation ID
    const status = params.get("status"); // 1 = Success, 2 = Pending, 3 = Fail
    const reason = params.get("reason");
    const billcode = params.get("billcode");
    const order_id = params.get("order_id");
    const amount = params.get("amount");

    if (!refno || !status) {
      return NextResponse.json(
        { error: "Missing required webhook parameters" },
        { status: 400 }
      );
    }

    // 1. Fetch the donation record
    const { data: donation, error: donationError } = await supabaseAdmin
      .from("donations")
      .select("*")
      .eq("id", refno)
      .single();

    if (donationError || !donation) {
      console.error("Webhook Error: Donation not found for refno:", refno);
      return NextResponse.json(
        { error: "Donation not found" },
        { status: 404 }
      );
    }

    // 2. Update donation status based on ToyyibPay status
    let newStatus = "pending";
    if (status === "1") {
      newStatus = "completed";
    } else if (status === "3") {
      newStatus = "failed";
    }

    // Only update if status changed
    if (donation.status !== newStatus) {
      const { error: updateError } = await supabaseAdmin
        .from("donations")
        .update({
          status: newStatus,
          payment_intent_id: billcode || donation.payment_intent_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", refno);

      if (updateError) {
        console.error("Webhook Error: Failed to update donation status:", updateError);
        return NextResponse.json(
          { error: "Failed to update donation status" },
          { status: 500 }
        );
      }

      // 3. If payment is successful, update the campaign's current_amount
      if (newStatus === "completed") {
        // We need to use an RPC function to safely increment the amount
        // Or fetch current amount and add to it (less safe for concurrent donations)
        
        const { data: campaign, error: campaignError } = await supabaseAdmin
          .from("crowdfund_campaigns")
          .select("current_amount")
          .eq("id", donation.campaign_id)
          .single();

        if (!campaignError && campaign) {
          const newAmount = campaign.current_amount + donation.amount;
          
          await supabaseAdmin
            .from("crowdfund_campaigns")
            .update({ current_amount: newAmount })
            .eq("id", donation.campaign_id);
            
          console.log(`Successfully updated campaign ${donation.campaign_id} amount to ${newAmount}`);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook Processing Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
