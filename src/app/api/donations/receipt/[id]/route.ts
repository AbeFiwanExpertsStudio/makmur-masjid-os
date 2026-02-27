import { createClient } from "@supabase/supabase-js";

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

    // Manual rendering logic to avoid build issues with React components in API routes
    const amountFormatted = new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 2,
    }).format(donation.amount);

    const dateFormatted = new Date(donation.created_at).toLocaleDateString("en-MY", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const receiptNo = donation.id.slice(0, 8).toUpperCase();
    const campaignTitle = donation.crowdfund_campaigns?.title || "General Donation";

    const colors = {
      white: "#ffffff",
      bg: "#f8fafc",
      slate400: "#94a3b8",
      slate700: "#334155",
      slate800: "#1e293b",
      slate900: "#0f172a",
      emerald500: "#10b981",
      emerald600: "#059669",
      teal700: "#0f766e",
      border: "#f1f5f9",
      borderDashed: "#e2e8f0"
    };

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Donation Receipt - ${receiptNo}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        body { 
            font-family: 'Inter', system-ui, sans-serif; 
            background-color: ${colors.bg}; 
            margin: 0; 
            padding: 40px 20px;
            color: ${colors.slate900};
            line-height: 1.6;
            display: flex;
            justify-content: center;
        }
        .receipt-card {
            max-width: 550px;
            width: 100%;
            background-color: ${colors.white};
            border-radius: 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
            border: 1px solid ${colors.border};
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, ${colors.emerald500} 0%, ${colors.teal700} 100%);
            padding: 48px;
            text-align: center;
            color: ${colors.white};
        }
        .icon-container {
            background-color: ${colors.white};
            width: 64px;
            height: 64px;
            border-radius: 16px;
            margin: 0 auto 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .content {
            padding: 48px;
        }
        .amount-section {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 1px dashed ${colors.borderDashed};
            padding-bottom: 40px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            row-gap: 32px;
            column-gap: 24px;
        }
        .label {
            display: block;
            font-size: 10px;
            font-weight: 900;
            color: ${colors.slate400};
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 4px;
        }
        .value {
            font-size: 14px;
            font-weight: 700;
            color: ${colors.slate700};
        }
        .campaign-box {
            margin-top: 40px;
            padding-top: 40px;
            border-top: 1px solid ${colors.border};
        }
        .campaign-content {
            background-color: ${colors.bg};
            border-radius: 16px;
            padding: 24px;
            border: 1px solid ${colors.border};
        }
        .footer {
            margin-top: 48px;
            text-align: center;
        }
        @media print {
            body { padding: 0; background-color: white; }
            .receipt-card { box-shadow: none; border: 1px solid #e2e8f0; border-radius: 0; }
        }
    </style>
</head>
<body>
    <div class="receipt-card">
        <div class="header">
            <div class="icon-container">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${colors.emerald500}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
                    <path d="M9 7h1" /><path d="M9 11h1" /><path d="M14 7h1" /><path d="M14 11h1" />
                    <path d="M3 21h18" /><path d="M9 21v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
                </svg>
            </div>
            <h1 style="font-size: 24px; font-weight: 900; margin: 0;">Project Makmur</h1>
            <p style="font-size: 12px; opacity: 0.8; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;">Official Donation Receipt</p>
        </div>

        <div class="content">
            <div class="amount-section">
                <h2 style="font-size: 48px; font-weight: 900; color: ${colors.emerald500}; margin: 0; letter-spacing: -0.05em;">${amountFormatted}</h2>
                <p style="color: ${colors.slate400}; font-size: 11px; margin: 8px 0 0; text-transform: uppercase; letter-spacing: 0.2em; font-weight: 900;">Total Contribution</p>
            </div>

            <div class="grid">
                <div>
                    <span class="label">Receipt No</span>
                    <span class="value">#RC-${receiptNo}</span>
                </div>
                <div>
                    <span class="label">Date & Time</span>
                    <span class="value">${dateFormatted}</span>
                </div>
                <div>
                    <span class="label">Donor Name</span>
                    <span class="value">${donation.donor_name || "Anonymous"}</span>
                </div>
                <div>
                    <span class="label">Status</span>
                    <span class="value" style="color: ${colors.emerald500}">Successful</span>
                </div>
            </div>

            <div class="campaign-box">
                <div class="campaign-content">
                    <span class="label">Supported Campaign</span>
                    <p style="font-size: 14px; font-weight: 700; color: ${colors.slate800}; line-height: 1.4; margin: 0;">${campaignTitle}</p>
                </div>
            </div>

            <div class="footer">
                <p style="color: ${colors.slate400}; font-size: 11px; font-style: italic; margin: 0; line-height: 1.5;">
                    Thank you for your generous contribution. May this donation be a source of continuous blessing for you and the community.
                </p>
                <p style="color: ${colors.emerald500}; font-weight: 900; font-size: 12px; margin: 24px 0 0; text-transform: uppercase; letter-spacing: 0.1em;">Jazāk Allāhu Khayran</p>
            </div>
        </div>
    </div>
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
