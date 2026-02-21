"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { useLiveFoodEvents } from "@/hooks/useLiveFoodEvents";
import { claimKupon } from "@/lib/mutations/claims";
import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { Utensils, Clock, MapPin, CheckCircle, AlertCircle, Ticket, Plus, X, CalendarPlus } from "lucide-react";

export default function EKuponPage() {
  const { user, isAdmin, isAnonymous, isLoading: authLoading } = useAuth();
  const { events, isLoading: eventsLoading } = useLiveFoodEvents();
  const [showAddModal, setShowAddModal] = useState(false);

  const isLoading = eventsLoading;

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
          <div className="icon-box icon-box-gold"><Ticket size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A2E2A]">E-Kupon Iftar</h1>
            <p className="text-sm text-[#8FA39B]">Claim your digital coupon for food distribution</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#1B6B4A] hover:bg-[#0F4A33] text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> Add E-Kupon
          </button>
        )}
      </div>

      {/* Main List */}
      <div className="space-y-6">
        {events.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-[#E2E8E5] shadow-sm">
            <Ticket size={48} className="mx-auto text-[#8FA39B] opacity-30 mb-4" />
            <h3 className="text-[#1A2E2A] font-bold text-lg">No Events Available</h3>
            <p className="text-[#5A7068] text-sm mt-1">There are no food distributions active right now.</p>
          </div>
        ) : (
          events.map(event => <KuponCard key={event.id} event={event} user={user} />)
        )}
      </div>

      {/* ═══ Admin: Add E-Kupon Modal ═══ */}
      {showAddModal && <AddEKuponModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Admin Modal: Create a new Food Event / Kupon  */
/* ────────────────────────────────────────────── */
function AddEKuponModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("500");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime] = useState("17:00");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !capacity || !date) return;
    setSaving(true);
    // In production, this would call supabase.from('food_events').insert(...)
    await new Promise((r) => setTimeout(r, 800));
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
            <CalendarPlus size={22} />
            <div>
              <h2 className="text-lg font-bold">Add New E-Kupon</h2>
              <p className="text-white/60 text-xs mt-0.5">Set up a new food distribution event</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle size={48} className="text-[#1B6B4A] mx-auto mb-3" />
              <p className="font-bold text-[#1A2E2A]">E-Kupon Created!</p>
              <p className="text-sm text-[#8FA39B] mt-1">Users can now claim this kupon.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Food Name *</label>
                <input
                  type="text" placeholder="e.g., Nasi Briyani Kambing" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Capacity</label>
                  <input
                    type="number" placeholder="500" value={capacity} onChange={(e) => setCapacity(e.target.value)} min="1"
                    className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Date</label>
                  <input
                    type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Start Time</label>
                  <input
                    type="time" value={time} onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#5A7068] uppercase tracking-wider mb-1.5 block">Location</label>
                  <input
                    type="text" placeholder="e.g., Gate B" value={location} onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                  />
                </div>
              </div>

              <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full py-3.5 btn-primary text-sm mt-2">
                {saving ? "Creating…" : "Create E-Kupon Event"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Kupon Card Component (handles own claim state)*/
/* ────────────────────────────────────────────── */
function KuponCard({ event, user }: { event: any; user: any }) {
  const [hasClaimed, setHasClaimed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);

  const eventId = event.id;
  const totalPacks = event.total_capacity;
  const remainingPacks = localRemaining ?? event.remaining_capacity;
  const percentageLeft = (remainingPacks / totalPacks) * 100;
  const isScheduled = event.status === "scheduled";

  // Sync dynamic remaining 
  useEffect(() => {
    if (event.remaining_capacity != null && localRemaining === null) {
      setLocalRemaining(event.remaining_capacity);
    }
  }, [event.remaining_capacity, localRemaining]);

  // Restore claim status from localStorage
  useEffect(() => {
    if (user?.id) {
      if (localStorage.getItem(`makmur_kupon_${user.id}_${eventId}`) === "claimed") {
        setHasClaimed(true);
      }
    }
  }, [user?.id, eventId]);

  const handleClaim = async () => {
    if (!user || isScheduled) return;
    setIsClaiming(true);
    setClaimError(null);
    const result = await claimKupon(event.id, user.id);
    if (result.success) {
      setHasClaimed(true);
      setLocalRemaining((prev) => Math.max(0, (prev ?? event.remaining_capacity) - 1));
      localStorage.setItem(`makmur_kupon_${user.id}_${eventId}`, "claimed");
    } else {
      setClaimError(result.error ?? "Failed to claim kupon.");
    }
    setIsClaiming(false);
  };

  return (
    <div className="card overflow-hidden">
      {/* Event header */}
      <div className={`p-6 text-white relative overflow-hidden ${isScheduled ? 'bg-gradient-to-br from-[#D4A843] to-[#B08A2E]' : 'hero-gradient'}`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mt-20 -mr-20 blur-2xl" />
        <div className="flex items-start justify-between relative z-10 mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Utensils size={20} />
            {event.name}
          </h2>
          <span className={`badge text-[10px] ${isScheduled ? "bg-white/20 text-white" : "bg-[#EEFBF4] text-[#1B6B4A]"}`}>
            {isScheduled ? "SCHEDULED" : "● ACTIVE"}
          </span>
        </div>
        <div className="space-y-2 relative z-10 text-white/80">
          <div className="flex items-center gap-2 text-sm"><Clock size={14} /> {event.event_date} ({event.start_time?.slice(0,5)} - {event.end_time?.slice(0,5)})</div>
          <div className="flex items-center gap-2 text-sm"><MapPin size={14} /> Main Courtyard, Masjid Al-Makmur</div>
        </div>
      </div>

      <div className="p-6">
        {/* Live counter */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#5A7068] font-medium">Availability</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${remainingPacks < 100 ? "bg-amber-500" : "bg-[#1B6B4A]"} ${!isScheduled && 'animate-live'}`} />
              <span className={`font-bold ${remainingPacks < 100 ? "text-amber-600" : "text-[#1B6B4A]"}`}>
                {remainingPacks}/{totalPacks} remaining
              </span>
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${percentageLeft}%` }} />
          </div>
        </div>

        {/* Error */}
        {claimError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl mb-4 flex items-center gap-2 text-sm">
            <AlertCircle size={16} /> {claimError}
          </div>
        )}

        {/* CLAIM BUTTON or QR CODE */}
        {!hasClaimed ? (
          <button 
            onClick={handleClaim} 
            disabled={isClaiming || remainingPacks <= 0 || isScheduled} 
            className={`w-full py-4 text-base flex items-center justify-center gap-2 rounded-xl font-bold transition-all shadow-md ${
              isScheduled 
                ? 'bg-[#F1F5F3] text-[#8FA39B] cursor-not-allowed border border-[#E2E8E5] shadow-none' 
                : 'bg-[#1B6B4A] text-white hover:bg-[#0F4A33] hover:shadow-lg'
            }`}
          >
            {isScheduled ? <Clock size={20} /> : <Utensils size={20} />}
            {isScheduled ? "Opens Soon" : (isClaiming ? "Claiming…" : "Claim Now")}
          </button>
        ) : (
          <div className="border-2 border-dashed border-[#D5F5E3] rounded-2xl p-6 bg-[#EEFBF4]/50">
            <div className="flex items-center justify-center gap-2 mb-5">
              <CheckCircle size={18} className="text-[#1B6B4A]" />
              <span className="font-bold text-[#1B6B4A]">Kupon Claimed Successfully</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm mx-auto w-fit">
              <QRCode value={`makmur-kupon:${user?.id}`} size={180} level="H" fgColor="#1B6B4A" />
            </div>

            <p className="text-sm text-[#5A7068] mt-5 text-center">
              Show this QR to the volunteer at the counter.
            </p>
            <p className="font-mono text-xs text-[#8FA39B] text-center mt-1">
              ID: {user?.id.split('-')[0]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
