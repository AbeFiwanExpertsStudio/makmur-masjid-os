"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import type { FacilityBooking, BookingStatus } from "@/types/database";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import Pagination from "@/components/ui/Pagination";
import {
  Building2, Users, Loader2, CalendarDays, Clock, ChevronRight,
  LogIn, Briefcase, QrCode, Download, HandHeart, Printer
} from "lucide-react";
import DonationReceiptModal from "@/components/modals/DonationReceiptModal";
import { QRCodeSVG } from "qrcode.react";

/* ──────────────────────────────────────────────────── */
/* Helpers shared with facility-booking page            */
/* ──────────────────────────────────────────────────── */
function statusColor(s: BookingStatus) {
  const map: Record<BookingStatus, string> = {
    pending:   "bg-amber-500 text-white dark:bg-amber-500/80",
    approved:  "bg-emerald-600 text-white dark:bg-emerald-600/80",
    rejected:  "bg-red-600 text-white dark:bg-red-600/80",
    cancelled: "bg-gray-500 text-white dark:bg-gray-600",
  };
  return map[s] ?? map.pending;
}

function statusLabel(s: BookingStatus, t: any) {
  const map: Record<BookingStatus, string> = {
    pending:   t.fbStatusPending,
    approved:  t.fbStatusApproved,
    rejected:  t.fbStatusRejected,
    cancelled: t.fbStatusCancelled,
  };
  return map[s] ?? s;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00").toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}
function fmtTime(t: string) { return t?.slice(0, 5) ?? ""; }

/* ──────────────────────────────────────────────────── */

interface GigClaim {
  id: string;
  joined_at: string;
  volunteer_gigs: {
    title: string;
    gig_date: string;
    start_time: string;
    end_time: string;
    is_completed: boolean;
    is_cancelled: boolean;
  } | null;
}

type TabKey = "facilities" | "gigs" | "donations";

const ITEMS_PER_PAGE = 6;

/* ──────────────────────────────────────────────────── */

export default function MyBookingsPage() {
  const { user, isAnonymous, isLoading: authLoading, setShowLoginModal } = useAuth();
  const { t } = useLanguage();

  const [tab, setTab] = useState<TabKey>("facilities");
  const [bookingPage, setBookingPage] = useState(1);
  const [gigPage, setGigPage] = useState(1);
  const [bookings, setBookings] = useState<FacilityBooking[]>([]);
  const [gigs, setGigs] = useState<GigClaim[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Reset page when tab changes
  function switchTab(key: TabKey) {
    setTab(key);
    setBookingPage(1);
    setGigPage(1);
  }

  useEffect(() => {
    if (!user || isAnonymous) { setLoading(false); return; }
    const supabase = createClient();

    async function load() {
      setLoading(true);
      // Show bookings from the last 90 days (plus any future-dated approved bookings)
      const since90days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const [bookRes, gigRes, donRes] = await Promise.all([
        supabase
          .from("facility_bookings")
          .select("*, facilities(name)")
          .eq("booked_by", user!.id)
          .or(`booking_date.gte.${since90days},status.eq.approved`)
          .order("booking_date", { ascending: false }),
        supabase
          .from("gig_claims")
          .select("id, joined_at, volunteer_gigs(title, gig_date, start_time, end_time, is_completed, is_cancelled)")
          .eq("guest_uuid", user!.id)
          .gte("joined_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
          .order("joined_at", { ascending: false }),
        supabase
          .from("donations")
          .select("*, crowdfund_campaigns(title)")
          .eq("donor_email", user!.email) // We track by email since donations can be done while guest but linked via email
          .eq("status", "completed")
          .order("created_at", { ascending: false }),
      ]);
      if (bookRes.data) setBookings(bookRes.data as FacilityBooking[]);
      if (gigRes.data) setGigs(gigRes.data as unknown as GigClaim[]);
      if (donRes.data) setDonations(donRes.data);
      setLoading(false);
    }
    load();
  }, [user, isAnonymous]);

  /* ── Guest gate ── */
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-text-muted" size={22} />
      </div>
    );
  }
  if (isAnonymous || !user) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl hero-gradient flex items-center justify-center text-white mx-auto mb-4">
          <Building2 size={28} />
        </div>
        <h1 className="text-2xl font-bold text-text mb-2">{t.myBookingsTitle}</h1>
        <p className="text-text-muted mb-6 text-sm">{t.myBookingsSignInHint}</p>
        <button
          onClick={() => setShowLoginModal(true)}
          className="btn-primary px-6 py-2.5 flex items-center gap-2 mx-auto"
        >
          <LogIn size={16} /> {t.signIn}
        </button>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "facilities", label: t.myBookingsFacilities, count: bookings.length },
    { key: "gigs",       label: t.myBookingsGigs,       count: gigs.length },
    { key: "donations",  label: "Donations",             count: donations.length },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="text-primary"><Briefcase size={24} strokeWidth={2.5} /></div>
        <div>
          <h1 className="text-xl font-bold text-text">{t.myBookingsTitle}</h1>
          <p className="text-xs text-text-muted">{t.myBookingsSubtitle}</p>
        </div>
      </div>

      {/* Tab pills — full-width so they look balanced on mobile */}
      <div className="flex gap-2 mb-5">
        {tabs.map(tb => (
          <button
            key={tb.key}
            onClick={() => switchTab(tb.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === tb.key
                ? "bg-primary text-white shadow-sm"
                : "bg-surface-alt text-text-muted hover:text-text"
            }`}
          >
            {tb.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === tb.key ? "bg-white/20 text-white" : "bg-border text-text-muted"
            }`}>
              {tb.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-text-muted gap-2">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : tab === "facilities" ? (
        <FacilityList bookings={bookings} t={t} page={bookingPage} onPageChange={setBookingPage} />
      ) : tab === "gigs" ? (
        <GigList gigs={gigs} t={t} page={gigPage} onPageChange={setGigPage} />
      ) : (
        <DonationList donations={donations} t={t} page={1} onPageChange={() => {}} onShowReceipt={(id) => setShowReceiptModal(id)} />
      )}

      {/* Receipt Modal */}
      {showReceiptModal && (
        <DonationReceiptModal 
          donationId={showReceiptModal}
          onClose={() => setShowReceiptModal(null)}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────── */

function FacilityList({ bookings, t, page, onPageChange }: { bookings: FacilityBooking[]; t: any; page: number; onPageChange: (p: number) => void }) {
  const [expandedQR, setExpandedQR] = useState<string | null>(null);

  const paged = bookings.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto mb-3">
          <Building2 size={24} className="text-text-muted/50" />
        </div>
        <p className="text-sm font-semibold text-text-muted">{t.myBookingsFacilityEmpty}</p>
        <Link href="/facility-booking" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
          {t.myBookingsViewAll} <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {paged.map(b => (
        <div key={b.id} className="card px-4 py-3.5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text text-[15px] leading-snug truncate">
                {b.facilities?.name ?? "—"}
              </p>
              {b.purpose && (
                <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{b.purpose}</p>
              )}
            </div>
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${statusColor(b.status)}`}>
              {statusLabel(b.status, t)}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <CalendarDays size={11} /> {fmtDate(b.booking_date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} /> {fmtTime(b.start_time)} – {fmtTime(b.end_time)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={11} /> {b.attendees}
            </span>
          </div>
          {b.admin_note && (
            <p className="mt-2 text-xs text-text-muted italic border-t border-border/60 pt-2">
              {b.admin_note}
            </p>
          )}

          {/* ── Checked-in indicator ── */}
          {b.checked_in_at && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {t.mbCheckedIn} · {new Date(b.checked_in_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}

          {/* ── Entry QR — approved bookings only ── */}
          {b.status === "approved" && (
            <div className="mt-3 border-t border-border/40 pt-3">
              <button
                onClick={() => setExpandedQR(expandedQR === b.id ? null : b.id)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-dark transition"
              >
                <QrCode size={13} />
                {expandedQR === b.id ? t.fbQrHide : t.fbQrShow}
              </button>
              {expandedQR === b.id && (
                <div className="mt-3 flex flex-col items-center gap-2 p-4 rounded-xl bg-white border border-border/60">
                  <QRCodeSVG
                    value={`makmur-booking:${b.id}`}
                    size={160}
                    level="M"
                    includeMargin
                  />
                  <p className="text-[11px] text-gray-500 font-semibold">{t.fbQrLabel}</p>
                  <p className="text-[10px] text-gray-400 text-center max-w-[180px]">{t.fbQrHint}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <Pagination page={page} total={bookings.length} perPage={ITEMS_PER_PAGE} onChange={onPageChange} />
    </div>
  );
}

/* ──────────────────────────────────────────────────── */

function GigList({ gigs, t, page, onPageChange }: { gigs: GigClaim[]; t: any; page: number; onPageChange: (p: number) => void }) {
  if (gigs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto mb-3">
          <Briefcase size={24} className="text-text-muted/50" />
        </div>
        <p className="text-sm font-semibold text-text-muted">{t.myBookingsGigsEmpty}</p>
        <Link href="/gigs" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
          {t.navVolunteer} <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gigs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE).map(c => {
        const g = c.volunteer_gigs;
        if (!g) return null;
        return (
          <div key={c.id} className="card px-4 py-3.5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-bold text-text text-[15px] leading-snug min-w-0 flex-1 truncate">{g.title}</p>
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                g.is_cancelled
                  ? "bg-gray-500 text-white dark:bg-gray-600"
                  : g.is_completed
                    ? "bg-emerald-600 text-white dark:bg-emerald-600/80"
                    : "bg-primary/10 text-primary"
              }`}>
                {g.is_cancelled ? t.fbStatusCancelled : g.is_completed ? t.gigCompleted : t.mpUpcoming}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <CalendarDays size={11} /> {fmtDate(g.gig_date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} /> {fmtTime(g.start_time)} – {fmtTime(g.end_time)}
              </span>
            </div>
          </div>
        );
      })}
      <Pagination page={page} total={gigs.length} perPage={ITEMS_PER_PAGE} onChange={onPageChange} />
    </div>
  );
}

/* ──────────────────────────────────────────────────── */

function DonationList({ donations, t, page, onPageChange, onShowReceipt }: { donations: any[]; t: any; page: number; onPageChange: (p: number) => void, onShowReceipt: (id: string) => void }) {
  if (donations.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-surface-alt border border-border flex items-center justify-center mx-auto mb-3 text-text-muted/50">
          <HandHeart size={24} />
        </div>
        <p className="text-sm font-semibold text-text-muted">No donations yet.</p>
        <Link href="/crowdfunding" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline">
          Browse Campaigns <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {donations.map(d => (
        <div key={d.id} className="card px-4 py-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text text-[15px] leading-snug truncate">
                {d.crowdfund_campaigns?.title || "General Donation"}
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {new Date(d.created_at).toLocaleDateString(undefined, {
                  day: "numeric", month: "short", year: "numeric"
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[15px] font-black text-primary">
                {new Intl.NumberFormat("en-MY", {
                  style: "currency",
                  currency: "MYR",
                  minimumFractionDigits: 2,
                }).format(d.amount)}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">Successful</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => onShowReceipt(d.id)}
              className="flex-1 py-2 bg-surface-alt border border-border hover:bg-primary/5 hover:border-primary/30 rounded-xl text-xs font-bold text-text-secondary hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              <Printer size={13} />
              View Receipt
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
