import { createClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import ReceiptContent from "@/components/receipts/ReceiptContent";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: donationId } = await params;

  try {
    const { data: donation, error: donationError } = await supabaseAdmin
      .from("donations")
      .select(`
        *,
        crowdfund_campaigns (
          title
        )
      `)
      .eq("id", donationId)
      .single();

    if (donationError || !donation) {
      console.error("Receipt fetch error:", donationError);
      return new Response(`Receipt not found: ${donationError?.message || "Record missing"}`, { status: 404 });
    }

    if (donation.status !== "completed") {
      return new Response("Payment not completed", { status: 403 });
    }

    const receiptMarkup = renderToStaticMarkup(<ReceiptContent donation={donation} />);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Donation Receipt - ${donation.id.slice(0, 8).toUpperCase()}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; background-color: #f8fafc; margin: 0; padding: 0; }
        @media print {
            @page { margin: 0; }
            body { padding: 0; background: white; }
            .receipt-capture-area { padding: 0 !important; background: white !important; }
            .receipt-card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
        }
    </style>
</head>
<body class="bg-slate-50">
    ${receiptMarkup}
</body>
</html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("Receipt error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
