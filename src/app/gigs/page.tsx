"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { claimGig } from "@/lib/mutations/claims";
import { useState } from "react";
import { Users, Clock, CheckCircle, AlertCircle, LogIn, Briefcase, Plus, X } from "lucide-react";

const initialGigs = [
  { id: "a1111111-1111-4111-a111-111111111111", title: "Kacau Bubur Lambuk", description: "Join the team to stir and pack traditional Bubur Lambuk.", required_pax: 15, claimed: 8, time: "3:00 PM - 5:00 PM" },
  { id: "a2222222-2222-4222-a222-222222222222", title: "Tarawih Traffic Control", description: "Manage car flow and parking for smooth Tarawih arrival.", required_pax: 10, claimed: 4, time: "7:30 PM - 9:00 PM" },
  { id: "a3333333-3333-4333-a333-333333333333", title: "Susun Sejadah & Saf", description: "Arrange prayer mats and align saf lines in the main hall.", required_pax: 5, claimed: 5, time: "6:00 PM - 7:00 PM" },
  { id: "a4444444-4444-4444-a444-444444444444", title: "Clean Up Kitchen", description: "Help the kitchen team clean up after Iftar preparation.", required_pax: 8, claimed: 2, time: "8:00 PM - 9:30 PM" },
];

export default function GigsPage() {
  const { user, isAnonymous, isAdmin, setShowLoginModal } = useAuth();
  const [gigs, setGigs] = useState(initialGigs);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<{ id: string; msg: string; ok: boolean } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const handleClaim = async (gigId: string) => {
    if (isAnonymous) { setShowLoginModal(true); return; }
    if (!user) return;
    const result = await claimGig(gigId, user.id);
    if (result.success) {
      setClaimedIds((prev) => new Set(prev).add(gigId));
      setGigs((prev) => prev.map((g) => g.id === gigId ? { ...g, claimed: g.claimed + 1 } : g));
      setFeedback({ id: gigId, msg: "Claimed!", ok: true });
    } else {
      setFeedback({ id: gigId, msg: result.error ?? "Error", ok: false });
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleAddGig = (newGig: typeof initialGigs[0]) => {
    setGigs((prev) => [newGig, ...prev]);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
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

      {isAnonymous && (
        <div className="card p-4 mb-6 flex items-center gap-3 border-l-4 border-l-[#D4A843]">
          <div className="icon-box icon-box-gold w-10 h-10"><LogIn size={16} /></div>
          <p className="text-sm text-[#5A7068]"><strong className="text-[#1A2E2A]">Sign in required</strong> to claim gigs — the AJK needs to know who is coming!</p>
        </div>
      )}

      <div className="space-y-4">
        {gigs.map((gig) => {
          const isFull = gig.claimed >= gig.required_pax;
          const isClaimed = claimedIds.has(gig.id);
          const pct = Math.round((gig.claimed / gig.required_pax) * 100);
          return (
            <div key={gig.id} className="card p-5">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-[#1A2E2A]">{gig.title}</h3>
                <span className={`badge ${isFull ? "bg-amber-100 text-amber-700" : "bg-[#EEFBF4] text-[#1B6B4A]"}`}>
                  <Users size={12} /> {gig.claimed}/{gig.required_pax}
                </span>
              </div>
              <p className="text-sm text-[#5A7068] mb-3">{gig.description}</p>
              <div className="flex items-center gap-2 text-xs text-[#8FA39B] mb-3">
                <Clock size={13} /> {gig.time}
              </div>
              <div className="progress-bar mb-4">
                <div className="progress-fill" style={{ width: `${pct}%`, background: isFull ? '#D4A843' : undefined }} />
              </div>

              {feedback?.id === gig.id && (
                <div className={`flex items-center gap-2 text-sm mb-3 px-3 py-2 rounded-lg ${feedback.ok ? "bg-[#EEFBF4] text-[#1B6B4A]" : "bg-amber-50 text-amber-700"}`}>
                  {feedback.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {feedback.msg}
                </div>
              )}

              <button onClick={() => handleClaim(gig.id)} disabled={isFull || isClaimed} className="w-full py-3 btn-primary text-sm">
                {isAnonymous ? <LogIn size={16} /> : <Users size={16} />}
                {isClaimed ? "Claimed ✓" : isFull ? "Fully Booked" : isAnonymous ? "Sign In to Claim" : "Claim Task"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ═══ Admin: Add Gig Modal ═══ */}
      {showAddModal && <AddGigModal onClose={() => setShowAddModal(false)} onAdd={handleAddGig} />}
    </div>
  );
}

/* ────────────────────────────────────── */
/*  Admin Modal: Create a new Gig         */
/* ────────────────────────────────────── */
function AddGigModal({ onClose, onAdd }: { onClose: () => void; onAdd: (gig: typeof initialGigs[0]) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredPax, setRequiredPax] = useState("10");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !description.trim() || !time.trim()) return;
    setSaving(true);
    // In production, this would call supabase.from('volunteer_gigs').insert(...)
    await new Promise((r) => setTimeout(r, 800));
    const newGig = {
      id: `new-${Date.now()}`,
      title,
      description,
      required_pax: parseInt(requiredPax) || 10,
      claimed: 0,
      time,
    };
    onAdd(newGig);
    setSaving(false);
    setSuccess(true);
    setTimeout(() => onClose(), 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="hero-gradient p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mt-16 -mr-16 blur-2xl" />
          <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition"><X size={18} /></button>
          <div className="flex items-center gap-3 relative z-10">
            <Briefcase size={22} />
            <div>
              <h2 className="text-lg font-bold">Add New Gig</h2>
              <p className="text-white/60 text-xs mt-0.5">Create a volunteer task for the community</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle size={48} className="text-[#1B6B4A] mx-auto mb-3" />
              <p className="font-bold text-[#1A2E2A]">Gig Created!</p>
              <p className="text-sm text-[#8FA39B] mt-1">Volunteers can now claim this task.</p>
            </div>
          ) : (
            <>
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
                  <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Time Slot *</label>
                  <input
                    type="text" placeholder="e.g., 3 PM - 5 PM" value={time} onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                  />
                </div>
              </div>

              <button onClick={handleSave} disabled={saving || !title.trim() || !description.trim() || !time.trim()} className="w-full py-3.5 btn-primary text-sm mt-2">
                {saving ? "Creating…" : "Create Gig"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
