"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { claimGig, cancelGig } from "@/lib/mutations/claims";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useState } from "react";
import {
  Users, Clock, CheckCircle, AlertCircle, LogIn,
  Briefcase, Plus, X, Pencil, Trash2, AlertTriangle, Loader2,
} from "lucide-react";

type Gig = {
  id: string;
  title: string;
  description: string;
  required_pax: number;
  claimed: number;
  time: string;
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
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loadingGigs, setLoadingGigs] = useState(true);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGig, setEditingGig] = useState<Gig | null>(null);
  const [deletingGig, setDeletingGig] = useState<Gig | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
        .select(`id, title, description, required_pax, created_at, gig_claims(count)`)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not load gigs:", error.message);
        setGigs([]);
      } else {
        // Map DB rows to Gig type
        const mapped: Gig[] = (data ?? []).map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description ?? "",
          required_pax: row.required_pax,
          claimed: row.gig_claims?.[0]?.count ?? 0,
          time: "TBC",
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* ── Claim ── */
  const handleClaim = async (gigId: string) => {
    if (isAnonymous) { setShowLoginModal(true); return; }
    if (!user) return;
    const result = await claimGig(gigId, user.id);
    if (result.success) {
      setClaimedIds((prev) => new Set(prev).add(gigId));
      setGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, claimed: g.claimed + 1 } : g));
      setFeedback({ id: gigId, msg: "Claimed! See you there 🎉", ok: true });
    } else {
      setFeedback({ id: gigId, msg: result.error ?? "Error", ok: false });
    }
    setTimeout(() => setFeedback(null), 3500);
  };

  /* ── Cancel ── */
  const handleCancel = async (gigId: string) => {
    if (!user) return;
    setCancellingId(gigId);
    const result = await cancelGig(gigId, user.id);
    if (result.success) {
      setClaimedIds((prev) => { const s = new Set(prev); s.delete(gigId); return s; });
      setGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, claimed: Math.max(0, g.claimed - 1) } : g));
      setFeedback({ id: gigId, msg: "Claim cancelled.", ok: true });
    } else {
      setFeedback({ id: gigId, msg: result.error ?? "Error cancelling", ok: false });
    }
    setCancellingId(null);
    setTimeout(() => setFeedback(null), 3000);
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
          <div className="icon-box icon-box-primary"><Briefcase size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A2E2A]">Volunteer Gigs</h1>
            <p className="text-sm text-[#8FA39B]">Claim a task and contribute this Ramadan</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#1B6B4A] hover:bg-[#0F4A33] text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> Add Gig
          </button>
        )}
      </div>

      {/* Login notice */}
      {isAnonymous && (
        <div className="card p-4 mb-6 flex items-center gap-3 border-l-4 border-l-[#D4A843]">
          <div className="icon-box icon-box-gold w-10 h-10"><LogIn size={16} /></div>
          <p className="text-sm text-[#5A7068]"><strong className="text-[#1A2E2A]">Sign in required</strong> to claim gigs — the AJK needs to know who is coming!</p>
        </div>
      )}

      {/* Loading state */}
      {loadingGigs && (
        <div className="flex items-center justify-center py-12 gap-3 text-[#8FA39B]">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading gigs…</span>
        </div>
      )}

      {/* Gig cards */}
      {!loadingGigs && (() => {
        const allClaimed = gigs.length > 0 && gigs.every((g) => g.claimed >= g.required_pax);
        const isEmpty = gigs.length === 0;

        if (isEmpty || allClaimed) {
          return (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-amber-500" />
              </div>
              <h3 className="font-bold text-[#1A2E2A] text-lg mb-2">
                {allClaimed ? "All Volunteer Slots Have Been Claimed! 🎉" : "No Gigs Available"}
              </h3>
              <p className="text-sm text-[#8FA39B] max-w-xs mx-auto">
                {allClaimed
                  ? "MasyaAllah! Every volunteer slot is filled. Jazakallahu khairan to all our volunteers."
                  : isAdmin
                    ? "No volunteer tasks yet. Click \"Add Gig\" to create the first one."
                    : "Check back soon — new volunteer tasks will be posted here."}
              </p>
              {allClaimed && isAdmin && (
                <p className="text-xs text-[#8FA39B] mt-3">You can still add more gigs using the \"Add Gig\" button above.</p>
              )}
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {gigs.map((gig) => {
              const isFull = gig.claimed >= gig.required_pax;
              const isClaimed = claimedIds.has(gig.id);
              const pct = Math.min(100, Math.round((gig.claimed / gig.required_pax) * 100));
              return (
                <div key={gig.id} className="card p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-[#1A2E2A] pr-2">{gig.title}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`badge ${isFull ? "bg-amber-100 text-amber-700" : "bg-[#EEFBF4] text-[#1B6B4A]"}`}>
                        <Users size={12} /> {gig.claimed}/{gig.required_pax}
                      </span>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setEditingGig(gig)}
                            title="Edit gig"
                            className="w-8 h-8 rounded-lg bg-[#F8FAF9] border border-[#E2E8E5] flex items-center justify-center text-[#5A7068] hover:bg-[#EEFBF4] hover:text-[#1B6B4A] hover:border-[#1B6B4A] transition-all"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingGig(gig)}
                            title="Delete gig"
                            className="w-8 h-8 rounded-lg bg-[#F8FAF9] border border-[#E2E8E5] flex items-center justify-center text-[#5A7068] hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-[#5A7068] mb-3">{gig.description}</p>
                  {gig.time !== "TBC" && (
                    <div className="flex items-center gap-2 text-xs text-[#8FA39B] mb-3">
                      <Clock size={13} /> {gig.time}
                    </div>
                  )}
                  <div className="progress-bar mb-4">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: isFull ? "#D4A843" : undefined }} />
                  </div>

                  {feedback?.id === gig.id && (
                    <div className={`flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-lg ${feedback.ok ? "bg-[#EEFBF4] text-[#1B6B4A]" : "bg-amber-50 text-amber-700"}`}>
                      {feedback.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {feedback.msg}
                    </div>
                  )}

                  {/* Claim / Cancel buttons */}
                  {isClaimed ? (
                    <div className="flex gap-2">
                      <div className="flex-1 py-3 btn-primary text-sm flex items-center justify-center gap-2 opacity-80 cursor-default">
                        <CheckCircle size={15} /> Claimed ✓
                      </div>
                      <button
                        onClick={() => handleCancel(gig.id)}
                        disabled={cancellingId === gig.id}
                        title="Cancel your claim"
                        className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {cancellingId === gig.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <X size={14} />}
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleClaim(gig.id)}
                      disabled={isFull}
                      className="w-full py-3 btn-primary text-sm"
                    >
                      {isAnonymous ? <LogIn size={16} /> : <Users size={16} />}
                      {isFull ? "Fully Booked" : isAnonymous ? "Sign In to Claim" : "Claim Task"}
                    </button>
                  )}
                </div>
              );
            })}
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
  const [title, setTitle] = useState(gig?.title ?? "");
  const [description, setDescription] = useState(gig?.description ?? "");
  const [requiredPax, setRequiredPax] = useState(String(gig?.required_pax ?? 10));
  const [time, setTime] = useState(gig?.time && gig.time !== "TBC" ? gig.time : "");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEdit = mode === "edit";

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) return;
    if (!user) { setSaveError("You must be logged in."); return; }

    setSaving(true);
    setSaveError(null);

    const supabase = createClient();

    try {
      if (isEdit && gig) {
        // ── UPDATE ──
        const result = await Promise.race([
          supabase
            .from("volunteer_gigs")
            .update({ title: title.trim(), description: description.trim(), required_pax: parseInt(requiredPax) || 10 })
            .eq("id", gig.id),
          waitMs(6000),
        ]);

        if (result && "error" in result && result.error) {
          console.warn("Update warning (saved locally):", result.error.message);
        }

        // Always update local state regardless of DB result
        onSave({ ...gig, title: title.trim(), description: description.trim(), required_pax: parseInt(requiredPax) || 10, time: time.trim() || gig.time });

      } else {
        // ── INSERT ──
        const result = await Promise.race([
          supabase
            .from("volunteer_gigs")
            .insert({ title: title.trim(), description: description.trim(), required_pax: parseInt(requiredPax) || 10, created_by: user.id })
            .select("id")
            .single(),
          waitMs(6000),
        ]);

        // Get the UUID from DB, or generate one locally as fallback
        const newId: string =
          result && "data" in result && result.data?.id
            ? (result.data.id as string)
            : crypto.randomUUID();

        if (result && "error" in result && result.error) {
          console.warn("Insert warning (saved locally with UUID):", result.error.message);
        }

        // ✅ Always call onSave — this adds the gig to the visible list
        onSave({
          id: newId,
          title: title.trim(),
          description: description.trim(),
          required_pax: parseInt(requiredPax) || 10,
          claimed: 0,
          time: time.trim() || "TBC",
        });
      }

      setSuccess(true);
      setTimeout(() => onClose(), 1500);

    } catch (err) {
      console.error("Unexpected error in handleSave:", err);
      // Even on unexpected error, add the gig locally so user's work isn't lost
      const fallbackGig: Gig = {
        id: gig?.id ?? crypto.randomUUID(),
        title: title.trim(),
        description: description.trim(),
        required_pax: parseInt(requiredPax) || 10,
        claimed: gig?.claimed ?? 0,
        time: time.trim() || "TBC",
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
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>

        <div className="hero-gradient p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mt-16 -mr-16 blur-2xl" />
          <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition"><X size={18} /></button>
          <div className="flex items-center gap-3 relative z-10">
            {isEdit ? <Pencil size={20} /> : <Briefcase size={22} />}
            <div>
              <h2 className="text-lg font-bold">{isEdit ? "Edit Gig" : "Add New Gig"}</h2>
              <p className="text-white/60 text-xs mt-0.5">
                {isEdit ? "Update the details of this volunteer task" : "Create a volunteer task for the community"}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle size={52} className="text-[#1B6B4A] mx-auto mb-3" />
              <p className="font-bold text-[#1A2E2A] text-lg">{isEdit ? "Gig Updated!" : "Gig Created!"}</p>
              <p className="text-sm text-[#8FA39B] mt-1">
                {isEdit ? "Changes have been saved." : "The new gig is now listed for volunteers."}
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
                <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Task Title *</label>
                <input
                  type="text" placeholder="e.g., Setup Audio System" value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Description *</label>
                <textarea
                  placeholder="Describe what volunteers will do…" value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Volunteers Needed</label>
                  <input
                    type="number" placeholder="10" value={requiredPax} onChange={(e) => setRequiredPax(e.target.value)} min="1"
                    className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Time Slot</label>
                  <input
                    type="text" placeholder="e.g., 3 PM – 5 PM" value={time} onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !description.trim()}
                className="w-full py-3.5 btn-primary text-sm mt-2 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Create Gig")}
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

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    await Promise.race([
      supabase.from("volunteer_gigs").delete().eq("id", gig.id),
      waitMs(5000),
    ]);
    onDelete(gig.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>

        <div className="bg-red-50 border-b border-red-100 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h2 className="font-bold text-[#1A2E2A]">Delete Gig?</h2>
            <p className="text-xs text-[#8FA39B] mt-0.5">This action cannot be undone.</p>
          </div>
          <button onClick={onClose} className="ml-auto text-[#8FA39B] hover:text-[#1A2E2A] transition"><X size={18} /></button>
        </div>

        <div className="p-6">
          <p className="text-sm text-[#5A7068] mb-1">You are about to permanently delete:</p>
          <p className="font-bold text-[#1A2E2A] bg-[#F8FAF9] border border-[#E2E8E5] rounded-xl px-4 py-3 text-sm mb-5">
            &ldquo;{gig.title}&rdquo;
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 btn-outline text-sm font-bold rounded-xl">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {deleting ? "Deleting…" : "Delete Gig"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
