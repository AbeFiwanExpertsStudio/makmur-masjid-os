"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Loader2, ScanLine } from "lucide-react";
import Link from "next/link";
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
import ProgramsManagementCard from "@/components/admin/ProgramsManagementCard";
import BroadcastTicker from "@/components/layout/BroadcastTicker";
import type { MosqueProgram } from "@/types/database";

export default function AdminPage() {
  const { user, isAdmin, isLoading } = useAuth();
  const { t } = useLanguage();
  const settings = useSystemSettings();
  const router = useRouter();

  // ── Data state ────────────────────────────────────────────
  const [usersList, setUsersList] = useState<UserEntry[]>([]);
  const [usersRefreshKey, setUsersRefreshKey] = useState(0);

  const [gigs, setGigs] = useState<GigEntry[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastEntry[]>([]);
  const [unclaimedKupons, setUnclaimedKupons] = useState<UnclaimedKupon[]>([]);
  const [programs, setPrograms] = useState<MosqueProgram[]>([]);

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
      .select("id, title, gig_date, start_time, end_time, is_completed, is_cancelled, completed_at, gig_claims(count)")
      .order("gig_date", { ascending: false });

    if (data) {
      const mapped = data.map((row: any) => ({
        ...row,
        participant_count: row.gig_claims?.[0]?.count ?? 0
      }));
      setGigs(mapped);
    }
  }, []);

  const fetchPrograms = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("mosque_programs")
      .select("*")
      .order("program_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (data) setPrograms(data as MosqueProgram[]);
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

  // ── Guard: redirect non-admins ────────────────────────────
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      toast.error("Access Denied: Admin Privileges Required");
      router.push("/");
    }
  }, [isLoading, isAdmin, router]);

  // ── Initial fetch + real-time subscriptions ───────────────
  useEffect(() => {
    if (!isAdmin) return;
    fetchUnclaimedKupons();
    fetchGigs();
    fetchBroadcasts();
    fetchPrograms();

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

    // Programs: re-fetch on mosque_programs change
    const programsChannel = supabase
      .channel("admin-mosque-programs")
      .on("postgres_changes", { event: "*", schema: "public", table: "mosque_programs" }, fetchPrograms)
      .subscribe();

    return () => {
      supabase.removeChannel(kuponChannel);
      supabase.removeChannel(gigsChannel);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(programsChannel);
    };
  }, [fetchUnclaimedKupons, fetchGigs, fetchBroadcasts, fetchPrograms]);

  useEffect(() => {
    async function fetchUsers() {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("admin_get_all_users");
      if (!error) setUsersList(data ?? []);
      else console.error("admin_get_all_users error:", error.message);
    }
    fetchUsers();
  }, [usersRefreshKey]);

  if (isLoading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] gap-3 text-text-muted">
        <Loader2 className="animate-spin" size={24} />
        <span>Verifying access...</span>
      </div>
    );
  }

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
          {/* ── Facility Booking Scanner quick-link ── */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="icon-box icon-box-primary"><ScanLine size={18} /></div>
              <div>
                <h2 className="text-base font-bold text-text">{t.scanBookingTitle}</h2>
                <p className="text-xs text-text-muted">{t.scanBookingSubtitle}</p>
              </div>
            </div>
            <Link
              href="/admin/scan-booking"
              className="mt-auto w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm text-center transition-all shadow-md"
            >
              {t.scanBookingTitle}
            </Link>
          </div>
          <GigCompletionCard
            gigs={gigs}
            onRefresh={fetchGigs}
          />
          <ProgramsManagementCard
            programs={programs}
            onRefresh={fetchPrograms}
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
