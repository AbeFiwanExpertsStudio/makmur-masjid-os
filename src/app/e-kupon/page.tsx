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
  ChevronDown, ChevronUp,
} from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { toast } from "react-hot-toast";
import { useLanguage } from "@/components/providers/LanguageContext";

// timeout helper
function waitMs(ms: number): Promise<null> {
  return new Promise((r) => setTimeout(() => r(null), ms));
}

export default function EKuponPage() {
  const { user, isAdmin, isAnonymous, isLoading: authLoading } = useAuth();
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

  // For guests (no session), restore claims immediately from localStorage,
  // then sync with the DB via RPC to catch scanned status updates.
  useEffect(() => {
    if (authLoading || user) return;

    // 1. Instant restore from localStorage (survives refresh with zero network call)
    try {
      const stored = localStorage.getItem("makmur_guest_claims");
      if (stored) {
        const parsed: Record<string, string> = JSON.parse(stored); // { [eventId]: claimId }
        const entries = Object.entries(parsed);
        if (entries.length > 0) {
          setClaimedIds(new Set(entries.map(([eid]) => eid)));
          const newMap = new Map<string, string>();
          entries.forEach(([eid, cid]) => newMap.set(eid, cid));
          setClaimMap(newMap);
        }
      }
    } catch { /* ignore parse errors */ }

    // 2. Sync scan status from DB (RPC — SECURITY DEFINER, no auth needed)
    const deviceUuid = typeof window !== "undefined"
      ? localStorage.getItem("makmur_guest_uuid")
      : null;
    if (!deviceUuid) return;

    const supabase = createClient();
    supabase.rpc("get_kupon_claims_by_device", { p_device_uuid: deviceUuid })
      .then(({ data, error }) => {
        if (error) { console.warn("get_kupon_claims_by_device:", error.message); return; }
        if (!data?.length) return;
        // Merge: DB is authoritative for scan status; localStorage is authoritative for claim IDs
        setClaimedIds(new Set(data.map((r: any) => r.event_id)));
        setScannedIds(new Set(data.filter((r: any) => r.is_scanned).map((r: any) => r.event_id)));
        const newMap = new Map<string, string>();
        data.forEach((r: any) => newMap.set(r.event_id, r.id));
        setClaimMap(newMap);
        // Keep localStorage in sync with canonical DB claim IDs
        const updated: Record<string, string> = {};
        data.forEach((r: any) => { updated[r.event_id] = r.id; });
        localStorage.setItem("makmur_guest_claims", JSON.stringify(updated));
      });
  }, [authLoading, user]);


  // Local copy of events so edits/deletes reflect instantly
  const [localEvents, setLocalEvents] = useState<any[]>([]);
  useEffect(() => {
    // Everyone sees only active/scheduled — expired events are hidden.
    // Sort: active events first, then scheduled (by soonest date).
    const statusOrder: Record<string, number> = { active: 0, scheduled: 1 };
    const visible = events
      .filter(e => e.status !== "expired")
      .sort((a, b) => {
        const sa = statusOrder[a.status ?? "scheduled"] ?? 1;
        const sb = statusOrder[b.status ?? "scheduled"] ?? 1;
        if (sa !== sb) return sa - sb;
        return a.event_date.localeCompare(b.event_date);
      });
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
            <div className="w-12 h-12 bg-surface-muted dark:bg-surface rounded-xl" />
            <div className="space-y-2">
              <div className="w-32 h-6 bg-surface-muted dark:bg-surface rounded-lg" />
              <div className="w-48 h-4 bg-surface-muted dark:bg-surface rounded-lg" />
            </div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="h-28 bg-surface-muted dark:bg-surface" />
          <div className="p-6 space-y-4">
            <div className="w-full h-8 bg-surface-alt dark:bg-surface-muted rounded" />
            <div className="w-full h-12 bg-surface-alt dark:bg-surface-muted rounded-xl mt-4" />
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
            <Plus size={16} /> <span className="hidden sm:inline">{t.addEKupon}</span>
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
              <p className="text-gold text-sm mt-1 font-medium">
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
                    if (newClaimId) {
                      setClaimMap(prev => new Map(prev).set(event.id, newClaimId));
                      // PERSISTENCE: ONLY save to device localStorage if the user is anonymous (Guest).
                      // Registered members (Members/Admins) ignore device storage context.
                      if (isAnonymous || !user?.email) {
                        try {
                          const stored = localStorage.getItem("makmur_guest_claims");
                          const existing: Record<string, string> = stored ? JSON.parse(stored) : {};
                          existing[event.id] = newClaimId;
                          localStorage.setItem("makmur_guest_claims", JSON.stringify(existing));
                        } catch { /* ignore */ }
                      }
                    }
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
                    // Always clean up localStorage — safe for logged-in users too
                    try {
                      const stored = localStorage.getItem("makmur_guest_claims");
                      if (stored) {
                        const existing: Record<string, string> = JSON.parse(stored);
                        delete existing[event.id];
                        localStorage.setItem("makmur_guest_claims", JSON.stringify(existing));
                      }
                    } catch { /* ignore */ }
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
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useLanguage();

  const totalPacks = event.total_capacity;
  const remainingPacks = localRemaining ?? event.remaining_capacity;
  const percentageLeft = (remainingPacks / totalPacks) * 100;
  const isScheduled = event.status === "scheduled";
  const isExpired = event.status === "expired";
  const isActive = !isScheduled && !isExpired;

  useEffect(() => {
    if (event.remaining_capacity != null && localRemaining === null) {
      setLocalRemaining(event.remaining_capacity);
    }
  }, [event.remaining_capacity, localRemaining]);

  const handleClaim = async () => {
    if (isExpired) return;
    setIsClaiming(true);
    setClaimError(null);

    const deviceUuid = (typeof window !== "undefined"
      ? localStorage.getItem("makmur_guest_uuid")
      : null) ?? undefined;

    // If not logged in, silently sign in as anonymous (no popup, instant)
    let claimUserId = user?.id;
    if (!claimUserId) {
      try {
        const { createClient: mkClient } = await import("@/lib/supabase/client");
        const { data, error } = await mkClient().auth.signInAnonymously();
        if (error || !data.user) {
          setClaimError("Unable to process claim. Please try again.");
          setIsClaiming(false);
          return;
        }
        claimUserId = data.user.id;
      } catch {
        setClaimError("Unable to process claim. Please try again.");
        setIsClaiming(false);
        return;
      }
    }

    const result = await claimKupon(event.id, claimUserId, deviceUuid);
    if (result.success) {
      onClaimSuccess(result.claimId);
      setLocalRemaining((prev) => Math.max(0, (prev ?? event.remaining_capacity) - 1));
      toast.success(t.claimedTitle);
    } else {
      // Treat duplicate constraint as success — already claimed on this device.
      // Recover the existing claimId from the SECURITY DEFINER RPC so the QR shows.
      if (result.error?.includes("already been claimed")) {
        let recoveredId: string | undefined;
        if (deviceUuid) {
          try {
            const { createClient: mkClient2 } = await import("@/lib/supabase/client");
            const { data: existing } = await mkClient2().rpc("get_kupon_claims_by_device", { p_device_uuid: deviceUuid });
            recoveredId = existing?.find((r: any) => r.event_id === event.id)?.id;
          } catch { /* ignore */ }
        }
        onClaimSuccess(recoveredId);
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
    <div className={`card overflow-hidden transition-shadow ${
      isScheduled
        ? "card-scheduled ring-1 ring-gold/35 dark:ring-gold/20 shadow-md shadow-gold/10 dark:shadow-gold/5"
        : isActive
          ? "ring-1 ring-primary/20 dark:ring-primary/30 shadow-md shadow-primary/10 dark:shadow-primary/20"
          : ""
    }`}>
      <div
        className={`p-6 text-white relative overflow-hidden ${
          isExpired
            ? "bg-gradient-to-br from-gray-600/90 to-gray-800 dark:from-gray-700 dark:to-gray-900"
            : isActive
              ? "hero-gradient"
              : "bg-gradient-to-br from-amber-500 to-amber-600"
        }`}
        style={event.background_image && !isExpired ? {
          backgroundImage: isActive
            ? `linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 100%), url(${event.background_image})`
            : `linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%), url(${event.background_image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: isActive ? "#059669" : "#d97706",
        } : undefined}
      >
        <div className="pattern-bg absolute inset-0 opacity-20" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-surface/5 rounded-full -mt-20 -mr-20 blur-2xl" />

        <div className="flex items-start justify-between relative z-10 mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Utensils size={20} />
            {event.name}
          </h2>
          <div className="flex items-center gap-2">
            <span className={`badge text-[10px] ${
              isExpired
                ? "bg-white/10 text-white/50 border border-white/10"
                : isScheduled
                  ? "bg-black/20 text-white border border-white/20 backdrop-blur-sm"
                  : "bg-white/20 text-white font-semibold backdrop-blur-sm border border-white/10"
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
        {/* Availability + conditional progress bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-text-secondary font-medium">{t.availability}</span>
            <span className="flex items-center gap-1.5">
              {isScheduled ? (
                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-gold" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-primary animate-live" />
              )}
              <span className={`font-bold ${
                isScheduled
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-primary-dark dark:text-primary-light"
              }`}>
                {remainingPacks}/{totalPacks} {t.remaining}
              </span>
            </span>
          </div>
          {/* Only show progress bar for active events */}
          {isActive && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${percentageLeft}%` }} />
            </div>
          )}
        </div>

        {claimError && (
          <div className="bg-gold-light/30 dark:bg-surface-muted border border-gold/30 text-gold-dark dark:text-gold px-4 py-3 rounded-xl mb-4 flex items-center gap-2 text-sm">
            <AlertCircle size={16} /> {claimError}
          </div>
        )}

        {!isClaimed ? (
          <button
            onClick={handleClaim}
            disabled={isClaiming || remainingPacks <= 0 || isExpired}
            className={`w-full py-4 text-base flex items-center justify-center gap-2 rounded-xl font-bold transition-all shadow-md ${
              isExpired
                ? "bg-surface-muted dark:bg-surface text-text-muted cursor-not-allowed border border-border shadow-none"
                : isScheduled
                  ? "bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/25"
                  : "bg-gradient-to-br from-primary-light to-primary hover:from-primary hover:to-primary-dark text-white hover:shadow-lg shadow-primary/20 dark:shadow-primary/30"
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
          <div className="rounded-2xl p-5 bg-primary-50/40 dark:bg-primary/10 border-2 border-primary/20 dark:border-primary/30">
            <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary-dark dark:text-primary-light bg-transparent border border-primary/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle size={14} /> {t.redeemedTitle}
              </span>
              <button className="text-primary p-1 rounded-full transition-colors">
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-4 border-t border-primary/10" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <div className="pt-4 flex flex-col items-center gap-2">
                  <p className="text-sm text-text-secondary text-center">
                    {t.redeemedMsg(event.name)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : isScheduled ? (
          /* ── RESERVED (claimed but event not active yet) ── */
          <div className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700/50 p-5 bg-transparent">
            <div className="flex items-center justify-center gap-2 cursor-pointer mb-2" onClick={() => setIsExpanded(!isExpanded)}>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#4a3b32] dark:text-amber-400 bg-transparent dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 px-3 py-1 rounded-full">{t.reservedTitle}</span>
              <button className="text-[#4a3b32] dark:text-amber-400 p-1 rounded-full transition-colors">
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            
            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-4 border-t border-border" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <div className="pt-4">
                  {/* Body */}
                  <div className="text-center">
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400 leading-relaxed">
                      {t.reservedMsg(
                        new Date(event.event_date).toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long' }),
                        event.start_time?.slice(0, 5)
                      )}
                    </p>
                    <p className="font-mono text-xs font-semibold text-text-secondary mt-3 bg-surface rounded-lg px-3 py-1.5 inline-block border border-border">ID: {claimId ? claimId.split("-")[0] : "..."}</p>
                  </div>
                  {/* Cancel Actions */}
                  <div className="mt-5 border-t border-border pt-4 flex justify-center">
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
                        className="text-xs font-bold text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 bg-white hover:bg-red-50 dark:bg-surface dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40 rounded-lg px-4 py-2.5 transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <X size={13} />{t.cancelClaim}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-primary/20 dark:border-primary/30 rounded-2xl p-5 bg-primary-50/30 dark:bg-primary/5">
            <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary-dark dark:text-primary-light bg-transparent border border-primary/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle size={14} /> {t.claimedTitle}
              </span>
              <button className="text-primary p-1 rounded-full transition-colors">
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            
            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100 mt-4 border-t border-primary/10" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="overflow-hidden">
                <div className="pt-5">
                  <div className="bg-surface dark:bg-white p-5 rounded-xl shadow-sm mx-auto w-fit">
                    <QRCode value={`makmur-kupon:${claimId ?? ""}`} size={180} level="H" fgColor="#1B6B4A" />
                  </div>
                  <p className="text-sm text-text-secondary mt-5 text-center">{t.showQrMsg}</p>
                  <p className="font-mono text-xs text-text-muted text-center mt-1">ID: {claimId ? claimId.split("-")[0] : "..."}</p>
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
                        className="text-xs font-bold text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 bg-white hover:bg-red-50 dark:bg-surface dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40 rounded-lg px-4 py-2.5 transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <X size={13} />{t.cancelClaim}
                      </button>
                    )}
                  </div>
                </div>
              </div>
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
  const [backgroundImage, setBackgroundImage] = useState<string>(event?.background_image ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(event?.background_image ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    const objectUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(objectUrl);
    setBackgroundImage(""); // will be replaced by upload URL on save
  };

  const handleRemoveImage = () => {
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
    setBackgroundImage("");
  };
  const { t } = useLanguage();

  const handleSave = async () => {
    if (!name.trim() || !date) return;

    // Validation: End must be after start
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);
    if (endDateTime <= startDateTime) {
      toast.error("End time must be strictly after start time");
      return;
    }

    setSaving(true);
    setSaveError(null);
    const supabase = createClient();

    try {
      // ── Upload image if a new file was picked ──
      let finalBgImage: string | null = backgroundImage.trim() || null;
      if (imageFile) {
        setIsUploading(true);
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `food-events/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase
          .storage
          .from("campaigns")
          .upload(fileName, imageFile);
        setIsUploading(false);
        if (uploadError) {
          console.warn("Image upload error:", uploadError.message);
          // proceed without image rather than blocking the save
        } else if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from("campaigns").getPublicUrl(fileName);
          finalBgImage = publicUrl;
        }
      }

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
              background_image: finalBgImage,
            })
            .eq("id", event.id),
          waitMs(6000),
        ]);
        if (result && "error" in result && result.error) {
          console.warn("Update error:", result.error.message);
        }
        onSave({ ...event, name: name.trim(), location: location.trim(), total_capacity: parseInt(capacity) || 500, event_date: date, start_time: startTime + ":00", end_time: endTime + ":00", background_image: finalBgImage });

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
              background_image: finalBgImage,
            })
            .select("id")
            .single(),
          waitMs(6000),
        ]);
        if (result && "error" in result && result.error) {
          console.warn("Insert error:", result.error.message);
        } else {
          // ── Native Push Notification for New Kupon ──
          try {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("fcm_tokens")
              .not("fcm_tokens", "is", null);

            if (profiles) {
              const allTokens = profiles.flatMap(p => p.fcm_tokens || []).filter(Boolean);
              if (allTokens.length > 0) {
                await fetch("/api/notifications/push", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    tokens: allTokens,
                    title: "New Food Coupon Available!",
                    body: `Grab your spot for "${name.trim()}" at ${location.trim()}.`,
                    data: { url: "/e-kupon" }
                  }),
                });
              }
            }
          } catch (pushErr) {
            console.error("Kupon push failed:", pushErr);
          }
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

              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">
                  Card Background Image
                  <span className="text-text-muted font-normal normal-case tracking-normal ml-1">(optional)</span>
                </label>
                {imagePreview ? (
                  /* Preview with remove button */
                  <div className="relative rounded-xl overflow-hidden h-28 border border-border group">
                    <img
                      src={imagePreview}
                      alt="background preview"
                      className="w-full h-full object-cover"
                    />
                    {/* auto gradient preview overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-500 text-white rounded-full flex items-center justify-center transition-all"
                    >
                      <X size={13} />
                    </button>
                    <span className="absolute bottom-2 left-2 text-[10px] font-bold text-white/80 bg-black/40 px-2 py-0.5 rounded-full">
                      {imageFile ? imageFile.name : "Current image"}
                    </span>
                  </div>
                ) : (
                  /* Upload drop zone */
                  <label className="flex flex-col items-center justify-center gap-2 h-20 border-2 border-dashed border-border hover:border-gold rounded-xl cursor-pointer bg-surface-muted/40 hover:bg-gold/5 transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImagePick}
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span className="text-xs text-text-muted">Click to upload image</span>
                  </label>
                )}
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
                    min={new Date().toISOString().split('T')[0]}
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
                disabled={saving || isUploading || !name.trim() || !date}
                className="w-full py-3.5 btn-primary text-sm mt-2 flex items-center justify-center gap-2"
              >
                {(saving || isUploading) && <Loader2 size={15} className="animate-spin" />}
                {isUploading ? "Uploading image…" : saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create E-Kupon Event")}
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

        <div className="bg-red-50 dark:bg-red-950/60 border-b border-red-100 dark:border-red-900/50 p-5 flex items-center justify-between">
          <div className="flex gap-3 items-center">
            <AlertTriangle className="text-red-500 dark:text-red-400" />
            <div>
          <h2 className="font-bold text-red-900 dark:text-red-200">{t.deleteEKuponTitle}</h2>
            </div>
          </div>
          <button onClick={onClose} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-100 dark:bg-red-900/40 p-1 rounded-md"><X size={18} /></button>
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
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-red-500/20"
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
