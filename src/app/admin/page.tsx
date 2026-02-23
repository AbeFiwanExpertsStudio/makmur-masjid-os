"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Shield,
  Send, ScanLine, Award, Ban, Bell, Settings, Loader2, Search, CheckCircle,
  ShieldOff, ShieldCheck, UserCheck, Pencil, Trash2, Camera, Keyboard
} from "lucide-react";
import CameraScanner from "@/components/admin/CameraScanner";
import { useAuth } from "@/components/providers/AuthContext";
import { scanKupon } from "@/lib/mutations/claims";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { createClient } from "@/lib/supabase/client";
import { toast } from "react-hot-toast";
import { useLanguage } from "@/components/providers/LanguageContext";

const mockDonations = [
  { label: "Replace 5 broken fans in Women's Section", amount: 850 },
  { label: "Iftar Sponsorship Week 1", amount: 1200 },
];

type UserEntry = { id: string; email: string; display_name: string; role: string; is_banned: boolean; total_points: number };
type ActionType = 'ban' | 'unban' | 'demote' | 'promote';
type GigEntry = {
  id: string;
  title: string;
  gig_date: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  completed_at: string | null;
};
type BroadcastEntry = {
  id: string;
  message: string;
  is_active: boolean;
  created_at: string;
};
type UnclaimedKupon = {
  id: string;
  event_id: string;
  event_name: string;
  guest_uuid: string;
  display_name: string;
  claimed_at: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

function formatTime(t: string) {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${ampm}`;
}

export default function AdminPage() {
  const { signOut, user } = useAuth();
  const { t } = useLanguage();
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [cameraMode, setCameraMode] = useState(false);
  const [scanHistory, setScanHistory] = useState<{ id: string, status: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [unclaimedKupons, setUnclaimedKupons] = useState<UnclaimedKupon[]>([]);
  const [unclaimedRefreshKey, setUnclaimedRefreshKey] = useState(0);
  const [showUnclaimed, setShowUnclaimed] = useState(true);
  const settings = useSystemSettings();

  // User Management
  const [usersList, setUsersList] = useState<UserEntry[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [usersError, setUsersError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Action Modal
  const [actionModal, setActionModal] = useState<{
    type: ActionType;
    user: UserEntry;
  } | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  // Gigs from DB
  const [gigs, setGigs] = useState<GigEntry[]>([]);
  const [gigsRefreshKey, setGigsRefreshKey] = useState(0);

  // Broadcasts
  const [broadcasts, setBroadcasts] = useState<BroadcastEntry[]>([]);
  const [broadcastRefreshKey, setBroadcastRefreshKey] = useState(0);
  const [editingBroadcast, setEditingBroadcast] = useState<BroadcastEntry | null>(null);
  const [editMsg, setEditMsg] = useState("");

  // Live clock — drives the 12-hour countdown on completed gigs
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const latestBroadcast = broadcasts.find(b => b.is_active)?.message ?? "";

  // Fetch unclaimed kupons
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc('admin_get_unclaimed_kupons').then(({ data, error }) => {
      if (!error && data) setUnclaimedKupons(data as UnclaimedKupon[]);
    });
  }, [unclaimedRefreshKey]);

  // Fetch users
  useEffect(() => {
    async function fetchUsers() {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('admin_get_all_users');
      if (error) {
        console.error('admin_get_all_users RPC error:', error.message);
        setUsersError(error.message);
      } else {
        setUsersError(null);
        setUsersList(data ?? []);
      }
    }
    fetchUsers();
  }, [refreshKey]);

  // Fetch gigs from DB
  useEffect(() => {
    async function fetchGigs() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('volunteer_gigs')
        .select('id, title, gig_date, start_time, end_time, is_completed, completed_at')
        .order('gig_date', { ascending: false });
      if (error) console.error('Fetch gigs error:', error.message);
      if (data) setGigs(data);
    }
    fetchGigs();
  }, [gigsRefreshKey]);

  // Fetch broadcasts
  useEffect(() => {
    async function fetchBroadcasts() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('system_broadcasts')
        .select('id, message, is_active, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!error && data) {
        // Deduplicate by message — keep the first (most recent) occurrence of each
        const seen = new Set<string>();
        const unique = data.filter(b => {
          if (seen.has(b.message)) return false;
          seen.add(b.message);
          return true;
        });
        setBroadcasts(unique.slice(0, 10));
      }
    }
    fetchBroadcasts();
  }, [broadcastRefreshKey]);

  // Filter users
  const visibleUsers = usersList
    .filter(u => u.email)
    .filter(u => {
      if (!userSearch.trim()) return true;
      const q = userSearch.toLowerCase();
      return u.email.toLowerCase().includes(q) || (u.display_name || '').toLowerCase().includes(q);
    });

  const totalCollected = mockDonations.reduce((s, d) => s + d.amount, 0);

  // Gig logic: filter to past gigs, deduplicate, sort completed to bottom
  const now = currentTime;
  const pastGigs = gigs.filter(g => {
    const gigEnd = new Date(`${g.gig_date}T${g.end_time}`);
    return gigEnd < now;
  });
  // Deduplicate by title+date+time (in case of duplicate DB rows)
  const seen = new Set<string>();
  const uniquePastGigs = pastGigs.filter(g => {
    const key = `${g.title}|${g.gig_date}|${g.start_time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const visibleGigs = uniquePastGigs
    .filter(g => {
      if (!g.is_completed) return true;
      // If completed but no timestamp recorded, hide it (treat as already expired)
      if (!g.completed_at) return false;
      return (currentTime.getTime() - new Date(g.completed_at).getTime()) < 12 * 60 * 60 * 1000;
    })
    .sort((a, b) => {
      if (a.is_completed && !b.is_completed) return 1;
      if (!a.is_completed && b.is_completed) return -1;
      return 0;
    });

  const handleCompleteGig = async (gigId: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc('complete_gig', { p_gig_id: gigId });
      if (error) {
        toast.error(`Failed: ${error.message}`);
      } else {
        toast.success("Gig completed! Points awarded to volunteers.");
        setGigsRefreshKey(k => k + 1);
      }
    } catch {
      toast.error("An unexpected error occurred.");
    }
  };

  // Send broadcast
  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim() || isSendingBroadcast) return;
    setIsSendingBroadcast(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc('send_broadcast', { msg: broadcastMsg.trim() });
      if (error) {
        toast.error(`Broadcast failed: ${error.message}`);
      } else {
        toast.success("Broadcast sent to all users!");
        setBroadcastMsg("");
        setBroadcastRefreshKey(k => k + 1);
      }
    } catch {
      toast.error("Failed to send broadcast.");
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // Edit broadcast
  const handleEditBroadcast = async () => {
    if (!editingBroadcast || !editMsg.trim()) return;
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('system_broadcasts')
        .update({ message: editMsg.trim() })
        .eq('id', editingBroadcast.id);
      if (error) {
        toast.error(`Edit failed: ${error.message}`);
      } else {
        toast.success("Broadcast updated!");
        setEditingBroadcast(null);
        setEditMsg("");
        setBroadcastRefreshKey(k => k + 1);
      }
    } catch {
      toast.error("Failed to edit broadcast.");
    }
  };

  // Delete broadcast
  const handleDeleteBroadcast = async (id: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc('delete_broadcast', { broadcast_id: id });
      if (error) {
        toast.error(`Delete failed: ${error.message}`);
      } else {
        toast.success("Broadcast deleted.");
        setBroadcastRefreshKey(k => k + 1);
      }
    } catch {
      toast.error("Failed to delete broadcast.");
    }
  };

  // User action handler
  const handleUserAction = async () => {
    if (!actionModal || isActioning) return;

    // Prevent self-ban or self-demote
    if (
      (actionModal.type === 'ban' || actionModal.type === 'demote') &&
      actionModal.user.email === user?.email
    ) {
      toast.error("You cannot ban or demote your own account.");
      setActionModal(null);
      return;
    }

    setIsActioning(true);
    const supabase = createClient();

    const rpcMap: Record<ActionType, string> = {
      ban: 'ban_user',
      unban: 'unban_user',
      demote: 'demote_admin',
      promote: 'promote_user_to_admin',
    };

    try {
      const { error } = await supabase.rpc(rpcMap[actionModal.type], {
        target_email: actionModal.user.email,
      });
      if (error) {
        toast.error(`Failed: ${error.message}`);
      } else {
        const msgs: Record<ActionType, string> = {
          ban: `${actionModal.user.email} has been banned.`,
          unban: `${actionModal.user.email} has been unbanned.`,
          demote: `${actionModal.user.email} has been demoted to Volunteer.`,
          promote: `${actionModal.user.email} has been promoted to Admin!`,
        };
        toast.success(msgs[actionModal.type]);
        setRefreshKey(k => k + 1);
      }
    } catch (e) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsActioning(false);
      setActionModal(null);
    }
  };

  const handleScan = async (overrideValue?: string) => {
    const raw = overrideValue ?? scanInput;
    if (!raw.trim() || isScanning) return;
    const input = raw.trim();
    setIsScanning(true);
    if (!overrideValue) setScanInput("");

    try {
      const res = await scanKupon(input);
      if (res.success) {
        setScanHistory((prev) => [{ id: input, status: "Scanned ✓" }, ...prev]);
        toast.success(`Successfully scanned! Remaining capacity: ${res.remaining}`);
        setUnclaimedRefreshKey(k => k + 1);
      } else {
        toast.error(res.error || "Failed to scan kupon");
        setScanHistory((prev) => [{ id: input, status: "Failed ❌" }, ...prev]);
      }
    } catch (e: any) {
      toast.error("Error scanning kupon");
    } finally {
      setIsScanning(false);
    }
  };

  const handleCameraQR = useCallback((raw: string) => {
    // Strip the app prefix if present, then pass straight to handleScan
    const PREFIX = "makmur-kupon:";
    const value = raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw;
    handleScan(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Action modal config
  const actionConfig: Record<ActionType, { icon: typeof Ban; color: string; btnColor: string; title: string; desc: (email: string) => string; confirm: string }> = {
    ban: {
      icon: Ban,
      color: 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400',
      btnColor: 'bg-red-500 hover:bg-red-600',
      title: t.adminBanTitle,
      desc: (e) => t.adminBanDesc(e),
      confirm: t.adminBanConfirm,
    },
    unban: {
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400',
      btnColor: 'bg-emerald-500 hover:bg-emerald-600',
      title: t.adminUnbanTitle,
      desc: (e) => t.adminUnbanDesc(e),
      confirm: t.adminUnbanConfirm,
    },
    demote: {
      icon: ShieldOff,
      color: 'bg-amber-50 text-amber-500 dark:bg-amber-900/30 dark:text-amber-400',
      btnColor: 'bg-amber-500 hover:bg-amber-600',
      title: t.adminDemoteTitle,
      desc: (e) => t.adminDemoteDesc(e),
      confirm: t.adminDemoteConfirm,
    },
    promote: {
      icon: ShieldCheck,
      color: 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
      btnColor: 'bg-blue-500 hover:bg-blue-600',
      title: t.adminPromoteTitle,
      desc: (e) => t.adminPromoteDesc(e),
      confirm: t.adminPromoteConfirm,
    },
  };

  return (
    <div className="min-h-screen">
      {/* Broadcast banner — OUTSIDE container, directly under navbar */}
      {latestBroadcast && (
        <div className="hero-gradient text-white px-4 py-3 flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-surface/15 flex items-center justify-center shrink-0">
            <Bell size={12} />
          </div>
          <span className="text-sm"><strong>{t.dashboardLatestBroadcast}:</strong> <span className="text-white/70">{latestBroadcast}</span></span>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="w-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="icon-box icon-box-primary"><Shield size={22} /></div>
            <div>
              <h1 className="text-2xl font-bold text-text">{t.adminTitle}</h1>
              <p className="text-sm text-text-muted">{t.adminSubtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Financials */}
            <div className="card p-6">
              <h2 className="font-bold text-lg text-text mb-4">{t.adminFinancials}</h2>
              <div className="hero-gradient rounded-xl p-5 mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">{t.adminTotalCollected}</p>
                <p className="text-3xl font-bold text-white">RM {totalCollected.toLocaleString()}</p>
              </div>
              <div className="space-y-3">
                {mockDonations.map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-dashed border-border last:border-0">
                    <span className="text-text-secondary">{d.label}</span>
                    <span className="font-bold text-text">RM {d.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Broadcast — with history + edit/delete */}
            <div className="card p-6">
              <h2 className="font-bold text-lg text-text mb-2">{t.adminBroadcast}</h2>
              <p className="text-sm text-text-muted mb-4">{t.adminBroadcastDesc}</p>
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="e.g., Tarawih delayed by 15 mins due to rain..."
                className="w-full border border-border rounded-xl p-3 text-sm resize-none h-20 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background mb-3"
              />
              <button
                onClick={handleSendBroadcast}
                disabled={!broadcastMsg.trim() || isSendingBroadcast}
                className="w-full py-3 btn-primary text-sm disabled:opacity-50 flex justify-center items-center gap-2 mb-4"
              >
                {isSendingBroadcast ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {isSendingBroadcast ? t.adminSending : t.adminBlastMsg}
              </button>

              {/* Broadcast history */}
              {broadcasts.length > 0 && (
                <>
                  <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">{t.adminRecentBroadcasts}</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {broadcasts.map((b) => (
                      <div key={b.id} className={`flex items-start justify-between gap-2 border rounded-xl px-3 py-2.5 group ${
                        b.is_active
                          ? 'bg-primary-50/30 border-primary/20 dark:bg-primary/5'
                          : 'bg-background border-border opacity-50'
                      }`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {b.is_active && <span className="text-[9px] font-bold uppercase tracking-widest text-primary">{t.adminBroadcastActive}</span>}
                            {!b.is_active && <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted">{t.adminBroadcastArchived}</span>}
                          </div>
                          <p className="text-sm text-text truncate">{b.message}</p>
                          <p className="text-[10px] text-text-muted">{timeAgo(b.created_at)}</p>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingBroadcast(b); setEditMsg(b.message); }}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/30 transition"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteBroadcast(b.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Scanner */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-lg text-text">{t.adminScanner}</h2>
                {/* Mode toggle */}
                <div className="flex bg-background border border-border rounded-xl overflow-hidden text-xs font-medium">
                  <button
                    onClick={() => setCameraMode(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                      !cameraMode ? "bg-primary text-white" : "text-text-muted hover:bg-surface"
                    }`}
                  >
                    <Keyboard size={13} /> {t.adminManual}
                  </button>
                  <button
                    onClick={() => setCameraMode(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                      cameraMode ? "bg-primary text-white" : "text-text-muted hover:bg-surface"
                    }`}
                  >
                    <Camera size={13} /> {t.adminCamera}
                  </button>
                </div>
              </div>
              <p className="text-sm text-text-muted mb-4">{t.adminScanDesc}</p>

              {cameraMode ? (
                <div className="mb-4">
                  <CameraScanner onScan={handleCameraQR} />
                  {isScanning && (
                    <p className="text-xs text-text-muted text-center mt-2 flex items-center justify-center gap-1">
                      <Loader2 size={12} className="animate-spin" /> Processing…
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder={t.adminScanInput}
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleScan()}
                    className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                  <button
                    onClick={() => handleScan()}
                    disabled={isScanning}
                    className="p-2.5 btn-primary rounded-xl disabled:opacity-50"
                  >
                    {isScanning ? <Loader2 size={20} className="animate-spin" /> : <ScanLine size={20} />}
                  </button>
                </div>
              )}

              {/* Unclaimed list */}
              <div className="mt-4">
                <button
                  onClick={() => setShowUnclaimed(v => !v)}
                  className="flex items-center justify-between w-full text-sm font-semibold text-text mb-2"
                >
                  <span className="flex items-center gap-2">
                    {t.adminUnclaimedKupons}
                    <span className="inline-flex items-center justify-center text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 rounded-full px-2 py-0.5 min-w-[1.4rem]">
                      {unclaimedKupons.length}
                    </span>
                  </span>
                  <span className="text-text-muted text-xs">{showUnclaimed ? `▲ ${t.adminHide}` : `▼ ${t.adminShow}`}</span>
                </button>

                {showUnclaimed && (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {unclaimedKupons.length === 0 ? (
                      <p className="text-xs text-text-muted text-center py-4">{t.adminAllScanned}</p>
                    ) : (
                      unclaimedKupons.map((k) => (
                        <button
                          key={k.id}
                          onClick={() => { setScanInput(k.id); setCameraMode(false); }}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-background border border-border rounded-xl hover:border-primary/50 hover:bg-primary-50/30 dark:hover:bg-primary/5 transition-colors text-left"
                          title="Tap to fill input"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text truncate">{k.display_name || t.adminGuest}</p>
                            <p className="text-xs text-text-muted truncate">{k.event_name}</p>
                          </div>
                          <span className="shrink-0 text-xs font-mono text-text-muted bg-surface px-2 py-0.5 rounded-lg border border-border">
                            #{k.id.slice(0, 6)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Scan history */}
              {scanHistory.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">{t.adminSessionHistory}</p>
                  {scanHistory.map((s, i) => (
                    <div key={i} className="flex justify-between items-center text-sm px-4 py-2.5 bg-background rounded-xl border border-border">
                      <span className="font-mono text-text-secondary truncate max-w-[70%]">{s.id}</span>
                      <span className={`font-semibold shrink-0 ${
                        s.status.startsWith("Scanned") ? "text-primary" :
                        s.status.startsWith("Failed") ? "text-red-500" : "text-gold"
                      }`}>{s.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gig Completion — from DB */}
            <div className="card p-6">
              <h2 className="font-bold text-lg text-text mb-2">{t.adminGigCompletion}</h2>
              <p className="text-sm text-text-muted mb-4">{t.adminGigCompletionDesc}</p>

              {visibleGigs.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {visibleGigs.map((g) => (
                    <div
                      key={g.id}
                      className={`flex justify-between items-center bg-background border rounded-xl px-4 py-3 transition-all duration-500 ${
                        g.is_completed
                          ? 'border-primary/30 bg-primary-50/30 dark:bg-primary/5 opacity-70'
                          : 'border-border'
                      }`}
                    >
                      <div>
                        <span className={`text-sm font-medium ${g.is_completed ? 'text-text-muted line-through' : 'text-text'}`}>{g.title}</span>
                        <span className="text-xs text-text-muted block">
                          {new Date(g.gig_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })} · {formatTime(g.start_time)} – {formatTime(g.end_time)}
                        </span>
                      </div>
                      {g.is_completed ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="badge bg-primary-50 text-primary border border-primary/20 text-xs">
                            <CheckCircle size={12} /> {t.adminAwardedLabel}
                          </span>
                          {g.completed_at && (() => {
                            const remainMs = 12 * 60 * 60 * 1000 - (currentTime.getTime() - new Date(g.completed_at).getTime());
                            const totalSec = Math.max(0, Math.floor(remainMs / 1000));
                            const h = Math.floor(totalSec / 3600);
                            const m = Math.floor((totalSec % 3600) / 60);
                            const s = totalSec % 60;
                            return (
                              <span className="text-[10px] text-text-muted font-mono">
                                {t.adminClearsIn(h, m, s)}
                              </span>
                            );
                          })()}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCompleteGig(g.id)}
                          className="badge bg-primary-50 text-primary border border-[#D5F5E3] hover:bg-[#D5F5E3] hover:scale-105 active:scale-95 transition-all text-xs"
                        >
                          <Award size={12} /> {t.adminCompleteAward}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-6">{t.adminNoPastGigs}</p>
              )}
            </div>
          </div>

          {/* ─── Full-Width User Management Section ─── */}
          <div className="card p-6 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-text" />
                <h2 className="font-bold text-lg text-text">{t.adminManageUsers}</h2>
                <span className="text-xs text-text-muted bg-surface-muted px-2 py-0.5 rounded-full">{visibleUsers.length}</span>
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-3 text-text-muted" />
                <input
                  type="text"
                  placeholder={t.adminSearchUsers}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-96 space-y-2 pr-1">
              {visibleUsers.map((u) => (
                <div key={u.id} className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${
                  u.is_banned
                    ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                    : 'bg-background border-border hover:border-primary/30'
                }`}>
                  <div className="min-w-0 flex-1 mr-3">
                    <span className="text-sm font-medium text-text block truncate">{u.display_name || u.email.split('@')[0]}</span>
                    <span className="text-xs text-text-muted truncate block">{u.email}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {(u.total_points ?? 0) > 0 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-gold-light/20 text-gold">
                        ⭐ {u.total_points} pts
                      </span>
                    )}
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${
                      u.is_banned
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                        : u.role === 'admin'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                          : 'bg-primary-50 text-primary'
                    }`}>
                      {u.is_banned ? t.adminBanned : u.role}
                    </span>

                    {u.is_banned ? (
                      <button
                        onClick={() => setActionModal({ type: 'unban', user: u })}
                        className="badge bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/50 transition text-xs"
                      >
                        <UserCheck size={12} /> {t.adminUnban}
                      </button>
                    ) : (
                      <>
                        {u.role === 'volunteer' && (
                          <button
                            onClick={() => setActionModal({ type: 'promote', user: u })}
                            className="badge bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/50 transition text-xs"
                          >
                            <ShieldCheck size={12} /> {t.adminPromote}
                          </button>
                        )}
                        {u.role === 'admin' && (
                          <button
                            onClick={() => setActionModal({ type: 'demote', user: u })}
                            className="badge bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/50 transition text-xs"
                          >
                            <ShieldOff size={12} /> {t.adminDemote}
                          </button>
                        )}
                        <button
                          onClick={() => setActionModal({ type: 'ban', user: u })}
                          className="badge bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/50 transition text-xs"
                        >
                          <Ban size={12} /> {t.adminBan}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {visibleUsers.length === 0 && (
                <p className="text-sm text-text-muted text-center py-8">
                  {usersError
                    ? <span className="text-red-500">Error: {usersError}</span>
                    : userSearch ? t.adminNoUsersSearch : t.adminNoUsers}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <SystemSettingsEditor initialName={settings.system_name} initialDesc={settings.system_desc} />
          </div>
        </div>
      </div>

      {/* Unified Action Confirmation Modal */}
      {actionModal && (() => {
        const config = actionConfig[actionModal.type];
        const Icon = config.icon;
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setActionModal(null)}>
            <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto ${config.color}`}>
                <Icon size={24} />
              </div>
              <h3 className="text-lg font-bold text-text text-center mb-2">{config.title}</h3>
              <p className="text-sm text-text-muted text-center mb-6">
                {config.desc(actionModal.user.email)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setActionModal(null)}
                  className="flex-1 py-3 border border-border rounded-xl text-sm font-bold text-text hover:bg-background transition"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleUserAction}
                  disabled={isActioning}
                  className={`flex-1 py-3 text-white rounded-xl text-sm font-bold shadow-md transition flex justify-center items-center ${config.btnColor}`}
                >
                  {isActioning ? <Loader2 size={16} className="animate-spin" /> : config.confirm}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Broadcast Modal */}
      {editingBroadcast && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setEditingBroadcast(null)}>
          <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4 mx-auto">
              <Pencil size={24} />
            </div>
            <h3 className="text-lg font-bold text-text text-center mb-2">{t.adminEditBroadcastTitle}</h3>
            <p className="text-xs text-text-muted text-center mb-4">{t.adminEditBroadcastHint}</p>
            <textarea
              value={editMsg}
              onChange={(e) => setEditMsg(e.target.value)}
              className="w-full border border-border rounded-xl p-3 text-sm resize-none h-24 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditingBroadcast(null)}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-bold text-text hover:bg-background transition"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleEditBroadcast}
                disabled={!editMsg.trim()}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md transition disabled:opacity-50"
              >
                {t.adminSaveBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SystemSettingsEditor({ initialName, initialDesc }: { initialName: string, initialDesc: string }) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDesc);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(initialName);
    setDesc(initialDesc);
  }, [initialName, initialDesc]);

  const handleSave = async () => {
    if (!name.trim() || !desc.trim()) return;
    setSaving(true);
    const supabase = createClient();
    try {
      await supabase.from("system_settings").update({
        system_name: name.trim(),
        system_desc: desc.trim(),
        updated_at: new Date().toISOString()
      }).eq("id", 1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const isChanged = name !== initialName || desc !== initialDesc;

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings size={18} className="text-text" />
        <h2 className="font-bold text-lg text-text">{t.adminSystemBranding}</h2>
      </div>
      <p className="text-sm text-text-muted mb-4">{t.adminBrandingDesc}</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-1 block">{t.adminSystemName}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-1 block">{t.adminDescriptionLabel}</label>
          <input
            type="text"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !isChanged}
          className="w-full mt-2 py-2.5 btn-primary text-sm flex justify-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
