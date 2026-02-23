"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface FoodEvent {
  id: string;
  name: string;
  total_capacity: number;
  remaining_capacity: number;
  event_date: string;
  start_time: string;
  end_time: string;
  status?: "active" | "scheduled" | "expired";
}

export function useLiveFoodEvents() {
  const [events, setEvents] = useState<FoodEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // Safety timeout — never show spinner for more than 4s
    // Use a mutable ref or check mounted flag to ensure it doesn't override real data
    const timeout = setTimeout(() => {
      // If we reach here, it hasn't been cleared by fetchEvents
      if (mounted) {
        console.warn("useLiveFoodEvents: timed out");
        setEvents([]);
        setIsLoading(false);
      }
    }, 4000);

    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from("food_events")
          .select("*")
          .order("event_date", { ascending: true });

        if (!mounted) return;

        if (error) {
          console.error("Failed to fetch food_events:", error.message);
          setEvents([]);
        } else if (!data || data.length === 0) {
          setEvents([]);
        } else {
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const hr = String(now.getHours()).padStart(2, '0');
          const min = String(now.getMinutes()).padStart(2, '0');
          const sec = String(now.getSeconds()).padStart(2, '0');

          const currentDate = `${yyyy}-${mm}-${dd}`;
          const currentTime = `${hr}:${min}:${sec}`;

          const parsedEvents = data.map((fe: any) => {
            let computedStatus: "active" | "scheduled" | "expired" = "active";

            if (fe.event_date && fe.start_time && fe.end_time) {
              const cleanStartTime = fe.start_time.split('.')[0];
              const cleanEndTime = fe.end_time.split('.')[0];

              if (fe.event_date < currentDate) {
                computedStatus = "expired";
              } else if (fe.event_date > currentDate) {
                computedStatus = "scheduled";
              } else {
                if (currentTime < cleanStartTime) computedStatus = "scheduled";
                else if (currentTime > cleanEndTime) computedStatus = "expired";
                else computedStatus = "active";
              }
            }

            return { ...fe, status: computedStatus } as FoodEvent;
          });

          // Filter out expired, and sort active on top
          const validEvents = parsedEvents
            .sort((a, b) => a.status === "active" && b.status !== "active" ? -1 : a.status !== "active" && b.status === "active" ? 1 : 0);

          setEvents(validEvents);
        }
      } catch (err) {
        console.error("useLiveFoodEvents error:", err);
        if (mounted) setEvents([]);
      }
      clearTimeout(timeout);
      if (mounted) setIsLoading(false);
    };

    fetchEvents();

    // Subscribe to real-time UPDATE events
    const channel = supabase
      .channel("food_events_realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "food_events" },
        (payload) => {
          const updated = payload.new as FoodEvent;
          setEvents((prev) =>
            prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e))
          );
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { events, isLoading };
}

