"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { useLiveFoodEvents } from "@/hooks/useLiveFoodEvents";
import { claimKupon } from "@/lib/mutations/claims";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import {
  Utensils, Clock, MapPin, CheckCircle, AlertCircle, Ticket,
  Plus, X, CalendarPlus, Pencil, Trash2, AlertTriangle, Loader2,
} from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { toast } from "react-hot-toast";
import { useLanguage } from "@/components/providers/LanguageContext";

// timeout helper
function waitMs(ms: number): Promise<null> {
  return new Promise((r) => setTimeout(() => r(null), ms));
}

export default function EKuponPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { events, isLoading: eventsLoading } = useLiveFoodEvents();
  const { t } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<any | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const [claimMap, setClaimMap] = useState<Map<string, string>>(new Map());

  const EVENTS_PER_PAGE = 4;
  const [eventsPage, setEventsPage] = useState(1);

  // Fetch user's existing kupon claims
  const fetchMyClaims = async (userId: string) => {
    try {
      const supabase = createClient();
      // Ensure session is active before querying so RLS auth.uid() resolves correctly
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("kupon_claims")
        .select("id, event_id, is_scanned")
        .eq("guest_uuid", userId);

      if (error) {
        console.warn("fetchMyClaims error:", error.message);
        return;
      }

      if (data) {
        setClaimedIds(new Set(data.map((r: any) => r.event_id)));
        setScannedIds(new Set(data.filter((r: any) => r.is_scanned).map((r: any) => r.event_id)));
        const newMap = new Map<string, string>();
        data.forEach((r: any) => newMap.set(r.event_id, r.id));
        setClaimMap(newMap);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (user) {
      fetchMyClaims(user.id);

      // Setup a background poll to check for scan status changes
      const scanPollInterval = setInterval(() => {
        fetchMyClaims(user.id);
      }, 5000);

      return () => clearInterval(scanPollInterval);
    }
  }, [user]);


  // Local copy of events so edits/deletes reflect instantly
  const [localEvents, setLocalEvents] = useState<any[]>([]);
  useEffect(() => {
    // Everyone sees only active/scheduled — expired events are hidden.
    // Admins can still edit/delete via the inline buttons on each card.
    const visible = events.filter(e => e.status !== "expired");
    setLocalEvents(visible);
    setEventsPage(1); // reset to first page when events change
  }, [events, isAdmin]);

  const isLoading = eventsLoading;

  const handleEventUpdated = (updated: any) => {
    setLocalEvents((prev) => prev.map((e) => e.id === updated.id ? { ...e, ...updated } : e));
  };

  const handleEventDeleted = (deletedId: string) => {
    setLocalEvents((prev) => prev.filter((e) => e.id !== deletedId));
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl animate-pulse">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="space-y-2">
              <div className="w-32 h-6 bg-gray-200 rounded-lg" />
              <div className="w-48 h-4 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="h-28 bg-gray-200" />
          <div className="p-6 space-y-4">
            <div className="w-full h-8 bg-gray-100 rounded" />
            <div className="w-full h-12 bg-gray-100 rounded-xl mt-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="text-primary"><Ticket size={28} strokeWidth={2.5} /></div>
          <div>
              <h1 className="text-2xl font-bold text-text">{t.ekuponTitle}</h1>
              <p className="text-sm text-text-muted">{t.ekuponSubtitle}</p>
            </div>
          </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> {t.addEKupon}
          </button>
        )}
      </div>

      {/* Main List */}
      <div className="space-y-6">
        {localEvents.length === 0 ? (
          <div className="text-center py-10 bg-surface rounded-2xl border border-border shadow-sm">
            <Ticket size={48} className="mx-auto text-text-muted opacity-30 mb-4" />
            <h3 className="text-text font-bold text-lg">{t.noEventsTitle}</h3>
            {isAdmin && events.some(e => e.status === "expired") ? (
              <p className="text-amber-600 text-sm mt-1 font-medium">
                {t.noEventsExpired}
              </p>
            ) : (
              <p className="text-text-secondary text-sm mt-1">{t.noEventsEmpty}</p>
            )}
          </div>
        ) : (
          <>
            {localEvents
              .slice((eventsPage - 1) * EVENTS_PER_PAGE, eventsPage * EVENTS_PER_PAGE)
              .map(event => (
                <KuponCard
                  key={event.id}
                  event={event}
                  user={user}
                  isAdmin={isAdmin}
                  isClaimed={claimedIds.has(event.id)}
                  isScanned={scannedIds.has(event.id)}
                  claimId={claimMap.get(event.id)}
                  onClaimSuccess={(newClaimId) => {
                    setClaimedIds(prev => new Set(prev).add(event.id));
                    if (newClaimId) setClaimMap(prev => new Map(prev).set(event.id, newClaimId));
                  }}
                  onDeclaimSuccess={() => {
                    setClaimedIds(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(event.id);
                      return newSet;
                    });
                    setClaimMap(prev => {
                      const newMap = new Map(prev);
                      newMap.delete(event.id);
                      return newMap;
                    });
                  }}
                  onEdit={() => setEditingEvent(event)}
                  onDelete={() => setDeletingEvent(event)}
                />
              ))}
            <Pagination
              page={eventsPage}
              total={localEvents.length}
              perPage={EVENTS_PER_PAGE}
              onChange={setEventsPage}
            />
          </>
        )}
      </div>

      {/* ═══ Modals ═══ */}
      {showAddModal && <EKuponFormModal mode="add" onClose={() => setShowAddModal(false)} onSave={() => { }} />}
      {editingEvent && (
        <EKuponFormModal
          mode="edit"
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleEventUpdated}
        />
      )}
      {deletingEvent && (
        <DeleteEKuponModal
          event={deletingEvent}
          onClose={() => setDeletingEvent(null)}
          onDelete={handleEventDeleted}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────── */
/*  Kupon Card                                     */
/* ─────────────────────────────────────────────── */
function KuponCard({
  event, user, isAdmin, isClaimed, isScanned, claimId, onClaimSuccess, onDeclaimSuccess, onEdit, onDelete,
}: {
  event: any;
  user: any;
  isAdmin: boolean;
  isClaimed: boolean;
  isScanned: boolean;
  claimId?: string;
  onClaimSuccess: (id?: string) => void;
  onDeclaimSuccess: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isDeclaiming, setIsDeclaiming] = useState(false);
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const [confirmDeclaim, setConfirmDeclaim] = useState(false);
  const { t } = useLanguage();

  const eventId = event.id;
  const totalPacks = event.total_capacity;
  const remainingPacks = localRemaining ?? event.remaining_capacity;
  const percentageLeft = (remainingPacks / totalPacks) * 100;
  const isScheduled = event.status === "scheduled";
  const isExpired = event.status === "expired";

  useEffect(() => {
    if (event.remaining_capacity != null && localRemaining === null) {
      setLocalRemaining(event.remaining_capacity);
    }
  }, [event.remaining_capacity, localRemaining]);

  const handleClaim = async () => {
    if (!user || isExpired) return;
    setIsClaiming(true);
    setClaimError(null);
    const result = await claimKupon(event.id, user.id);
    if (result.success) {
      onClaimSuccess(result.claimId);
      setLocalRemaining((prev) => Math.max(0, (prev ?? event.remaining_capacity) - 1));
      toast.success(t.claimedTitle);
    } else {
      // Supabase duplicate error returns 23505 — treat as success if already claimed
      if (result.error === "You have already claimed this kupon.") {
        onClaimSuccess(result.claimId);
      } else {
        setClaimError(result.error ?? "Failed to claim kupon.");
        toast.error(result.error ?? "Failed to claim kupon.");
      }
    }
    setIsClaiming(false);
  };

  const handleDeclaim = async () => {
    if (!claimId) {
      setClaimError("Missing Kupon ID.");
      return;
    }

    setIsDeclaiming(true);
    setConfirmDeclaim(false);
    setClaimError(null);

    // In claim.ts we have cancelKupon
    const { cancelKupon } = await import("@/lib/mutations/claims");
    const result = await cancelKupon(claimId);

    if (result.success) {
      onDeclaimSuccess();
      setLocalRemaining((prev) => Math.min(totalPacks, (prev ?? event.remaining_capacity) + 1));
      toast.success(t.cancelGigSuccess);
    } else {
      setClaimError(result.error ?? t.cancelGigFail);
      toast.error(result.error ?? t.cancelGigFail);
    }
    setIsDeclaiming(false);
  };

  return (
    <div className="card overflow-hidden">
      {/* Event header */}
      <div className={`p-6 text-white relative overflow-hidden ${
        isExpired ? "bg-gradient-to-br from-gray-500 to-gray-700"
        : isScheduled ? "bg-gradient-to-br from-[#D4A843] to-[#B08A2E]"
        : "hero-gradient"
      }`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-surface/5 rounded-full -mt-20 -mr-20 blur-2xl" />

        <div className="flex items-start justify-between relative z-10 mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Utensils size={20} />
            {event.name}
          </h2>
          <div className="flex items-center gap-2">
            <span className={`badge text-[10px] ${
              isExpired ? "bg-surface/20 text-white/70"
              : isScheduled ? "bg-surface/20 text-white"
              : "bg-primary-50 text-primary"
            }`}>
            {isExpired ? "EXPIRED" : isScheduled ? t.statusScheduled : t.statusActive}
            </span>

            {/* ── ADMIN: Edit & Delete ── */}
            {isAdmin && (
              <>
                <button
                  onClick={onEdit}
                  title="Edit event"
                  className="w-8 h-8 rounded-lg bg-surface/15 hover:bg-surface/30 flex items-center justify-center text-white transition-all"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={onDelete}
                  title="Delete event"
                  className="w-8 h-8 rounded-lg bg-surface/15 hover:bg-red-400/60 flex items-center justify-center text-white transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2 relative z-10 text-white/80">
          <div className="flex items-center gap-2 text-sm"><Clock size={14} /> {new Date(event.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} ({event.start_time?.slice(0, 5)} - {event.end_time?.slice(0, 5)})</div>
          <div className="flex items-center gap-2 text-sm"><MapPin size={14} /> {event.location || "Primary Distribution Center"}</div>
        </div>
      </div>

      <div className="p-6">
        {/* Live counter */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text-secondary font-medium">{t.availability}</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${remainingPacks < 100 ? "bg-amber-500" : "bg-primary"} ${!isScheduled && !isExpired && "animate-live"}`} />
              <span className={`font-bold ${remainingPacks < 100 ? "text-amber-600" : "text-primary"}`}>
                {remainingPacks}/{totalPacks} {t.remaining}
              </span>
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${percentageLeft}%` }} />
          </div>
        </div>

        {claimError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2 text-sm">
            <AlertCircle size={16} /> {claimError}
          </div>
        )}

        {!isClaimed ? (
          <button
            onClick={handleClaim}
            disabled={isClaiming || remainingPacks <= 0 || isExpired}
            className={`w-full py-4 text-base flex items-center justify-center gap-2 rounded-xl font-bold transition-all shadow-md ${
              isExpired
                ? "bg-surface-muted text-text-muted cursor-not-allowed border border-border shadow-none"
                : isScheduled
                  ? "bg-amber-500 hover:bg-amber-600 text-white hover:shadow-lg"
                  : "bg-primary text-white hover:bg-primary-dark hover:shadow-lg"
            }`}
          >
            {isExpired ? <Clock size={20} /> : isScheduled ? <CalendarPlus size={20} /> : <Utensils size={20} />}
            {isExpired
              ? t.eventEnded
              : isScheduled
                ? isClaiming ? t.reserving : t.reserveSpot
                : isClaiming ? t.claiming : t.claimNow}
          </button>
        ) : isScanned ? (
          /* ── REDEEMED STATE ── */
          <div className="rounded-2xl p-6 bg-primary-50/40 dark:bg-primary/10 border-2 border-primary/20">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                <CheckCircle size={30} className="text-primary" />
              </div>
              <p className="font-bold text-primary text-base">{t.redeemedTitle}</p>
              <p className="text-sm text-text-secondary text-center">
                {t.redeemedMsg(event.name)}
              </p>
            </div>
          </div>
        ) : isScheduled ? (
          /* ── RESERVED (claimed but event not active yet) ── */
          <div className="rounded-2xl p-5 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700/40">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mb-1">
                <Clock size={24} className="text-amber-600" />
              </div>
              <p className="font-bold text-amber-700 dark:text-amber-400">{t.reservedTitle}</p>
              <p className="text-sm text-amber-700/80 dark:text-amber-400/80">
                {t.reservedMsg(
                  new Date(event.event_date).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' }),
                  event.start_time?.slice(0, 5)
                )}
              </p>
              <p className="text-xs text-amber-600/70 mt-1">ID: {claimId ? claimId.split("-")[0] : user?.id.split("-")[0]}</p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-[#D5F5E3] rounded-2xl p-6 bg-primary-50/50">
            <div className="flex items-center justify-center gap-2 mb-5">
              <CheckCircle size={18} className="text-primary" />
              <span className="font-bold text-primary">{t.claimedTitle}</span>
            </div>
            <div className="bg-surface p-5 rounded-xl shadow-sm mx-auto w-fit">
              <QRCode value={`makmur-kupon:${claimId || user?.id}`} size={180} level="H" fgColor="#1B6B4A" />
            </div>
            <p className="text-sm text-text-secondary mt-5 text-center">{t.showQrMsg}</p>
            <p className="font-mono text-xs text-text-muted text-center mt-1">ID: {claimId ? claimId.split("-")[0] : user?.id.split("-")[0]}</p>
            <div className="mt-4 border-t border-border pt-4 flex justify-center">
              {confirmDeclaim ? (
                <div className="flex flex-col items-center gap-3 w-full">
                  <p className="text-xs text-text-secondary text-center">{t.cancelConfirmMsg}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDeclaim(false)}
                      className="text-xs font-semibold text-text-secondary border border-border bg-surface hover:bg-surface-muted rounded-lg px-4 py-2 transition-all"
                    >
                      {t.keep}
                    </button>
                    <button
                      onClick={handleDeclaim}
                      disabled={isDeclaiming}
                      className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg px-4 py-2 transition-all"
                    >
                      {isDeclaiming ? t.canceling : t.yesCancel}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeclaim(true)}
                  disabled={isDeclaiming}
                  className="text-xs font-semibold text-red-500 hover:text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-2 transition-all"
                >
                  {t.cancelClaim}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── */
/*  Add / Edit E-Kupon Modal                       */
/* ─────────────────────────────────────────────── */
function EKuponFormModal({
  mode, event, onClose, onSave,
}: {
  mode: "add" | "edit";
  event?: any;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const isEdit = mode === "edit";
  const [name, setName] = useState(event?.name ?? "");
  const [capacity, setCapacity] = useState(String(event?.total_capacity ?? 500));
  const [location, setLocation] = useState(event?.location ?? "Primary Distribution Center");
  const [date, setDate] = useState(event?.event_date ?? new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState(event?.start_time?.slice(0, 5) ?? "17:00");
  const [endTime, setEndTime] = useState(event?.end_time?.slice(0, 5) ?? "19:00");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleSave = async () => {
    if (!name.trim() || !date) return;
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();

    try {
      if (isEdit && event) {
        // ── UPDATE ──
        const result = await Promise.race([
          supabase
            .from("food_events")
            .update({
              name: name.trim(),
              location: location.trim(),
              total_capacity: parseInt(capacity) || 500,
              event_date: date,
              start_time: startTime + ":00",
              end_time: endTime + ":00",
            })
            .eq("id", event.id),
          waitMs(6000),
        ]);
        if (result && "error" in result && result.error) {
          console.warn("Update error:", result.error.message);
        }
        onSave({ ...event, name: name.trim(), location: location.trim(), total_capacity: parseInt(capacity) || 500, event_date: date, start_time: startTime + ":00", end_time: endTime + ":00" });

      } else {
        // ── INSERT ──
        const result = await Promise.race([
          supabase
            .from("food_events")
            .insert({
              name: name.trim(),
              location: location.trim(),
              total_capacity: parseInt(capacity) || 500,
              remaining_capacity: parseInt(capacity) || 500,
              event_date: date,
              start_time: startTime + ":00",
              end_time: endTime + ":00",
            })
            .select("id")
            .single(),
          waitMs(6000),
        ]);
        if (result && "error" in result && result.error) {
          console.warn("Insert error:", result.error.message);
        }
        onSave({});
      }

      setSuccess(true);
      setTimeout(() => onClose(), 1400);
      toast.success(isEdit ? t.eventUpdated : t.ekuponCreated);
    } catch (err: any) {
      setSaveError(err?.message ?? "Unexpected error.");
      toast.error(err?.message ?? "Unexpected error."); // Added toast
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white/50 hover:text-white transition bg-black/20 rounded-full p-1">
          <X size={20} />
        </button>

        {/* Header */}
        <div className="hero-gradient p-5 text-white overflow-hidden rounded-t-2xl relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-surface/5 rounded-full -mt-16 -mr-16 blur-2xl" />
          <div className="flex items-center gap-3 relative z-10">
            {isEdit ? <Pencil size={20} /> : <CalendarPlus size={22} />}
            <div>
              <h2 className="text-lg font-bold">{isEdit ? t.modalEditTitle : t.modalAddTitle}</h2>
              <p className="text-white/60 text-xs mt-0.5">
                {isEdit ? t.modalEditSubtitle : t.modalAddSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle size={52} className="text-primary mx-auto mb-3" />
              <p className="font-bold text-text text-lg">{isEdit ? t.eventUpdated : t.ekuponCreated}</p>
              <p className="text-sm text-text-muted mt-1">{isEdit ? t.changesSaved : t.usersCanClaim}</p>
            </div>
          ) : (
            <>
              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={15} /> {saveError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.fieldFoodName}</label>
                <input
                  type="text" placeholder="e.g., Nasi Briyani Kambing" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.fieldLocation}</label>
                <input
                  type="text" placeholder="e.g., Primary Distribution Center" value={location} onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.fieldCapacity}</label>
                  <input
                    type="number" placeholder="500" value={capacity} onChange={(e) => setCapacity(e.target.value)} min="1"
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.fieldDate}</label>
                  <input
                    type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.fieldStartTime}</label>
                  <input
                    type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.fieldEndTime}</label>
                  <input
                    type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !date}
                className="w-full py-3.5 btn-primary text-sm mt-2 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create E-Kupon Event")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── */
/*  Delete Confirmation Modal                      */
/* ─────────────────────────────────────────────── */
function DeleteEKuponModal({
  event, onClose, onDelete,
}: {
  event: any;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const { t } = useLanguage();

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    await Promise.race([
      supabase.from("food_events").delete().eq("id", event.id),
      waitMs(5000),
    ]);
    onDelete(event.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>

        <div className="bg-red-50 dark:bg-red-950 border-b border-red-100 dark:border-red-900 p-5 flex items-center justify-between">
          <div className="flex gap-3 items-center">
            <AlertTriangle className="text-red-500" />
            <div>
          <h2 className="font-bold text-red-900 dark:text-red-200">{t.deleteEKuponTitle}</h2>
            </div>
          </div>
          <button onClick={onClose} className="text-red-500 hover:text-red-700 bg-red-100 p-1 rounded-md"><X size={18} /></button>
        </div>

        <div className="p-6">
          <p className="text-sm text-text-secondary mb-1">{t.deleteConfirmPrefix}</p>
          <p className="font-bold text-text bg-background border border-border rounded-xl px-4 py-3 text-sm mb-5">
            &ldquo;{event.name}&rdquo;
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 btn-outline text-sm font-bold rounded-xl">
              {t.cancel}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {deleting ? t.deleting : t.deleteEvent}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
