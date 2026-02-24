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

        // Run all queries in parallel
        const [eventsRes, volRes, donRes, zakatRes] = await Promise.all([
          supabase.from("food_events").select("total_capacity, remaining_capacity"),
          supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "volunteer"),
          supabase.from("donations").select("amount"),
          supabase.from("zakat_counters").select("start_date, end_date, start_time, end_time, is_active"),
        ]);

        if (!mounted) return;

        const iftarPacksDistributed = (eventsRes.data ?? []).reduce(
          (acc: number, e: { total_capacity: number; remaining_capacity: number }) =>
            acc + (e.total_capacity - e.remaining_capacity),
          0
        );

        const donationsCollected = (donRes.data ?? []).reduce(
          (acc: number, d: { amount: number }) => acc + (d.amount ?? 0),
          0
        );

        // Calculate live zakat counters dynamically
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hr = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        
        const currentDate = `${yyyy}-${mm}-${dd}`;
        const currentTime = `${hr}:${min}:${sec}`;

        let liveCountersCount = 0;
        (zakatRes.data ?? []).forEach(zc => {
          if (zc.start_date && zc.end_date && zc.start_time && zc.end_time) {
            const cleanStartTime = zc.start_time.split('.')[0];
            const cleanEndTime = zc.end_time.split('.')[0];
            
            if (currentDate >= zc.start_date && currentDate <= zc.end_date) {
               if (currentDate === zc.start_date && currentTime < cleanStartTime) {
                 // Not started yet
               } else if (currentDate === zc.end_date && currentTime > cleanEndTime) {
                 // Already finished
               } else {
                 liveCountersCount++;
               }
            }
          } else if (zc.is_active) {
             liveCountersCount++;
          }
        });

        const newStats: Omit<LiveStats, "isLoading"> = {
          iftarPacksDistributed: eventsRes.error ? FALLBACK.iftarPacksDistributed : iftarPacksDistributed,
          activeVolunteers: volRes.error ? FALLBACK.activeVolunteers : (volRes.count ?? 0),
          donationsCollected: donRes.error ? FALLBACK.donationsCollected : donationsCollected,
          zakatCountersLive: zakatRes.error ? FALLBACK.zakatCountersLive : liveCountersCount,
        };

        setStats(newStats);
      } catch (err) {
        console.warn("useLiveStats: using fallback values:", err);
        // Keep FALLBACK values already set in state
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
