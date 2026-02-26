"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface LiveStats {
  iftarPacksDistributed: number;
  activeVolunteers: number;
  donationsCollected: number;
  zakatCountersLive: number;
  isLoading: boolean;
}

// Seeded fallback values shown while DB is loading or unreachable
const FALLBACK: Omit<LiveStats, "isLoading"> = {
  iftarPacksDistributed: 1200,
  activeVolunteers: 85,
  donationsCollected: 12000,
  zakatCountersLive: 5,
};

export function useLiveStats(): LiveStats {
  const [stats, setStats] = useState<Omit<LiveStats, "isLoading">>(FALLBACK);
  const [isLoading, setIsLoading] = useState(false); // Start false so fallback shows immediately

  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      try {
        const supabase = createClient();

        // Use the SECURE RPC to get aggregated stats
        // This bypasses RLS for the SUM/COUNT while keeping individual rows private.
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_public_stats");

        if (!mounted) return;

        if (rpcError) {
          console.warn("useLiveStats RPC error, using fallbacks:", rpcError.message);
          return;
        }

        if (rpcData && rpcData.length > 0) {
          const row = rpcData[0];
          setStats({
            iftarPacksDistributed: Number(row.iftar_packs_distributed),
            activeVolunteers: Number(row.active_volunteers),
            donationsCollected: Number(row.donations_collected),
            zakatCountersLive: Number(row.zakat_counters_live),
          });
        }
      } catch (err) {
        console.warn("useLiveStats: using fallback values:", err);
      }
    };

    fetchStats();

    // Re-fetch stats on any relevant table change
    const supabase = createClient();
    const channel = supabase
      .channel("live-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "food_events" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "kupon_claims" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, fetchStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "zakat_counters" }, fetchStats)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { ...stats, isLoading };
}
