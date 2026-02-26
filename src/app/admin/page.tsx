"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthContext";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/providers/LanguageContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

// ── Sub-components (split from the original monolithic page) ──
import FinancialsCard from "@/components/admin/FinancialsCard";
import BroadcastCard, { type BroadcastEntry } from "@/components/admin/BroadcastCard";
import KuponScannerCard, { type UnclaimedKupon } from "@/components/admin/KuponScannerCard";
import GigCompletionCard, { type GigEntry } from "@/components/admin/GigCompletionCard";
import UserManagementSection, { type UserEntry } from "@/components/admin/UserManagementSection";
import SystemSettingsEditor from "@/components/admin/SystemSettingsEditor";
import SkrinMasjidEditor from "@/components/admin/SkrinMasjidEditor";
import BroadcastTicker from "@/components/layout/BroadcastTicker";

export default function AdminPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const { t } = useLanguage();
  const settings = useSystemSettings();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      toast.error("Access Denied: Admin Privileges Required");
      router.push("/");
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] gap-3 text-text-muted">
        <Loader2 className="animate-spin" size={24} />
        <span>Verifying access...</span>
      </div>
    );
  }

  // ── Data state ────────────────────────────────────────────
  const [usersList, setUsersList] = useState<UserEntry[]>([]);
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

  const [gigs, setGigs] = useState<GigEntry[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastEntry[]>([]);
  const [unclaimedKupons, setUnclaimedKupons] = useState<UnclaimedKupon[]>([]);

  // ── Fetchers ──────────────────────────────────────────────
  const fetchUnclaimedKupons = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_get_unclaimed_kupons");
    if (!error && data) setUnclaimedKupons(data as UnclaimedKupon[]);
  }, []);

  const fetchGigs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("volunteer_gigs")
      .select("id, title, gig_date, start_time, end_time, is_completed, is_cancelled, completed_at")
      .order("gig_date", { ascending: false });
    if (data) setGigs(data);
  }, []);

  const fetchBroadcasts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("system_broadcasts")
      .select("id, message, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      const seen = new Set<string>();
      setBroadcasts(
        data
          .filter((b) => {
            if (seen.has(b.message)) return false;
            seen.add(b.message);
            return true;
          })
          .slice(0, 10)
      );
    }
  }, []);

  // ── Initial fetch + real-time subscriptions ───────────────
  useEffect(() => {
    fetchUnclaimedKupons();
    fetchGigs();
    fetchBroadcasts();

    const supabase = createClient();

    // Kupons: re-fetch when any claim is inserted, updated, or deleted
    const kuponChannel = supabase
      .channel("admin-kupon-claims")
      .on("postgres_changes", { event: "*", schema: "public", table: "kupon_claims" }, fetchUnclaimedKupons)
      .on("postgres_changes", { event: "*", schema: "public", table: "food_events" }, fetchUnclaimedKupons)
      .subscribe();

    // Gigs: re-fetch on any volunteer_gigs change
    const gigsChannel = supabase
      .channel("admin-volunteer-gigs")
      .on("postgres_changes", { event: "*", schema: "public", table: "volunteer_gigs" }, fetchGigs)
      .subscribe();

    // Broadcasts: re-fetch on any system_broadcasts change
    const broadcastChannel = supabase
      .channel("admin-system-broadcasts")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_broadcasts" }, fetchBroadcasts)
      .subscribe();

    return () => {
      supabase.removeChannel(kuponChannel);
      supabase.removeChannel(gigsChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [fetchUnclaimedKupons, fetchGigs, fetchBroadcasts]);

  useEffect(() => {
    async function fetchUsers() {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("admin_get_all_users");
      if (!error) setUsersList(data ?? []);
      else console.error("admin_get_all_users error:", error.message);
    }
    fetchUsers();
  }, [usersRefreshKey]);

  const latestBroadcast = broadcasts.find((b) => b.is_active)?.message ?? "";

  return (
    <div className="min-h-screen">
      {latestBroadcast && <BroadcastTicker message={latestBroadcast} />}

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="icon-box icon-box-primary"><Shield size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold text-text">{t.adminTitle}</h1>
            <p className="text-sm text-text-muted">{t.adminSubtitle}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FinancialsCard />
          <BroadcastCard
            broadcasts={broadcasts}
            onRefresh={fetchBroadcasts}
          />
          <KuponScannerCard
            unclaimedKupons={unclaimedKupons}
            onRefresh={fetchUnclaimedKupons}
          />
          <GigCompletionCard
            gigs={gigs}
            onRefresh={fetchGigs}
          />
        </div>

        <div className="mt-6">
          <UserManagementSection
            users={usersList}
            onRefresh={() => setUsersRefreshKey((k) => k + 1)}
            currentUserEmail={user?.email}
          />
        </div>

        <div className="mt-6">
          <SystemSettingsEditor
            initialName={settings.system_name ?? ""}
            initialDesc={settings.system_desc ?? ""}
          />
        </div>

        <div className="mt-6">
          <SkrinMasjidEditor />
        </div>
      </div>
    </div>
  );
}
