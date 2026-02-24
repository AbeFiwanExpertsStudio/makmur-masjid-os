"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { claimGig, cancelGig } from "@/lib/mutations/claims";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useState } from "react";
import {
  Users, Clock, CheckCircle, AlertCircle, LogIn,
  Briefcase, Plus, X, Pencil, Trash2, AlertTriangle, Loader2, Star,
} from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import { toast } from "react-hot-toast";
import { useLanguage } from "@/components/providers/LanguageContext";

type Gig = {
  id: string;
  title: string;
  description: string;
  required_pax: number;
  claimed: number;
  gig_date: string;
  start_time: string;
  end_time: string;
};

// No hardcoded fallback — all gigs come from Supabase.
// If the DB is empty or all gigs are claimed, the UI will say so.

// Resolves after `ms` milliseconds — used to race against Supabase calls
function waitMs(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

/* ─────────────────────────────────── */
/*  Main Page                          */
/* ─────────────────────────────────── */
export default function GigsPage() {
  const { user, isAnonymous, isAdmin, setShowLoginModal } = useAuth();
  const { t, language } = useLanguage();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loadingGigs, setLoadingGigs] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [deletingGig, setDeletingGig] = useState<Gig | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const GIGS_PER_PAGE = 5;
  const [gigsPage, setGigsPage] = useState(1);

  /* ── Fetch user's existing claims (persists across refresh) ── */
  const fetchMyClaims = async (userId: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("gig_claims")
        .select("gig_id")
        .eq("guest_uuid", userId);
      if (data && data.length > 0) {
        setClaimedIds(new Set(data.map((r: any) => r.gig_id)));
      }
    } catch {
      // Non-critical — claimed state just won't pre-populate
    }
  };

  /* ── Fetch gigs from Supabase on mount ── */
  const fetchGigs = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("volunteer_gigs")
        .select(`id, title, description, required_pax, gig_date, start_time, end_time, created_at, gig_claims(count)`)
        .order("gig_date", { ascending: true });

      if (error) {
        console.warn("Could not load gigs:", error.message);
        setFetchError(error.message);
        setGigs([]);
      } else {
        setFetchError(null);
        // Map DB rows to Gig type
        const mapped: Gig[] = (data ?? []).map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description ?? "",
          required_pax: row.required_pax,
          claimed: row.gig_claims?.[0]?.count ?? 0,
          gig_date: row.gig_date ?? new Date().toISOString().split('T')[0],
          start_time: row.start_time ?? '19:00',
          end_time: row.end_time ?? '21:00',
        }));
        setGigs(mapped);
      }
    } catch {
      setGigs([]);
    } finally {
      setLoadingGigs(false);
    }
  };

  useEffect(() => {
    fetchGigs();
    if (user && !user.is_anonymous) {
      fetchMyClaims(user.id);
      // Fetch user points
      (async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from('user_roles')
          .select('total_points')
          .eq('user_id', user.id)
          .single();
        if (data) setMyPoints(data.total_points ?? 0);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Live clock for countdowns (ticks every second)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* ── Claim ── */
  const handleClaim = async (gigId: string) => {
    if (isAnonymous) { setShowLoginModal(true); return; }
    if (!user) return;
    const result = await claimGig(gigId, user.id);
    if (result.success) {
      setClaimedIds((prev) => new Set(prev).add(gigId));
      setGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, claimed: g.claimed + 1 } : g));
      toast.success(t.claimGigSuccess);
    } else {
      toast.error(result.error ?? t.claimGigFail);
    }
  };

  /* ── Cancel ── */
  const handleCancel = async (gigId: string) => {
    if (!user) return;
    setCancellingId(gigId);
    const result = await cancelGig(gigId, user.id);
    if (result.success) {
      setClaimedIds((prev) => { const s = new Set(prev); s.delete(gigId); return s; });
      setGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, claimed: Math.max(0, g.claimed - 1) } : g));
      toast.success(t.cancelGigSuccess);
    } else {
      toast.error(result.error ?? t.cancelGigFail);
    }
    setCancellingId(null);
  };

  /* ── After add/edit: refresh from DB so list is always accurate ── */
  const handleAddGig = (newGig: Gig) => {
    // Add immediately to local state for instant feedback
    setGigs((prev) => [newGig, ...prev]);
    // Then re-fetch from DB in background to sync
    setTimeout(() => fetchGigs(), 1500);
  };

  const handleUpdateGig = (updated: Gig) => {
    setGigs((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    setTimeout(() => fetchGigs(), 1500);
  };

  const handleDeleteGig = (deletedId: string) => {
    setGigs((prev) => prev.filter((g) => g.id !== deletedId));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="text-primary"><Briefcase size={28} strokeWidth={2.5} /></div>
          <div>
            <h1 className="text-2xl font-bold text-text">{t.gigsTitle}</h1>
            <p className="text-sm text-text-muted">{t.gigsSubtitle}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> {language === 'ms' ? 'Tambah Gig' : 'Add Gig'}
          </button>
        )}
      </div>

      {/* User points card */}
      {!isAnonymous && user && (
        <div className="card p-4 mb-6 flex items-center gap-4 border-l-4 border-l-gold">
          <div className="w-10 h-10 rounded-xl bg-gold-light/20 flex items-center justify-center">
            <Star size={20} className="text-gold fill-gold" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">{t.gigsMyPoints}</p>
            <p className="text-2xl font-bold text-text">{myPoints.toLocaleString()} <span className="text-sm font-normal text-text-muted">pts</span></p>
          </div>
          <div className="ml-auto text-xs text-text-muted max-w-[140px] text-right">
            {t.gigsPointsDesc}
          </div>
        </div>
      )}

      {/* Login notice */}
      {isAnonymous && (
        <div className="card p-4 mb-6 flex items-center gap-3 border-l-4 border-l-primary">
          <div className="text-primary"><LogIn size={24} strokeWidth={2.5} /></div>
          <p className="text-sm text-text-secondary">{t.gigsLoginNotice}</p>
        </div>
      )}

      {/* Loading state */}
      {loadingGigs && (
        <div className="flex items-center justify-center py-12 gap-3 text-text-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">{t.loading}</span>
        </div>
      )}

      {/* Error state */}
      {!loadingGigs && fetchError && (
        <div className="card p-8 text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-text mb-1">{t.loadFailed ?? "Failed to load"}</p>
          <p className="text-sm text-text-muted mb-4">{fetchError}</p>
          <button onClick={fetchGigs} className="px-5 py-2 btn-primary text-sm">{t.retry ?? "Retry"}</button>
        </div>
      )}

      {/* Gig cards */}
      {!loadingGigs && (() => {
        // Filter out past gigs (end_time has passed)
        const activeGigs = gigs.filter(g => {
          const gigEnd = new Date(`${g.gig_date}T${g.end_time}`);
          return currentTime < gigEnd;
        });
        const allClaimed = activeGigs.length > 0 && activeGigs.every((g) => g.claimed >= g.required_pax);
        const isEmpty = activeGigs.length === 0;

        if (isEmpty || allClaimed) {
          return (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-primary" />
              </div>
              <h3 className="font-bold text-text text-lg mb-2">
                {allClaimed ? t.gigsAllClaimed : t.gigsNoAvailable}
              </h3>
              <p className="text-sm text-text-muted max-w-xs mx-auto">
                {allClaimed
                  ? t.gigsAllClaimedDesc
                  : isAdmin
                    ? t.gigsNoAvailableAdmin
                    : t.gigsNoAvailableUser}
              </p>
            </div>
          );
        }

        const pagedGigs = activeGigs.slice(
          (gigsPage - 1) * GIGS_PER_PAGE,
          gigsPage * GIGS_PER_PAGE
        );

        return (
          <div className="space-y-4">
            {pagedGigs.map((gig) => {
              const isFull = gig.claimed >= gig.required_pax;
              const isClaimed = claimedIds.has(gig.id);

              // Check if this gig's time overlaps with any other gig the user already claimed
              const gigStartDt = new Date(`${gig.gig_date}T${gig.start_time}`);
              const gigEndDt   = new Date(`${gig.gig_date}T${gig.end_time}`);
              const conflictingGig = !isClaimed ? gigs.find(g =>
                g.id !== gig.id &&
                claimedIds.has(g.id) &&
                g.gig_date === gig.gig_date &&
                new Date(`${g.gig_date}T${g.start_time}`) < gigEndDt &&
                new Date(`${g.gig_date}T${g.end_time}`)   > gigStartDt
              ) : undefined;
              const isConflict = !!conflictingGig;

              const pct = Math.min(100, Math.round((gig.claimed / gig.required_pax) * 100));
              const gigStart = new Date(`${gig.gig_date}T${gig.start_time}`);
              const gigEnd = new Date(`${gig.gig_date}T${gig.end_time}`);
              const isOngoing = currentTime >= gigStart && currentTime < gigEnd;
              const isUpcoming = currentTime < gigStart;

              // Countdown calculation
              let countdownLabel = "";
              if (isOngoing) {
                const diff = Math.max(0, Math.floor((gigEnd.getTime() - currentTime.getTime()) / 1000));
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                countdownLabel = `Ends in ${h > 0 ? h + "h " : ""}${m}m ${s}s`;
              } else if (isUpcoming) {
                const diff = Math.max(0, Math.floor((gigStart.getTime() - currentTime.getTime()) / 1000));
                const d = Math.floor(diff / 86400);
                const h = Math.floor((diff % 86400) / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                if (d > 0) {
                  countdownLabel = `Starts in ${d}d ${h}h`;
                } else {
                  countdownLabel = `Starts in ${h > 0 ? h + "h " : ""}${m}m ${s}s`;
                }
              }
              return (
                <div key={gig.id} className="card p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-text pr-2">{gig.title}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`badge ${isFull ? "bg-gold-light/40 text-gold-dark dark:bg-surface-muted dark:text-gold" : "bg-primary-50 dark:bg-primary/10 text-primary"}`}>
                        <Users size={12} /> {gig.claimed}/{gig.required_pax}
                      </span>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setEditingGig(gig)}
                            title="Edit gig"
                            className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-text-secondary hover:bg-primary-50 hover:text-primary hover:border-primary transition-all"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingGig(gig)}
                            title="Delete gig"
                            className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-text-secondary hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-text-secondary mb-3">{gig.description}</p>
                  <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
                    <Clock size={13} /> {new Date(gig.gig_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} · {gig.start_time?.slice(0,5)} – {gig.end_time?.slice(0,5)}
                    {countdownLabel && (
                      <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-md ${isOngoing ? "bg-gold-light/40 text-gold-dark dark:bg-surface-muted dark:text-gold" : "bg-primary-50 dark:bg-primary/10 text-primary"}`}>
                        {countdownLabel}
                      </span>
                    )}
                  </div>
                  <div className="progress-bar mb-4">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: isFull ? "#D4A843" : undefined }} />
                  </div>

                  {/* Claim / Cancel buttons */}
                  {isClaimed ? (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 py-3 btn-primary text-sm flex items-center justify-center gap-2 opacity-80 cursor-default">
                        <CheckCircle size={15} /> Claimed ✓
                      </div>
                      {isOngoing ? (
                        <span className="w-10 h-10 rounded-xl bg-gold-light/40 dark:bg-surface-muted flex items-center justify-center shrink-0" title="In Progress">
                          <Clock size={16} className="text-gold-dark dark:text-gold" />
                        </span>
                      ) : cancelConfirmId === gig.id ? null : (
                        <button
                          onClick={() => setCancelConfirmId(gig.id)}
                          title="Cancel your claim"
                          className="w-10 h-10 rounded-xl bg-transparent border border-transparent flex items-center justify-center text-text-muted hover:bg-red-50 hover:text-red-500 hover:border-red-200 dark:hover:bg-red-900/30 transition-all shrink-0"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleClaim(gig.id)}
                      disabled={isFull || isConflict}
                      className={`w-full py-3 text-sm flex items-center justify-center gap-2 rounded-xl font-semibold transition-all ${
                        isConflict
                          ? 'bg-gold-light/20 text-gold-dark border border-gold/30 cursor-not-allowed dark:bg-surface-muted dark:text-gold dark:border-gold/20'
                          : 'btn-primary'
                      }`}
                      title={isConflict ? `Overlaps with "${conflictingGig?.title}"` : undefined}
                    >
                      {isConflict ? <AlertCircle size={16} /> : isAnonymous ? <LogIn size={16} /> : <Users size={16} />}
                      {isFull ? (language === 'ms' ? 'Penuh' : 'Fully Booked') : isConflict ? `Clashes with "${conflictingGig?.title}"` : isAnonymous ? t.signIn : t.claimGig}
                    </button>
                  )}
                </div>
              );
            })}
            <Pagination
              page={gigsPage}
              total={activeGigs.length}
              perPage={GIGS_PER_PAGE}
              onChange={setGigsPage}
            />
          </div>
        );
      })()}

      {/* Modals */}
      {showAddModal && (
        <GigFormModal mode="add" onClose={() => setShowAddModal(false)} onSave={handleAddGig} />
      )}
      {editingGig && (
        <GigFormModal mode="edit" gig={editingGig} onClose={() => setEditingGig(null)} onSave={handleUpdateGig} />
      )}
      {deletingGig && (
        <DeleteConfirmModal gig={deletingGig} onClose={() => setDeletingGig(null)} onDelete={handleDeleteGig} />
      )}
      {cancelConfirmId && (
        <CancelClaimModal
          gigTitle={gigs.find(g => g.id === cancelConfirmId)?.title ?? "this gig"}
          cancelling={cancellingId === cancelConfirmId}
          onConfirm={() => { handleCancel(cancelConfirmId); setCancelConfirmId(null); }}
          onClose={() => setCancelConfirmId(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────── */
/*  Shared Form Modal: Add OR Edit                 */
/* ─────────────────────────────────────────────── */
function GigFormModal({
  mode, gig, onClose, onSave,
}: {
  mode: "add" | "edit";
  gig?: Gig;
  onClose: () => void;
  onSave: (gig: Gig) => void;
}): React.ReactElement {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [title, setTitle] = useState(gig?.title ?? "");
  const [description, setDescription] = useState(gig?.description ?? "");
  const [requiredPax, setRequiredPax] = useState(String(gig?.required_pax ?? 10));
  const [gigDate, setGigDate] = useState(gig?.gig_date ?? new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(gig?.start_time ?? '19:00');
  const [endTime, setEndTime] = useState(gig?.end_time ?? '21:00');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEdit = mode === "edit";

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) return;
    if (!user) { setSaveError(t.gigLoginRequired); return; }

    setSaving(true);
    setSaveError(null);

    const supabase = createClient();

    try {
      if (isEdit && gig) {
        // ── UPDATE ──
        const result = await Promise.race([
          supabase
            .from("volunteer_gigs")
            .update({ title: title.trim(), description: description.trim(), required_pax: parseInt(requiredPax) || 10, gig_date: gigDate, start_time: startTime, end_time: endTime })
            .eq("id", gig.id),
          waitMs(6000),
        ]);

        if (result && "error" in result && result.error) {
          console.warn("Update warning (saved locally):", result.error.message);
          toast.error(result.error.message);
        } else {
          toast.success("Gig updated successfully!");
        }

        // Always update local state regardless of DB result
        onSave({ ...gig, title: title.trim(), description: description.trim(), required_pax: parseInt(requiredPax) || 10, gig_date: gigDate, start_time: startTime, end_time: endTime });

      } else {
        // ── INSERT ──
        const result = await Promise.race([
          supabase
            .from("volunteer_gigs")
            .insert({ title: title.trim(), description: description.trim(), required_pax: parseInt(requiredPax) || 10, gig_date: gigDate, start_time: startTime, end_time: endTime, created_by: user.id })
            .select("id")
            .single(),
          waitMs(6000),
        ]);

        const newId: string =
          result && "data" in result && result.data?.id
            ? (result.data.id as string)
            : crypto.randomUUID();

        if (result && "error" in result && result.error) {
          console.warn("Insert warning (saved locally with UUID):", result.error.message);
          toast.error(result.error.message);
        } else {
          toast.success("Gig created successfully!");
        }

        onSave({
          id: newId,
          title: title.trim(),
          description: description.trim(),
          required_pax: parseInt(requiredPax) || 10,
          claimed: 0,
          gig_date: gigDate,
          start_time: startTime,
          end_time: endTime,
        });
      }

      setSuccess(true);
      setTimeout(() => onClose(), 1500);

    } catch (err) {
      console.error("Unexpected error in handleSave:", err);
      toast.error("Failed to save gig due to an unexpected error.");
      // Even on unexpected error, add the gig locally so user's work isn't lost
      const fallbackGig: Gig = {
        id: gig?.id ?? crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        required_pax: parseInt(requiredPax) || 10,
        claimed: gig?.claimed ?? 0,
        gig_date: gigDate,
        start_time: startTime,
        end_time: endTime,
      };
      onSave(fallbackGig);
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
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

        <div className="hero-gradient p-5 text-white overflow-hidden rounded-t-2xl relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-surface/5 rounded-full -mt-16 -mr-16 blur-2xl" />
          <div className="flex items-center gap-3 relative z-10">
            {isEdit ? <Pencil size={20} /> : <Briefcase size={22} />}
            <div>
              <h2 className="text-lg font-bold">{isEdit ? t.gigFormEditTitle : t.gigFormAddTitle}</h2>
              <p className="text-white/60 text-xs mt-0.5">
                {isEdit ? t.gigFormEditDesc : t.gigFormAddDesc}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle size={52} className="text-primary mx-auto mb-3" />
              <p className="font-bold text-text text-lg">{isEdit ? t.gigUpdated : t.gigCreated}</p>
              <p className="text-sm text-text-muted mt-1">
                {isEdit ? t.gigChangesSaved : t.gigListedForVols}
              </p>
            </div>
          ) : (
            <>
              {saveError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle size={15} /> {saveError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.gigFieldTitle}</label>
                <input
                  type="text" placeholder="e.g., Setup Audio System" value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.gigFieldDesc}</label>
                <textarea
                  placeholder="Describe what volunteers will do…" value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.gigFieldVolunteers}</label>
                  <input
                    type="number" placeholder="10" value={requiredPax} onChange={(e) => setRequiredPax(e.target.value)} min="1"
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.gigFieldDate}</label>
                  <input
                    type="date" value={gigDate} onChange={(e) => setGigDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.gigFieldStart}</label>
                  <input
                    type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5 block">{t.gigFieldEnd}</label>
                  <input
                    type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !description.trim()}
                className="w-full py-3.5 btn-primary text-sm mt-2 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? (isEdit ? t.gigSaving : t.gigCreating) : (isEdit ? t.gigSaveChanges : t.gigCreateGig)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/*  Delete Confirmation Modal                  */
/* ─────────────────────────────────────────── */
function DeleteConfirmModal({
  gig, onClose, onDelete,
}: {
  gig: Gig;
  onClose: () => void;
  onDelete: (id: string) => void;
}): React.ReactElement {
  const [deleting, setDeleting] = useState(false);
  const { t } = useLanguage();

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    const result = await Promise.race([
      supabase.from("volunteer_gigs").delete().eq("id", gig.id),
      waitMs(5000),
    ]);
    if (result && "error" in result && result.error) {
      console.error("Error deleting gig:", result.error.message);
      toast.error("Failed to delete gig.");
      setDeleting(false);
    } else {
      toast.success("Gig deleted.");
      onDelete(gig.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>

        <div className="bg-red-50 dark:bg-red-950 border-b border-red-100 dark:border-red-900 p-5 flex items-center justify-between">
          <div className="flex gap-3 items-center">
            <AlertTriangle className="text-red-500" />
            <div>
              <h2 className="font-bold text-red-900 dark:text-red-200">{t.gigDeleteTitle}</h2>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{t.gigDeleteUndo}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-red-500 hover:text-red-700 bg-red-100 p-1 rounded-md"><X size={18} /></button>
        </div>

        <div className="p-6">
          <p className="text-sm text-text-secondary mb-1">{t.gigDeletePrefix}</p>
          <p className="font-bold text-text bg-background border border-border rounded-xl px-4 py-3 text-sm mb-5">
            &ldquo;{gig.title}&rdquo;
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
              {deleting ? t.gigDeleting : t.gigDeleteBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── */
/*  Cancel Claim Confirmation Modal            */
/* ─────────────────────────────────────────── */
function CancelClaimModal({
  gigTitle, cancelling, onConfirm, onClose,
}: {
  gigTitle: string;
  cancelling: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-gold-light/20 dark:bg-surface-muted border-b border-gold/20 dark:border-gold/10 p-5 flex items-center justify-between">
          <div className="flex gap-3 items-center">
            <AlertTriangle className="text-gold-dark dark:text-gold" />
            <div>
              <h2 className="font-bold text-text">{t.gigCancelTitle}</h2>
              <p className="text-xs text-text-secondary mt-0.5">{t.gigCancelSubtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gold-dark dark:text-gold hover:text-gold bg-gold-light/30 dark:bg-surface-alt p-1 rounded-md"><X size={18} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-text-secondary mb-1">{t.gigCancelPrefix}</p>
          <p className="font-bold text-text bg-background border border-border rounded-xl px-4 py-3 text-sm mb-5">
            &ldquo;{gigTitle}&rdquo;
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 btn-outline text-sm font-bold rounded-xl">
              {t.gigKeepClaim}
            </button>
            <button
              onClick={onConfirm}
              disabled={cancelling}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={15} className="animate-spin" /> : <X size={15} />}
              {cancelling ? t.gigCancelling : t.gigCancelBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
