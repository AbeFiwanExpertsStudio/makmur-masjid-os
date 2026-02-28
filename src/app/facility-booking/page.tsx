"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useState, useCallback } from "react";
import {
  Building2, Plus, X, Loader2, AlertTriangle, LogIn,
  Calendar, Clock, Users, MapPin, CheckCircle2,
  XCircle, Trash2, Pencil, ChevronDown, QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Pagination from "@/components/ui/Pagination";
import { toast } from "react-hot-toast";
import type { Facility, FacilityBooking, BookingStatus } from "@/types/database";

/* ── Helpers ── */
function statusColor(s: BookingStatus) {
  switch (s) {
    case "pending":   return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "approved":  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "rejected":  return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
    case "cancelled": return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  }
}

function statusLabel(s: BookingStatus, t: any) {
  const map: Record<BookingStatus, string> = {
    pending: t.fbStatusPending,
    approved: t.fbStatusApproved,
    rejected: t.fbStatusRejected,
    cancelled: t.fbStatusCancelled,
  };
  return map[s] ?? s;
}

function formatDate(d: string, lang: string) {
  return new Date(d).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(t: string) {
  return t.slice(0, 5); // HH:MM
}

/* ═══════════════════════════════════════════════════════════ */
/*  Main Page                                                  */
/* ═══════════════════════════════════════════════════════════ */
export default function FacilityBookingPage() {
  const { user, isAnonymous, isAdmin, setShowLoginModal } = useAuth();
  const { t, language } = useLanguage();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [bookings, setBookings] = useState<FacilityBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Tabs
  const [tab, setTab] = useState<"facilities" | "myBookings" | "allBookings">("facilities");

  // Modals
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [deletingFacility, setDeletingFacility] = useState<Facility | null>(null);

  // QR expand state — stores the booking id whose QR is currently shown
  const [expandedQR, setExpandedQR] = useState<string | null>(null);

  // Pagination
  const PER_PAGE = 6;
  const [page, setPage] = useState(1);

  /* ── Fetch ── */
  const fetchAll = useCallback(async () => {
    try {
      const supabase = createClient();
      const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      const [facRes, bookRes] = await Promise.all([
        supabase.from("facilities").select("*").eq("is_active", true).order("name"),
        user && !isAnonymous
          ? isAdmin
            ? supabase
                .from("facility_bookings")
                .select("*, facilities:facility_id(name), profiles:booked_by(display_name)")
                // Admin: last 90 days OR still-pending (could be older)
                .or(`booking_date.gte.${since90},status.eq.pending`)
                .order("booking_date", { ascending: false })
            : supabase
                .from("facility_bookings")
                .select("*, facilities:facility_id(name)")
                .eq("booked_by", user.id)
                // User: last 90 days OR approved (future bookings always visible)
                .or(`booking_date.gte.${since90},status.eq.approved`)
                .order("booking_date", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (facRes.error) { setFetchError(facRes.error.message); return; }
      setFacilities((facRes.data as Facility[]) ?? []);
      setBookings((bookRes.data as FacilityBooking[]) ?? []);
      setFetchError(null);
    } catch {
      setFetchError("Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [user, isAnonymous, isAdmin]);

  useEffect(() => {
    fetchAll();
    const supabase = createClient();
    const channel = supabase
      .channel("facility-booking-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "facility_bookings" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "facilities" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  /* ── Booking status actions ── */
  const handleBookingAction = async (id: string, newStatus: BookingStatus, note?: string) => {
    const supabase = createClient();
    const payload: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
    if (note !== undefined) payload.admin_note = note;
    const { error } = await supabase.from("facility_bookings").update(payload).eq("id", id);
    if (error) { toast.error(error.message); return; }

    // ── Persist notification and send native push ──
    if (newStatus === "approved" || newStatus === "rejected" || (newStatus === "cancelled" && isAdmin)) {
      const booking = bookings.find((b) => b.id === id);
      if (booking && booking.booked_by !== user?.id) {
        const notifType =
          newStatus === "approved" ? "booking_approved" :
          newStatus === "cancelled" ? "booking_cancelled" :
          "booking_rejected";
        
        // 1. In-app notification
        await supabase.from("notifications").insert({
          user_id: booking.booked_by,
          type: notifType,
          payload: {
            booking_id: id,
            facility_name: booking.facilities?.name ?? "facility",
          },
        });

        // 2. Native Push Notification
        try {
          // Fetch user's tokens
          const { data: profile } = await supabase
            .from("profiles")
            .select("fcm_tokens")
            .eq("id", booking.booked_by)
            .single();

          if (profile?.fcm_tokens && profile.fcm_tokens.length > 0) {
            const title = 
              newStatus === "approved" ? "Booking Approved!" :
              newStatus === "cancelled" ? "Booking Cancelled" :
              "Booking Rejected";
            
            const body = newStatus === "approved" 
              ? `Your booking for ${booking.facilities?.name} has been approved.`
              : `There's an update regarding your booking for ${booking.facilities?.name}.`;

            await fetch("/api/notifications/push", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tokens: profile.fcm_tokens,
                title,
                body,
                data: {
                  url: "/my-bookings",
                  bookingId: id
                }
              }),
            });
          }
        } catch (pushErr) {
          console.error("Push notification failed:", pushErr);
        }
      }
    }

    toast.success(t.fbUpdated);
    fetchAll();
  };

  /* ── Delete facility (admin) ── */
  const handleDeleteFacility = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("facilities").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t.fbFacilityDeleted);
    setDeletingFacility(null);
    fetchAll();
  };

  /* ── Filtered bookings ── */
  const displayBookings = tab === "myBookings"
    ? bookings.filter((b) => b.booked_by === user?.id)
    : bookings;

  const paginatedFacilities = facilities.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const paginatedBookings = displayBookings.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="text-primary"><Building2 size={28} strokeWidth={2.5} /></div>
          <div>
            <h1 className="text-2xl font-bold text-text">{t.fbTitle}</h1>
            <p className="text-sm text-text-muted">{t.fbSubtitle}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingFacility(null); setShowFacilityModal(true); }}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> <span className="hidden sm:inline">{t.fbAddFacility}</span>
          </button>
        )}
      </div>

      {/* Login notice */}
      {isAnonymous && (
        <div className="card p-4 mb-6 flex items-center gap-3 border-l-4 border-l-primary">
          <div className="text-primary"><LogIn size={24} strokeWidth={2.5} /></div>
          <p className="text-sm text-text-secondary">{t.fbLoginNotice}</p>
        </div>
      )}

      {/* Tab pills */}
      <div className="flex gap-1.5 p-1 bg-surface-alt rounded-xl border border-border/60 mb-6 overflow-x-auto">
        {(["facilities", ...(user && !isAnonymous ? ["myBookings"] : []), ...(isAdmin ? ["allBookings"] : [])] as const).map((tb) => {
          const label =
            tb === "facilities"
              ? t.fbFacilitiesTab
              : tb === "myBookings"
              ? t.fbMyBookings
              : t.fbAllBookings;
          return (
            <button
              key={tb}
              onClick={() => { setTab(tb as any); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                tab === tb
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 gap-3 text-text-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">{t.loading}</span>
        </div>
      )}

      {/* Error */}
      {!loading && fetchError && (
        <div className="card p-8 text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-text mb-1">{t.loadFailed}</p>
          <p className="text-sm text-text-muted mb-4">{fetchError}</p>
          <button onClick={fetchAll} className="px-5 py-2 btn-primary text-sm">{t.retry}</button>
        </div>
      )}

      {/* ── Facilities Tab ── */}
      {!loading && !fetchError && tab === "facilities" && (
        <>
          {facilities.length === 0 ? (
            <div className="card p-8 text-center">
              <Building2 size={40} className="text-text-muted mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-text">{t.fbNoFacilities}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {paginatedFacilities.map((fac) => (
                <div key={fac.id} className="card p-4 flex flex-col">
                  {/* Image */}
                  {fac.image_url && (
                    <div className="rounded-xl overflow-hidden border border-border/40 mb-3 -mt-1 -mx-1">
                      <img src={fac.image_url} alt={fac.name} className="w-full h-32 object-cover" />
                    </div>
                  )}

                  <h3 className="font-semibold text-text text-sm">{fac.name}</h3>
                  {fac.description && (
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">{fac.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-text-muted">
                    {fac.location && (
                      <span className="flex items-center gap-1"><MapPin size={11} /> {fac.location}</span>
                    )}
                    {fac.capacity && (
                      <span className="flex items-center gap-1"><Users size={11} /> {t.fbCapacity(fac.capacity)}</span>
                    )}
                  </div>

                  <div className="mt-auto pt-3 flex gap-2">
                    {!isAnonymous && user && (
                      <button
                        onClick={() => { setSelectedFacility(fac); setShowBookModal(true); }}
                        className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Calendar size={13} /> {t.fbBook}
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => { setEditingFacility(fac); setShowFacilityModal(true); }}
                          className="p-2 rounded-xl border border-border hover:bg-surface-alt transition-colors"
                        >
                          <Pencil size={13} className="text-text-muted" />
                        </button>
                        <button
                          onClick={() => setDeletingFacility(fac)}
                          className="p-2 rounded-xl border border-border hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination page={page} total={facilities.length} perPage={PER_PAGE} onChange={setPage} />
        </>
      )}

      {/* ── Bookings Tab (My / All) ── */}
      {!loading && !fetchError && (tab === "myBookings" || tab === "allBookings") && (
        <>
          {displayBookings.length === 0 ? (
            <div className="card p-8 text-center">
              <Calendar size={40} className="text-text-muted mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-text">{t.fbNoBookings}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedBookings.map((b) => {
                const isOwner = b.booked_by === user?.id;
                return (
                  <div key={b.id} className={`card p-4 ${b.status === "cancelled" || b.status === "rejected" ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-text text-sm truncate">
                          {b.facilities?.name ?? "—"}
                        </h3>
                        {/* Admin: show who booked */}
                        {isAdmin && b.profiles?.display_name && (
                          <p className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                            <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                            {b.profiles.display_name}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor(b.status)}`}>
                            {statusLabel(b.status, t)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap text-[11px] text-text-muted">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(b.booking_date, language)}</span>
                      <span className="flex items-center gap-1"><Clock size={11} /> {formatTime(b.start_time)} – {formatTime(b.end_time)}</span>
                      {b.attendees > 0 && (
                        <span className="flex items-center gap-1"><Users size={11} /> {b.attendees}</span>
                      )}
                    </div>

                    {b.purpose && (
                      <p className="text-xs text-text-secondary mt-2">{b.purpose}</p>
                    )}

                    {b.admin_note && (
                      <p className="text-xs text-text-muted mt-1 italic">📝 {b.admin_note}</p>
                    )}

                    {/* ── Check-in indicator ── */}
                    {b.checked_in_at && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {t.mbCheckedIn} · {new Date(b.checked_in_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}

                    {/* ── Entry QR — approved bookings owned by current user ── */}
                    {isOwner && b.status === "approved" && (
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

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {/* Admin actions */}
                      {isAdmin && b.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleBookingAction(b.id, "approved")}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                          >
                            <CheckCircle2 size={13} /> {t.fbApprove}
                          </button>
                          <button
                            onClick={() => handleBookingAction(b.id, "rejected")}
                            className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <XCircle size={13} /> {t.fbReject}
                          </button>
                        </>
                      )}
                      {/* Admin cancel approved booking */}
                      {isAdmin && b.status === "approved" && (
                        <button
                          onClick={() => { if (window.confirm(t.fbCancelConfirm)) handleBookingAction(b.id, "cancelled"); }}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                          <XCircle size={13} /> {t.fbAdminCancel}
                        </button>
                      )}
                      {/* Owner cancel */}
                      {isOwner && !isAdmin && (b.status === "pending" || b.status === "approved") && (
                        <button
                          onClick={() => handleBookingAction(b.id, "cancelled")}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                          <XCircle size={13} /> {t.fbCancel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pagination page={page} total={displayBookings.length} perPage={PER_PAGE} onChange={setPage} />
        </>
      )}

      {/* ── Book Facility Modal ── */}
      {showBookModal && selectedFacility && (
        <BookModal
          facility={selectedFacility}
          onClose={() => { setShowBookModal(false); setSelectedFacility(null); }}
          onSaved={() => { setShowBookModal(false); setSelectedFacility(null); setTab("myBookings"); fetchAll(); }}
          t={t}
          language={language}
          userId={user?.id ?? ""}
        />
      )}

      {/* ── Facility Add/Edit Modal (Admin) ── */}
      {showFacilityModal && (
        <FacilityFormModal
          facility={editingFacility}
          onClose={() => { setShowFacilityModal(false); setEditingFacility(null); }}
          onSaved={() => { setShowFacilityModal(false); setEditingFacility(null); fetchAll(); }}
          t={t}
          language={language}
        />
      )}

      {/* ── Delete Facility Confirm ── */}
      {deletingFacility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full p-6 border border-border/60">
            <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-text text-center mb-2">{t.fbDeleteFacility}</h3>
            <p className="text-sm text-text-secondary text-center mb-6">{t.fbDeleteConfirm}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingFacility(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-alt transition-colors">
                {t.cancel}
              </button>
              <button onClick={() => handleDeleteFacility(deletingFacility.id)} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors shadow-md">
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Book Modal                                                 */
/* ═══════════════════════════════════════════════════════════ */
function BookModal({
  facility,
  onClose,
  onSaved,
  t,
  language,
  userId,
}: {
  facility: Facility;
  onClose: () => void;
  onSaved: () => void;
  t: any;
  language: string;
  userId: string;
}) {
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [purpose, setPurpose] = useState("");
  const [attendees, setAttendees] = useState(1);
  const [saving, setSaving] = useState(false);

  const minDate = new Date().toISOString().split("T")[0];

  const handleSubmit = async () => {
    if (!bookingDate || !startTime || !endTime) return;
    if (startTime >= endTime) {
      toast.error(t.fbEndTimeError);
      return;
    }
    if (facility.capacity && attendees > facility.capacity) {
      toast.error(t.fbAttendeesError);
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("facility_bookings").insert({
      facility_id: facility.id,
      booked_by: userId,
      booking_date: bookingDate,
      start_time: startTime,
      end_time: endTime,
      purpose: purpose.trim() || null,
      attendees,
    });
    if (error) {
      if (
        error.message.includes("BOOKING_OVERLAP") ||
        error.message.includes("unique") ||
        error.code === "23505"
      ) {
        toast.error(t.fbOverlapError);
      } else {
        toast.error(error.message);
      }
      setSaving(false);
      return;
    }
    toast.success(t.fbBookingSubmitted);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-border/60">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/60 sticky top-0 bg-surface z-10 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-text">{t.fbBookFacility}</h3>
            <p className="text-sm text-text-muted mt-0.5">{facility.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-alt rounded-xl transition-colors">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.fbDate}</label>
            <input
              type="date" value={bookingDate} min={minDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.fbStartTime}</label>
              <input
                type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.fbEndTime}</label>
              <input
                type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.fbPurpose}</label>
            <input
              type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)}
              placeholder={t.fbPurposePlaceholder}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              {t.fbAttendees}{facility.capacity ? <span className="ml-1 font-normal normal-case text-text-muted/70">({t.fbCapacity(facility.capacity)})</span> : ""}
            </label>
            <input
              type="number" value={attendees} min={1}
              max={facility.capacity ?? 999}
              onChange={(e) => setAttendees(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {facility.capacity && attendees > facility.capacity && (
              <p className="text-xs text-red-500 mt-1 font-medium">{t.fbAttendeesError}</p>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!bookingDate || saving}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> {t.fbSubmitting}</>
            ) : (
              <><Calendar size={16} /> {t.fbSubmitBooking}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Facility Form Modal (Admin)                                */
/* ═══════════════════════════════════════════════════════════ */
function FacilityFormModal({
  facility,
  onClose,
  onSaved,
  t,
  language,
}: {
  facility: Facility | null;
  onClose: () => void;
  onSaved: () => void;
  t: any;
  language: string;
}) {
  const isEdit = !!facility;
  const [name, setName] = useState(facility?.name ?? "");
  const [description, setDescription] = useState(facility?.description ?? "");
  const [location, setLocation] = useState(facility?.location ?? "");
  const [capacity, setCapacity] = useState(facility?.capacity ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      capacity: capacity > 0 ? capacity : null,
    };

    const { error } = isEdit
      ? await supabase.from("facilities").update(payload).eq("id", facility!.id)
      : await supabase.from("facilities").insert(payload);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    toast.success(
      isEdit ? t.fbFacilityUpdated : t.fbFacilityAdded
    );
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-border/60">
        <div className="flex items-center justify-between p-5 border-b border-border/60 sticky top-0 bg-surface z-10 rounded-t-2xl">
          <h3 className="text-lg font-bold text-text">{isEdit ? t.fbEditFacility : t.fbAddFacility}</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-alt rounded-xl transition-colors">
            <X size={18} className="text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.fbFacilityName}</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder={t.fbFacilityNamePlaceholder}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.fbFacilityDesc}</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.fbFacilityLocation}</label>
            <input
              type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder={t.fbFacilityLocPlaceholder}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.fbFacilityCapacity}</label>
            <input
              type="number" min={0} value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> {t.saving}</>
            ) : (
              isEdit ? t.save : t.fbAddFacility
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
