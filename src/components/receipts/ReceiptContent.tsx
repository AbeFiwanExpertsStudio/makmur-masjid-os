import React from "react";

interface ReceiptContentProps {
  donation: {
    id: string;
    amount: number;
    created_at: string;
    donor_name?: string;
    crowdfund_campaigns?: {
      title: string;
    };
  };
}

export default function ReceiptContent({ donation }: ReceiptContentProps) {
  // 1. Format data consistently
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

  // Use explicit Hex colors to avoid "lab" or "oklch" parsing errors in html2canvas
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

  return (
    <div 
      id="receipt-container"
      className="receipt-capture-area"
      style={{
        backgroundColor: colors.bg,
        padding: "40px",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: colors.slate900,
        lineHeight: "1.6"
      }}
    >
      <div 
        className="receipt-card"
        style={{
          maxWidth: "550px",
          margin: "0 auto",
          backgroundColor: colors.white,
          borderRadius: "32px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.1)",
          border: `1px solid ${colors.border}`,
          overflow: "hidden"
        }}
      >
        {/* Header Segment */}
        <div 
          className="header-bg"
          style={{
            background: `linear-gradient(135deg, ${colors.emerald500} 0%, ${colors.teal700} 100%)`,
            padding: "48px",
            textAlign: "center",
            color: colors.white,
            position: "relative"
          }}
        >
          <div 
            className="masjid-icon-container"
            style={{
              backgroundColor: colors.white,
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              margin: "0 auto 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={colors.emerald500} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
              <path d="M9 7h1" /><path d="M9 11h1" /><path d="M14 7h1" /><path d="M14 11h1" />
              <path d="M3 21h18" /><path d="M9 21v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
            </svg>
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: "900", margin: "0", color: colors.white }}>Project Makmur</h1>
          <p style={{ fontSize: "12px", opacity: "0.8", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: "700" }}>Official Donation Receipt</p>
        </div>

        {/* Content Segment */}
        <div className="p-12" style={{ padding: "48px" }}>
          <div className="text-center" style={{ textAlign: "center", marginBottom: "40px", borderBottom: `1px dashed ${colors.borderDashed}`, paddingBottom: "40px" }}>
            <h2 style={{ fontSize: "48px", fontWeight: "900", color: colors.emerald500, margin: "0", letterSpacing: "-0.05em" }}>{amountFormatted}</h2>
            <p style={{ color: colors.slate400, fontSize: "11px", marginTop: "8px", textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: "900" }}>Total Contribution</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: "32px", columnGap: "24px" }}>
            <div className="space-y-1">
              <label style={{ display: "block", fontSize: "10px", fontWeight: "900", color: colors.slate400, textTransform: "uppercase", letterSpacing: "0.1em" }}>Receipt No</label>
              <span style={{ fontSize: "14px", fontWeight: "700", color: colors.slate700 }}>#RC-{receiptNo}</span>
            </div>
            <div className="space-y-1">
              <label style={{ display: "block", fontSize: "10px", fontWeight: "900", color: colors.slate400, textTransform: "uppercase", letterSpacing: "0.1em" }}>Date & Time</label>
              <span style={{ fontSize: "14px", fontWeight: "700", color: colors.slate700 }}>{dateFormatted}</span>
            </div>
            <div className="space-y-1">
              <label style={{ display: "block", fontSize: "10px", fontWeight: "900", color: colors.slate400, textTransform: "uppercase", letterSpacing: "0.1em" }}>Donor Name</label>
              <span style={{ fontSize: "14px", fontWeight: "700", color: colors.slate700 }}>{donation.donor_name || "Anonymous"}</span>
            </div>
            <div className="space-y-1">
              <label style={{ display: "block", fontSize: "10px", fontWeight: "900", color: colors.slate400, textTransform: "uppercase", letterSpacing: "0.1em" }}>Status</label>
              <span style={{ fontSize: "14px", fontWeight: "700", color: colors.emerald500 }}>Successful</span>
            </div>
          </div>

          <div style={{ marginTop: "40px", paddingTop: "40px", borderTop: `1px solid ${colors.border}` }}>
            <div style={{ backgroundColor: colors.bg, borderRadius: "16px", padding: "24px", border: `1px solid ${colors.border}` }}>
              <label style={{ fontSize: "10px", fontWeight: "900", color: colors.slate400, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px", display: "block" }}>Supported Campaign</label>
              <p style={{ fontSize: "14px", fontWeight: "700", color: colors.slate800, lineHeight: "1.4", margin: "0" }}>{campaignTitle}</p>
            </div>
          </div>

          <div style={{ marginTop: "48px", textAlign: "center" }}>
            <p style={{ color: colors.slate400, fontSize: "11px", fontStyle: "italic", margin: "0", lineHeight: "1.5" }}>
              Thank you for your generous contribution. May this donation be a source of continuous blessing for you and the community.
            </p>
            <p style={{ color: colors.emerald500, fontWeight: "900", fontSize: "12px", marginTop: "24px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Jazāk Allāhu Khayran</p>
          </div>
        </div>
      </div>
    </div>
  );
}
