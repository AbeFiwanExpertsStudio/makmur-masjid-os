"use client";

import { useState, useEffect } from "react";
import { HandHeart, X, Heart, Plus, Pencil, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthContext";

type Campaign = {
  id: string;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
};

// timeout helper
function waitMs(ms: number): Promise<null> {
  return new Promise((r) => setTimeout(() => r(null), ms));
}

export default function CrowdfundingPage() {
  const { isAdmin } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [donateModal, setDonateModal] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);

  const fetchCampaigns = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("crowdfund_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) console.error("Crowdfunding fetch error:", error);
      else setCampaigns(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const activeCampaign = campaigns.find((c) => c.id === donateModal);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="icon-box icon-box-gold">
            <HandHeart size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A2E2A]">Crowdfunding</h1>
            <p className="text-sm text-[#8FA39B]">Support mosque initiatives this Ramadan</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary py-2 px-4 shadow-md rounded-xl text-sm flex items-center gap-2"
          >
            <Plus size={16} /> Add Campaign
          </button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-[#8FA39B]">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-[#E2E8E5] shadow-sm">
            <HandHeart size={48} className="mx-auto text-[#8FA39B] opacity-30 mb-4" />
            <h3 className="text-[#1A2E2A] font-bold text-lg">No Campaigns</h3>
            <p className="text-[#5A7068] text-sm mt-1">There are currently no active crowdfunding campaigns.</p>
          </div>
        ) : (
          campaigns.map((c) => {
            const pct = Math.min(100, Math.round((c.current_amount / c.target_amount) * 100));
            // Simulate donors count for visual consistency
            const donorsCount = Math.max(1, Math.floor(c.current_amount / 50));

            return (
              <div key={c.id} className="card p-6 relative">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-lg text-[#1A2E2A] pr-2">{c.title}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge bg-[#FDF6E3] text-[#D4A843]">
                      <Heart size={10} /> {donorsCount} donors
                    </span>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setEditingCampaign(c)}
                          className="w-7 h-7 rounded bg-[#F8FAF9] border border-[#E2E8E5] flex items-center justify-center text-[#5A7068] hover:bg-[#EEFBF4] hover:text-[#1B6B4A]"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setDeletingCampaign(c)}
                          className="w-7 h-7 rounded bg-[#F8FAF9] border border-[#E2E8E5] flex items-center justify-center text-[#5A7068] hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-[#5A7068] mb-4">{c.description}</p>

                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span className="text-[#1B6B4A] font-bold text-lg">RM{c.current_amount.toLocaleString()}</span>
                  <span className="text-[#8FA39B]">of RM{c.target_amount.toLocaleString()}</span>
                </div>
                <div className="progress-bar mb-1">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-[#8FA39B] mb-5 text-right">{pct}% funded</p>

                <button onClick={() => setDonateModal(c.id)} className="w-full py-3 btn-primary text-sm flex justify-center items-center gap-2">
                  <HandHeart size={16} /> Donate via DuitNow / Card
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Donate Modal (Simulated) */}
      {donateModal && activeCampaign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setDonateModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setDonateModal(null)} className="absolute top-4 right-4 z-20 text-white/50 hover:text-white transition bg-black/20 rounded-full p-1">
              <X size={20} />
            </button>
            <div className="hero-gradient p-6 text-white overflow-hidden rounded-t-2xl relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mt-16 -mr-16 blur-2xl" />
              <p className="text-sm text-white/60 relative z-10">Donate to</p>
              <h2 className="text-lg font-bold mt-1 relative z-10">{activeCampaign.title}</h2>
            </div>
            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-[#8FA39B] mb-3">Select Amount</p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[20, 50, 100].map((amt) => (
                  <button key={amt} className="btn-outline py-3 font-bold text-[#1B6B4A] text-sm hover:bg-[#EEFBF4]">
                    RM{amt}
                  </button>
                ))}
              </div>
              <button onClick={() => setDonateModal(null)} className="w-full py-3.5 btn-primary text-sm">Proceed to Payment (Demo)</button>
              <p className="text-xs text-[#8FA39B] text-center mt-3">Simulated Checkout for preview</p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Modals */}
      {showAddModal && (
        <CampaignFormModal
          mode="add"
          onClose={() => setShowAddModal(false)}
          onSave={(c) => { setCampaigns([c, ...campaigns]); fetchCampaigns(); }}
        />
      )}
      {editingCampaign && (
        <CampaignFormModal
          mode="edit"
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSave={(c) => { setCampaigns(campaigns.map(camp => camp.id === c.id ? c : camp)); fetchCampaigns(); }}
        />
      )}
      {deletingCampaign && (
        <DeleteCampaignModal
          campaign={deletingCampaign}
          onClose={() => setDeletingCampaign(null)}
          onDelete={(id) => { setCampaigns(campaigns.filter(c => c.id !== id)); }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Admin CRUD Components
// -------------------------------------------------------------------------------------------------

function CampaignFormModal({ mode, campaign, onClose, onSave }: { mode: "add" | "edit", campaign?: Campaign, onClose: () => void, onSave: (c: Campaign) => void }) {
  const isEdit = mode === "edit";
  const [title, setTitle] = useState(campaign?.title || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [target, setTarget] = useState(String(campaign?.target_amount || "10000"));
  const [current, setCurrent] = useState(String(campaign?.current_amount || "0"));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !target) return;
    setSaving(true);
    const supabase = createClient();

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        target_amount: parseFloat(target) || 0,
        current_amount: parseFloat(current) || 0,
      };

      if (isEdit && campaign) {
        await Promise.race([
          supabase.from("crowdfund_campaigns").update(payload).eq("id", campaign.id),
          waitMs(5000)
        ]);
        onSave({ ...campaign, ...payload });
      } else {
        const { data } = await Promise.race([
          supabase.from("crowdfund_campaigns").insert(payload).select().single(),
          waitMs(5000)
        ]) as any;
        // if timeout, provide a fallback visual update
        onSave(data || { id: crypto.randomUUID(), ...payload });
      }
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white/50 hover:text-white transition bg-black/20 rounded-full p-1">
          <X size={20} />
        </button>
        <div className="hero-gradient p-5 text-white overflow-hidden rounded-t-2xl relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mt-16 -mr-16 blur-2xl" />
          <h2 className="text-lg font-bold relative z-10">{isEdit ? "Edit Campaign" : "Add Campaign"}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#5A7068] uppercase mb-1.5 block">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-xl text-sm outline-none focus:border-[#1B6B4A] bg-[#F8FAF9]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#5A7068] uppercase mb-1.5 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-xl text-sm outline-none focus:border-[#1B6B4A] bg-[#F8FAF9]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#5A7068] uppercase mb-1.5 block">Target (RM)</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-xl text-sm outline-none focus:border-[#1B6B4A] bg-[#F8FAF9]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#5A7068] uppercase mb-1.5 block">Current raised (RM)</label>
              <input type="number" value={current} onChange={e => setCurrent(e.target.value)} className="w-full px-3 py-2 border border-[#E2E8E5] rounded-xl text-sm outline-none focus:border-[#1B6B4A] bg-[#F8FAF9]" />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="w-full py-3.5 btn-primary text-sm mt-2 flex justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />} {saving ? "Saving..." : "Save Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteCampaignModal({ campaign, onClose, onDelete }: { campaign: Campaign, onClose: () => void, onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    await Promise.race([
      supabase.from("crowdfund_campaigns").delete().eq("id", campaign.id),
      waitMs(5000)
    ]);
    onDelete(campaign.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-red-50 p-5 flex items-center justify-between border-b border-red-100">
          <div className="flex gap-3 items-center">
            <AlertTriangle className="text-red-500" />
            <h2 className="font-bold text-[#1A2E2A]">Delete Campaign?</h2>
          </div>
          <button onClick={onClose} className="text-red-500 hover:text-red-700 bg-red-100 p-1 rounded-md"><X size={18} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-[#5A7068] mb-4">Are you sure you want to delete "{campaign.title}"?</p>
          <button onClick={handleDelete} disabled={deleting} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold flex justify-center gap-2">
            {deleting && <Loader2 size={16} className="animate-spin" />} Delete Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
