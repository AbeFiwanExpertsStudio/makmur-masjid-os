"use client";

import { useState, useEffect } from "react";
import { HandHeart, X, Heart, Plus, Pencil, Trash2, AlertTriangle, Loader2, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthContext";
import { toast } from "react-hot-toast";
import { useLanguage } from "@/components/providers/LanguageContext";
import Pagination from "@/components/ui/Pagination";
import DonationReceiptModal from "@/components/modals/DonationReceiptModal";

type Campaign = {
  id: string;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  donor_count: number;
  images: string[];
  completed_at: string | null;
};

// timeout helper
function waitMs(ms: number): Promise<null> {
  return new Promise((r) => setTimeout(() => r(null), ms));
}

export default function CrowdfundingPage() {
  const { isAdmin, user } = useAuth();
  const { t, language } = useLanguage();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [donateModal, setDonateModal] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState<number>(50);
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<{ id: string, amount: number } | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const CAMPAIGNS_PER_PAGE = 4;
  const [campaignsPage, setCampaignsPage] = useState(1);

  const fetchCampaigns = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("crowdfund_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Crowdfunding fetch error:", error);
        setFetchError(error.message);
      } else {
        setFetchError(null);
        setCampaigns(data || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    // Check for payment success in URL
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const donationId = urlParams.get('donation_id');
    
    if (paymentStatus === 'success') {
      console.log("SUCESS: Triggering modal for donation:", donationId);
      setShowSuccessModal({ id: donationId || "", amount: 0 });
    } else if (paymentStatus === 'failed') {
      toast.error(t.donationFailed);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const activeCampaign = campaigns.find((c) => c.id === donateModal);

  // Autofill donor info from logged-in user
  useEffect(() => {
    if (!donateModal || !user) return;
    setDonorEmail(user.email || "");
    const supabase = createClient();
    supabase.from("profiles").select("display_name, phone").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.display_name) setDonorName(data.display_name);
        if (data?.phone) setDonorPhone(data.phone);
      });
  }, [donateModal, user?.id]);

  const handleDonate = async () => {
    if (!activeCampaign || !donationAmount) return;
    setIsProcessing(true);
    try {
      // Save phone number for future autofill if user is logged in
      if (user && donorPhone.trim()) {
        const supabase = createClient();
        supabase.from("profiles").update({ phone: donorPhone.trim() }).eq("id", user.id);
      }

      const response = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: activeCampaign.id,
          amount: donationAmount,
          donorName: donorName || "Anonymous",
          donorEmail: donorEmail || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate payment");
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No payment URL received");
      }
    } catch (error: any) {
      console.error("Donation error:", error);
      toast.error(error.message || "Failed to process donation. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="text-primary">
            <HandHeart size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">{t.crowdfundTitle}</h1>
            <p className="text-sm text-text-muted">{t.crowdfundSubtitle}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary py-2 px-4 shadow-md rounded-xl text-sm flex items-center gap-2"
          >
            <Plus size={16} /> {language === 'ms' ? 'Tambah Kempen' : 'Add Campaign'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-text-muted">{t.loading}</div>
        ) : fetchError ? (
          <div className="card p-8 text-center">
            <div className="text-red-500 dark:text-red-400 text-sm mb-3">{fetchError}</div>
            <button onClick={fetchCampaigns} className="px-5 py-2 btn-primary text-sm">{t.retry ?? "Retry"}</button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-10 bg-surface rounded-2xl border border-border shadow-sm">
            <HandHeart size={48} className="mx-auto text-text-muted opacity-30 mb-4" />
            <h3 className="text-text font-bold text-lg">No Campaigns</h3>
            <p className="text-text-secondary text-sm mt-1">{t.noCampaigns}</p>
          </div>
        ) : (
          campaigns
            .filter(c => {
              if (!c.completed_at) return true;
              const completedTime = new Date(c.completed_at).getTime();
              const thirtyMinutes = 30 * 60 * 1000;
              return currentTime.getTime() - completedTime < thirtyMinutes;
            })
            .slice((campaignsPage - 1) * CAMPAIGNS_PER_PAGE, campaignsPage * CAMPAIGNS_PER_PAGE)
            .map((c) => {
            const pct = Math.min(100, Math.round((c.current_amount / c.target_amount) * 100));
            const donorsCount = c.donor_count || 0;
            const isGoalReached = c.current_amount >= c.target_amount;

            let countdownText = null;
            if (c.completed_at) {
              const remainingMs = (new Date(c.completed_at).getTime() + 30 * 60 * 1000) - currentTime.getTime();
              if (remainingMs > 0) {
                const mins = Math.floor(remainingMs / 60000);
                const secs = Math.floor((remainingMs % 60000) / 1000);
                countdownText = `${mins}:${secs.toString().padStart(2, '0')}`;
              }
            }

            return (
              <div key={c.id} className={`card p-6 relative overflow-hidden ${isGoalReached ? 'grayscale-[0.4] bg-primary-50/10' : ''}`}>
                {isGoalReached && (
                  <div className="absolute top-0 left-0 right-0 bg-primary/95 text-white text-[10px] font-bold uppercase tracking-widest py-1 text-center z-10">
                    Goal Reached {countdownText && `— Delisting in ${countdownText}`}
                  </div>
                )}
                <div className="flex items-start justify-between mb-2 mt-2">
                  <h3 className="font-bold text-lg text-text pr-2">{c.title}</h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge bg-gold-light/20 text-gold">
                      <Heart size={10} /> {donorsCount} donors
                    </span>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setEditingCampaign(c)}
                          className="w-7 h-7 rounded bg-background border border-border flex items-center justify-center text-text-secondary hover:bg-primary-50 hover:text-primary"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setDeletingCampaign(c)}
                          className="w-7 h-7 rounded bg-background border border-border flex items-center justify-center text-text-secondary hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-text-secondary mb-4">{c.description}</p>

                {c.images && c.images.length > 0 && (
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2 snap-x hide-scrollbar">
                    {c.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt="Campaign"
                        className="h-20 w-auto max-w-[120px] rounded-lg object-cover snap-start border border-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span className={`font-bold text-lg ${isGoalReached ? 'text-primary' : 'text-primary'}`}>
                    RM{c.current_amount.toLocaleString()}
                  </span>
                  <span className="text-text-muted">of RM{c.target_amount.toLocaleString()}</span>
                </div>
                <div className="progress-bar mb-1">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-text-muted mb-5 text-right">{t.progressLabel(pct)}</p>

                <button 
                  onClick={() => !isGoalReached && setDonateModal(c.id)} 
                  disabled={isGoalReached}
                  className={`w-full py-3 text-sm flex justify-center items-center gap-2 rounded-xl font-bold transition-all ${
                    isGoalReached 
                      ? "bg-text-muted/20 text-text-muted border border-border cursor-not-allowed" 
                      : "btn-primary"
                  }`}
                >
                  <HandHeart size={16} /> 
                  {isGoalReached ? "Goal Reached" : t.donateNow}
                </button>
              </div>
            );
          })
        )}
        <Pagination
          page={campaignsPage}
          total={campaigns.length}
          perPage={CAMPAIGNS_PER_PAGE}
          onChange={setCampaignsPage}
        />
      </div>

      {/* Donate Modal */}
      {donateModal && activeCampaign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setDonateModal(null)}>
          <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setDonateModal(null)} className="absolute top-4 right-4 z-20 text-white/50 hover:text-white transition bg-black/20 rounded-full p-1">
              <X size={20} />
            </button>
            <div className="hero-gradient p-6 text-white overflow-hidden rounded-t-2xl relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-surface/5 rounded-full -mt-16 -mr-16 blur-2xl" />
              <p className="text-sm text-white/60 relative z-10">Donate to</p>
              <h2 className="text-lg font-bold mt-1 relative z-10">{activeCampaign.title}</h2>
            </div>
            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Select Amount</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[20, 50, 100].map((amt) => (
                  <button 
                    key={amt} 
                    onClick={() => setDonationAmount(amt)}
                    className={`py-3 font-bold text-sm rounded-xl border transition-colors ${
                      donationAmount === amt 
                        ? "bg-primary text-white border-primary" 
                        : "bg-background text-primary border-primary hover:bg-primary-50"
                    }`}
                  >
                    RM{amt}
                  </button>
                ))}
              </div>
              
              <div className="mb-4">
                <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">Custom Amount (RM)</label>
                <input 
                  type="number" 
                  value={donationAmount} 
                  onChange={(e) => setDonationAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm outline-none focus:border-primary bg-background" 
                  min="1"
                />
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">Name (Optional)</label>
                  <input 
                    type="text" 
                    value={donorName} 
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Anonymous"
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm outline-none focus:border-primary bg-background" 
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">Email (Optional)</label>
                  <input 
                    type="email" 
                    value={donorEmail} 
                    onChange={(e) => setDonorEmail(e.target.value)}
                    placeholder="For receipt"
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm outline-none focus:border-primary bg-background" 
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">Phone (Optional)</label>
                  <input 
                    type="tel" 
                    value={donorPhone} 
                    onChange={(e) => setDonorPhone(e.target.value)}
                    placeholder="0123456789"
                    maxLength={15}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm outline-none focus:border-primary bg-background" 
                  />
                </div>
              </div>

              <button 
                onClick={handleDonate} 
                disabled={isProcessing || !donationAmount || donationAmount <= 0}
                className="w-full py-3.5 btn-primary text-sm flex justify-center items-center gap-2"
              >
                {isProcessing ? (
                  <><Loader2 size={16} className="animate-spin" /> Processing...</>
                ) : (
                  `Proceed to Pay RM${donationAmount}`
                )}
              </button>
              <p className="text-xs text-text-muted text-center mt-3">Secure payment via Stripe (Test Mode)</p>
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

      {/* Success Modal */}
      {showSuccessModal && (
        <DonationSuccessModal 
          donationId={showSuccessModal.id}
          onClose={() => {
            setShowSuccessModal(null);
            // Clean up URL only when modal is closed
            window.history.replaceState({}, document.title, window.location.pathname);
          }} 
          onShowReceipt={(id) => setShowReceiptModal(id)}
        />
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

// -------------------------------------------------------------------------------------------------
// Success Modal Component
// -------------------------------------------------------------------------------------------------

function DonationSuccessModal({ onClose, donationId, onShowReceipt }: { onClose: () => void, donationId: string, onShowReceipt: (id: string) => void }) {
  const { t } = useLanguage();
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-surface rounded-3xl w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.3)] relative overflow-hidden text-center scale-up-center" onClick={(e) => e.stopPropagation()}>
        <div className="hero-gradient py-12 px-6 text-white relative">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mt-20 -mr-20 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-light/20 rounded-full -mb-16 -ml-16 blur-2xl" />
          
          <div className="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center text-primary shadow-xl mb-6 relative z-10 bounce-in">
            <HandHeart size={40} strokeWidth={2.5} />
          </div>
          
          <h2 className="text-2xl font-black mb-2 tracking-tight relative z-10">{t.donationSuccess}</h2>
          <p className="text-white/80 text-sm font-medium relative z-10">Your contribution makes a huge difference!</p>
        </div>
        
        <div className="p-8">
          <p className="text-text-secondary text-sm leading-relaxed mb-8">
            Thank you for your generous donation. A receipt and confirmation has been sent to your email.
          </p>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={onClose}
              className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Done
            </button>
            <button 
              onClick={() => onShowReceipt(donationId)}
              className="w-full py-3 bg-surface-alt border border-border hover:bg-primary/5 hover:border-primary/30 rounded-xl text-xs font-bold text-text-secondary hover:text-primary transition-all flex items-center justify-center gap-2"
            >
              <Download size={14} />
              View Receipt
            </button>
          </div>
          
          <p className="text-[10px] text-text-muted mt-4 uppercase tracking-widest font-bold">Project Makmur Crowdfunding</p>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------------------
// Admin CRUD Components
// -------------------------------------------------------------------------------------------------

function CampaignFormModal({ mode, campaign, onClose, onSave }: { mode: "add" | "edit", campaign?: Campaign, onClose: () => void, onSave: (c: Campaign) => void }) {
  const isEdit = mode === "edit";
  const { t } = useLanguage();
  const [title, setTitle] = useState(campaign?.title || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [target, setTarget] = useState(String(campaign?.target_amount || "10000"));
  const [current, setCurrent] = useState(String(campaign?.current_amount || "0"));
  const [images, setImages] = useState(campaign?.images || []);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !target) return;
    setSaving(true);
    const supabase = createClient();

    try {
      let uploadedUrls: string[] = [];

      // Upload selected files if any
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${crypto.randomUUID()}.${fileExt}`;
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('campaigns')
            .upload(fileName, file);

          if (!uploadError && uploadData) {
            const { data: { publicUrl } } = supabase
              .storage
              .from('campaigns')
              .getPublicUrl(fileName);
            uploadedUrls.push(publicUrl);
          }
        }
      }

      // Keep existing images plus newly uploaded ones, limited to 4
      const finalImages = [...(Array.isArray(images) ? images : []), ...uploadedUrls].slice(0, 4);

      const payload = {
        title: title.trim(),
        description: description.trim(),
        target_amount: parseFloat(target) || 0,
        current_amount: parseFloat(current) || 0,
        images: finalImages
      };

      if (isEdit && campaign) {
        await Promise.race([
          supabase.from("crowdfund_campaigns").update(payload).eq("id", campaign.id),
          waitMs(5000)
        ]);
        onSave({ ...campaign, ...payload });
        toast.success("Campaign updated!");
      } else {
        const { data } = await Promise.race([
          supabase.from("crowdfund_campaigns").insert(payload).select().single(),
          waitMs(5000)
        ]) as any;
        // if timeout, provide a fallback visual update
        onSave(data || { id: crypto.randomUUID(), ...payload });
        toast.success("Campaign created!");
      }
      onClose();
    } catch {
      toast.error("Failed to save campaign.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 z-20 text-white/50 hover:text-white transition bg-black/20 rounded-full p-1">
          <X size={20} />
        </button>
        <div className="hero-gradient p-5 text-white overflow-hidden rounded-t-2xl relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-surface/5 rounded-full -mt-16 -mr-16 blur-2xl" />
          <h2 className="text-lg font-bold relative z-10">{isEdit ? t.campaignEditTitle : t.campaignAddTitle}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">{t.campaignFieldTitle}</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-border rounded-xl text-sm outline-none focus:border-primary bg-background" />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">{t.campaignFieldDesc}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-border rounded-xl text-sm outline-none focus:border-primary bg-background" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">{t.campaignFieldTarget}</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)} className="w-full px-3 py-2 border border-border rounded-xl text-sm outline-none focus:border-primary bg-background" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">{t.campaignFieldCurrent}</label>
              <input type="number" value={current} onChange={e => setCurrent(e.target.value)} className="w-full px-3 py-2 border border-border rounded-xl text-sm outline-none focus:border-primary bg-background" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase mb-1.5 block">{t.campaignFieldImages}</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                const currentSlots = Array.isArray(images) ? images.length : 0;
                const allowedNew = 4 - currentSlots;
                setSelectedFiles(files.slice(0, allowedNew));
              }}
              disabled={Array.isArray(images) && images.length >= 4}
              className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-primary-50 file:text-primary hover:file:bg-[#D5F5E3] cursor-pointer"
            />
            {selectedFiles.length > 0 && (
              <p className="text-xs text-text-muted mt-1">{t.campaignFilesSelected(selectedFiles.length)}</p>
            )}
            {Array.isArray(images) && images.length > 0 && (
              <div className="flex gap-2 mt-2">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img} className="h-10 w-10 object-cover rounded shadow-sm border border-border" />
                    <button title="Remove image" onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="w-full py-3.5 btn-primary text-sm mt-2 flex justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />} {saving ? t.campaignSaving : t.campaignSaveBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteCampaignModal({ campaign, onClose, onDelete }: { campaign: Campaign, onClose: () => void, onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const { t } = useLanguage();

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    await Promise.race([
      supabase.from("crowdfund_campaigns").delete().eq("id", campaign.id),
      waitMs(5000)
    ]);
    toast.success("Campaign deleted.");
    onDelete(campaign.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-red-50 dark:bg-red-950 p-5 flex items-center justify-between border-b border-red-100 dark:border-red-900">
          <div className="flex gap-3 items-center">
            <AlertTriangle className="text-red-500" />
            <h2 className="font-bold text-red-900 dark:text-red-200">{t.campaignDeleteTitle}</h2>
          </div>
          <button onClick={onClose} className="text-red-500 hover:text-red-700 bg-red-100 p-1 rounded-md"><X size={18} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-text-secondary mb-4">Are you sure you want to delete "{campaign.title}"?</p>
          <button onClick={handleDelete} disabled={deleting} className="w-full py-3 bg-red-500 text-white rounded-xl font-bold flex justify-center gap-2">
            {deleting && <Loader2 size={16} className="animate-spin" />} {deleting ? t.campaignDeleting : t.campaignDeleteBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
