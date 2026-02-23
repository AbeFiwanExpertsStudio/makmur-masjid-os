"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ScreenConfig {
  gambar_masjid: { enabled: boolean; url: string };
  alert_masuk: { enabled: boolean };
  alert_iqamat: { enabled: boolean; delay_minutes: number };
  slideshow: { enabled: boolean; interval_seconds: number };
  panel_waktu: { enabled: boolean; layout?: "horizontal" | "vertical" };
  bunyi_azan: { enabled: boolean };
  ticker: { enabled: boolean };
  zone: string;
}

export interface ScreenSlide {
  id: string;
  url: string;
  caption: string;
  sort_order: number;
}

export const DEFAULT_SCREEN_CONFIG: ScreenConfig = {
  gambar_masjid: { enabled: true, url: "" },
  alert_masuk: { enabled: true },
  alert_iqamat: { enabled: true, delay_minutes: 10 },
  slideshow: { enabled: true, interval_seconds: 8 },
  panel_waktu: { enabled: true },
  bunyi_azan: { enabled: true },
  ticker: { enabled: false },
  zone: "WLY01",
};

export function useScreenConfig() {
  const [config, setConfig] = useState<ScreenConfig>(DEFAULT_SCREEN_CONFIG);
  const [slides, setSlides] = useState<ScreenSlide[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const fetchAll = async () => {
      const [settingsResult, slidesResult] = await Promise.all([
        supabase.from("system_settings").select("screen_config").eq("id", 1).single(),
        supabase.from("screen_slides").select("*").order("sort_order"),
      ]);
      if (settingsResult.data?.screen_config) {
        setConfig({ ...DEFAULT_SCREEN_CONFIG, ...settingsResult.data.screen_config });
      }
      if (slidesResult.data) setSlides(slidesResult.data);
      setLoaded(true);
    };

    fetchAll();

    // Realtime: config changes
    const settingsChannel = supabase
      .channel("screen_config_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings", filter: "id=eq.1" },
        (payload) => {
          if (payload.new && (payload.new as Record<string, unknown>).screen_config) {
            setConfig({
              ...DEFAULT_SCREEN_CONFIG,
              ...(payload.new as Record<string, unknown>).screen_config as Partial<ScreenConfig>,
            });
          }
        }
      )
      .subscribe();

    // Realtime: slides changes
    const slidesChannel = supabase
      .channel("screen_slides_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "screen_slides" }, () => {
        supabase
          .from("screen_slides")
          .select("*")
          .order("sort_order")
          .then(({ data }) => {
            if (data) setSlides(data);
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(slidesChannel);
    };
  }, []);

  return { config, slides, loaded };
}
