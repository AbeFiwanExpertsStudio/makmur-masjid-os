"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useMachine } from "@xstate/react";
import { format } from "date-fns";
import { ms } from "date-fns/locale";
import { useScreenConfig } from "@/hooks/useScreenConfig";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { createClient } from "@/lib/supabase/client";
import FullScreenAlertScene from "@/components/paparan-masjid/FullScreenAlertScene";
import TimedCountdownScene from "@/components/paparan-masjid/TimedCountdownScene";
import { paparanMachine } from "@/lib/paparan-masjid/machine";
import { resolvePaparanScene } from "@/lib/paparan-masjid/schedule";
import { AZAN_PRAYERS, getPrayerLabel, PRAYER_DISPLAY, type PaparanScene, type PaparanSceneKind, type PrayerDay, type PrayerKey } from "@/lib/paparan-masjid/types";
import { Monitor, X, Volume2, Bell, Timer, ChevronDown, AlarmClock, AlertTriangle, Users, BookOpen } from "lucide-react";

// ── Helper ──────────────────────────────────────────────────────
function unixToTimeStr(unix: number): string {
  const d = new Date(unix * 1000);
  return format(d, "h:mm a");
}

function getCurrentAndNext(prayers: PrayerDay, nowUnix: number) {
  const order: PrayerKey[] = ["fajr", "syuruk", "dhuhr", "asr", "maghrib", "isha"];
  let current: PrayerKey | null = null;

  for (const key of order) {
    if (nowUnix >= prayers[key]) current = key;
  }

  const idx = current ? order.indexOf(current) : -1;
  // Skip syuruk as "next" — it’s a sunrise window, not a congregational prayer
  const next: PrayerKey | null = order.slice(idx + 1).find(k => k !== "syuruk") ?? null;
  return { current, next };
}

// ── Main Component ──────────────────────────────────────────────
export default function PaparanMasjidPage() {
  const { config, slides, loaded } = useScreenConfig();
  const sysSettings = useSystemSettings();
  const [machineState, sendToMachine] = useMachine(paparanMachine);

  const [now, setNow] = useState<Date>(new Date());
  const [prayers, setPrayers] = useState<PrayerDay | null>(null);
  const [hijriDate, setHijriDate] = useState<string>("");

  // Slideshow
  const [slideIdx, setSlideIdx] = useState(0);

  // Test panel
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testPrayer, setTestPrayer] = useState<PrayerKey>("dhuhr");
  const [testIqamatSecs, setTestIqamatSecs] = useState(30);
  const [debugOverride, setDebugOverride] = useState<{
    kind: PaparanSceneKind;
    prayerKey: PrayerKey;
    startedAtMs: number;
    endsAtMs: number;
  } | null>(null);
  const dismissedTokenRef = useRef<string>("");

  // Auto-detected zone (used when config.zone is blank)
  const [detectedZone, setDetectedZone] = useState<string>("");
  const [zoneDetecting, setZoneDetecting] = useState(false);

  // Active broadcasts for the ticker
  const [activeBroadcasts, setActiveBroadcasts] = useState<string[]>([]);

  const audioSubuhRef = useRef<HTMLAudioElement | null>(null);
  const audioOtherRef = useRef<HTMLAudioElement | null>(null);
  const audioBeepRef = useRef<HTMLAudioElement | null>(null);
  const lastScheduledTokenRef = useRef<string>("");
  const lastCueTokenRef = useRef<string>("");
  const lastPushTokenRef = useRef<string>("");
  const activeZoneRef = useRef("");
  // Track the calendar date last fetched so we can re-fetch at midnight
  const lastFetchedDate = useRef<number>(new Date().getDate());

  // ── Restore fired-guards from sessionStorage on mount ──
  useEffect(() => {
    const storedCueToken = sessionStorage.getItem("paparanLastCueToken");
    if (storedCueToken) lastCueTokenRef.current = storedCueToken;
    const storedPushToken = sessionStorage.getItem("paparanLastPushToken");
    if (storedPushToken) lastPushTokenRef.current = storedPushToken;
  }, []);

  // ── Helper: play a double-beep pattern, repeated `reps` times ──
  // Pattern per rep: beep → 150ms → beep  |  600ms gap before next rep
  const playBeeps = useCallback((reps = 1) => {
    const audio = audioBeepRef.current;
    if (!audio) return;
    let rep = 0;
    const playRep = () => {
      if (rep >= reps) return;
      // First beep of the pair
      audio.currentTime = 0;
      audio.play().catch(() => { });
      // Second beep 200ms later
      setTimeout(() => {
        audio.currentTime = 0;
        audio.play().catch(() => { });
        rep++;
        // Gap before next pair
        if (rep < reps) setTimeout(playRep, 600);
      }, 200);
    };
    playRep();
  }, []);

  // ── Live broadcasts for ticker (fetch + realtime) ──
  useEffect(() => {
    const supabase = createClient();
    const fetchBroadcasts = async () => {
      const { data } = await supabase
        .from("system_broadcasts")
        .select("message")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setActiveBroadcasts((data ?? []).map((b: { message: string }) => b.message));
    };
    fetchBroadcasts();
    const channel = supabase
      .channel("ticker_broadcasts")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_broadcasts" }, fetchBroadcasts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Auto-detect zone from geolocation when config.zone is blank ──
  useEffect(() => {
    if (config.zone || detectedZone || zoneDetecting) return;
    if (!navigator.geolocation) return;
    setZoneDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.waktusolat.app/zones/${coords.latitude}/${coords.longitude}`
          );
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Received non-JSON response from API");
          }
          const data: { zone: string } = await res.json();
          if (data.zone) setDetectedZone(data.zone);
        } catch (err) {
          console.error("Failed to auto-detect zone:", err);
        } finally {
          setZoneDetecting(false);
        }
      },
      () => setZoneDetecting(false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.zone]);

  // ── Keyboard shortcut: press T to open test panel ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "t" || e.key === "T") setShowTestPanel(v => !v);
      if (e.key === "Escape") {
        setShowTestPanel(false);
        setDebugOverride(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Fetch prayer times (callable for both zone-change and midnight refresh) ──
  const activeZone = config.zone || detectedZone;
  useEffect(() => { activeZoneRef.current = activeZone; }, [activeZone]);

  const fetchPrayers = useCallback(async (zone: string) => {
    if (!zone) return;
    try {
      const r = await fetch(`https://api.waktusolat.app/v2/solat/${zone}`);
      if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
      const contentType = r.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Received non-JSON response from API");
      }
      const data: { prayers: PrayerDay[] } = await r.json();
      const today = new Date().getDate();
      lastFetchedDate.current = today;
      const dayData = data.prayers.find(p => p.day === today) || data.prayers[0];
      setPrayers(dayData);

      if (dayData?.hijri) {
        const [y, m, d] = dayData.hijri.split("-");
        const monthMap: Record<string, string> = {
          "01": "Muharam", "02": "Safar", "03": "Rabiulawal", "04": "Rabiulakhir",
          "05": "Jamadilawwal", "06": "Jamadilakhir", "07": "Rejab", "08": "Syaaban",
          "09": "Ramadan", "10": "Syawal", "11": "Zulkaedah", "12": "Zulhijjah",
        };
        setHijriDate(`${parseInt(d)} ${monthMap[m] ?? m} ${y}H`);
      }
    } catch (err) {
      console.error("Failed to fetch prayers in PaparanMasjid:", err);
    }
  }, []);

  useEffect(() => {
    fetchPrayers(activeZone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZone]);

  // ── Clock + midnight refresh ──
  useEffect(() => {
    const timer = setInterval(() => {
      const nowDate = new Date();
      setNow(nowDate);

      // ── Midnight prayer-data refresh ─────────────────────────────
      const todayDay = nowDate.getDate();
      if (todayDay !== lastFetchedDate.current && activeZoneRef.current) {
        fetchPrayers(activeZoneRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchPrayers]);

  // ── Slideshow rotation ──
  useEffect(() => {
    if (!config.slideshow.enabled || slides.length === 0) return;
    const interval = Math.max(3, config.slideshow.interval_seconds) * 1000;
    const t = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [config.slideshow, slides]);

  const scheduledScene = useMemo(
    () => resolvePaparanScene({ now, prayers, config }),
    [now, prayers, config]
  );

  useEffect(() => {
    if (scheduledScene.token === lastScheduledTokenRef.current) return;
    lastScheduledTokenRef.current = scheduledScene.token;
    sendToMachine({ type: "SCHEDULE_UPDATED", scene: scheduledScene });
  }, [scheduledScene, sendToMachine]);

  const activeDebugScene = useMemo<PaparanScene | null>(() => {
    if (!debugOverride) return null;

    const nowMs = now.getTime();
    if (nowMs >= debugOverride.endsAtMs) return null;

    const totalMs = Math.max(debugOverride.endsAtMs - debugOverride.startedAtMs, 1);
    const remainingMs = Math.max(0, debugOverride.endsAtMs - nowMs);
    return {
      kind: debugOverride.kind,
      token: `debug:${debugOverride.kind}:${debugOverride.prayerKey}:${debugOverride.startedAtMs}`,
      prayerKey: debugOverride.prayerKey,
      startedAtMs: debugOverride.startedAtMs,
      endsAtMs: debugOverride.endsAtMs,
      totalMs,
      remainingMs,
      progress: Math.min(Math.max((nowMs - debugOverride.startedAtMs) / totalMs, 0), 1),
    };
  }, [debugOverride, now]);

  useEffect(() => {
    if (debugOverride && !activeDebugScene) {
      setDebugOverride(null);
    }
  }, [activeDebugScene, debugOverride]);

  const activeScene = activeDebugScene ?? machineState.context.scene;

  useEffect(() => {
    if (activeScene.kind === "idle") return;
    if (activeScene.token === lastCueTokenRef.current) return;

    lastCueTokenRef.current = activeScene.token;
    sessionStorage.setItem("paparanLastCueToken", activeScene.token);

    if (activeScene.kind === "azanAlert") {
      playBeeps(1);

      if (config.bunyi_azan.enabled && activeScene.prayerKey) {
        if (activeScene.prayerKey === "fajr" && audioSubuhRef.current) {
          audioSubuhRef.current.currentTime = 0;
          audioSubuhRef.current.play().catch(() => { });
        } else if (audioOtherRef.current) {
          audioOtherRef.current.currentTime = 0;
          audioOtherRef.current.play().catch(() => { });
        }
      }

      if (activeScene.token !== lastPushTokenRef.current && activeScene.prayerKey) {
        lastPushTokenRef.current = activeScene.token;
        sessionStorage.setItem("paparanLastPushToken", activeScene.token);
        fetch("/api/notifications/azan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prayerKey: activeScene.prayerKey }),
        }).catch(() => { });
      }

      return;
    }

    if (activeScene.kind === "iqamatFinalAlert" || activeScene.kind === "solatPhase") {
      playBeeps(1);
    }
  }, [activeScene, config.bunyi_azan.enabled, playBeeps]);

  // ── Test action handlers ───────────────────────────────────────────
  const testPreAzan = () => {
    const startedAtMs = Date.now();
    setDebugOverride({
      kind: "preAzanCountdown",
      prayerKey: testPrayer,
      startedAtMs,
      endsAtMs: startedAtMs + testIqamatSecs * 1000,
    });
    setShowTestPanel(false);
  };

  const testAlert = () => {
    const startedAtMs = Date.now();
    setDebugOverride({
      kind: "azanAlert",
      prayerKey: testPrayer,
      startedAtMs,
      endsAtMs: startedAtMs + 120_000,
    });
    setShowTestPanel(false);
  };

  const testIqamat = () => {
    const startedAtMs = Date.now();
    setDebugOverride({
      kind: "iqamatCountdownMain",
      prayerKey: testPrayer,
      startedAtMs,
      endsAtMs: startedAtMs + testIqamatSecs * 1000,
    });
    setShowTestPanel(false);
  };

  const testIqamatFinal = () => {
    const startedAtMs = Date.now();
    setDebugOverride({
      kind: "iqamatFinalAlert",
      prayerKey: testPrayer,
      startedAtMs,
      endsAtMs: startedAtMs + testIqamatSecs * 1000,
    });
    setShowTestPanel(false);
  };

  const testSolat = () => {
    const startedAtMs = Date.now();
    setDebugOverride({
      kind: "solatPhase",
      prayerKey: testPrayer,
      startedAtMs,
      endsAtMs: startedAtMs + 120_000,
    });
    setShowTestPanel(false);
  };

  const testKhutbah = () => {
    const startedAtMs = Date.now();
    setDebugOverride({
      kind: "fridayKhutbah",
      prayerKey: "dhuhr",
      startedAtMs,
      endsAtMs: startedAtMs + testIqamatSecs * 1000,
    });
    setShowTestPanel(false);
  };

  const testAzan = (type: "subuh" | "other") => {
    if (type === "subuh" && audioSubuhRef.current) {
      audioSubuhRef.current.currentTime = 0;
      audioSubuhRef.current.play().catch(() => { });
    } else if (type === "other" && audioOtherRef.current) {
      audioOtherRef.current.currentTime = 0;
      audioOtherRef.current.play().catch(() => { });
    }
    setShowTestPanel(false);
  };

  const stopAll = () => {
    audioSubuhRef.current?.pause();
    audioOtherRef.current?.pause();
    audioBeepRef.current?.pause();
    if (audioSubuhRef.current) audioSubuhRef.current.currentTime = 0;
    if (audioOtherRef.current) audioOtherRef.current.currentTime = 0;
    if (audioBeepRef.current) audioBeepRef.current.currentTime = 0;
    setDebugOverride(null);
  };

  // ── Helpers ─────────────────────────────────────────────────
  const nowUnix = Math.floor(now.getTime() / 1000);
  const { current: currentPrayer, next: nextPrayer } = prayers
    ? getCurrentAndNext(prayers, nowUnix)
    : { current: null, next: null };

  const bgStyle: React.CSSProperties = config.gambar_masjid.enabled && config.gambar_masjid.url
    ? { backgroundImage: `url(${config.gambar_masjid.url})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {};

  // ── Memoised ticker values — must be before any early return (Rules of Hooks) ──
  const tickerText = useMemo(
    () => activeBroadcasts.join("     •     "),
    [activeBroadcasts]
  );
  const tickerDuration = useMemo(
    () => Math.max(20, Math.round(21 + tickerText.length * 0.09)),
    [tickerText]
  );
  const tickerActive = config.ticker?.enabled && activeBroadcasts.length > 0;
  const activePrayerLabel = getPrayerLabel(activeScene.prayerKey);
  const activePrayerTime = activeScene.prayerKey && prayers
    ? unixToTimeStr(prayers[activeScene.prayerKey])
    : undefined;
  const containerScene = activeScene.kind === "preAzanCountdown" || activeScene.kind === "iqamatCountdownMain"
    ? activeScene
    : null;
  const fullScreenScene = activeScene.kind !== "idle" && !containerScene && activeScene.token !== dismissedTokenRef.current ? activeScene : null;
  const sceneBackgroundUrl = slides[slideIdx]?.url || (config.gambar_masjid.enabled ? config.gambar_masjid.url : "");

  if (!loaded) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <Monitor size={40} className="animate-pulse" />
          <p className="text-sm">Memuatkan skrin masjid…</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────
  const panelLayout = config.panel_waktu.layout ?? "horizontal";
  const isFriday = now.getDay() === 5;
  // Dim screen from 7 pm to 7 am to reduce OLED burn-in during low-activity hours
  const overlayDarkness = (now.getHours() >= 19 || now.getHours() < 7) ? "bg-black/93" : "bg-black/70";
  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden select-none" style={bgStyle}>
      {/* Dark overlay — auto-darkens between midnight and 4 am to reduce burn-in */}
      <div className={`absolute inset-0 ${overlayDarkness}`} />

      {/* ── CONTENT LAYER ───────────────────────────── */}
      {/* pb is extended when the ticker bar is visible so content never hides behind it */}
      <div className={`relative z-10 h-full flex flex-col gap-4 pt-6 px-6 ${tickerActive ? "pb-[52px]" : "pb-6"}`}>

        {/* ── TOP BAR (always full-width) ─────────────── */}
        <div className="flex items-start justify-between flex-shrink-0">
          {/* Left: system name + hijri */}
          <div>
            <p className="text-white/60 text-sm font-medium tracking-widest uppercase">
              {sysSettings.system_name}
            </p>
            {hijriDate && (
              <p className="text-white/40 text-xs mt-0.5">{hijriDate}</p>
            )}
            {/* Next prayer countdown chip */}
            {nextPrayer && prayers && (() => {
              const secs = Math.max(0, prayers[nextPrayer] - nowUnix);
              const h = Math.floor(secs / 3600);
              const m = Math.floor((secs % 3600) / 60);
              const s = secs % 60;
              return (
                <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">
                    {getPrayerLabel(nextPrayer)}
                  </span>
                  <span className="text-white/50 text-xs tabular-nums">
                    {`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Right: clock */}
          <div className="text-right">
            <div className="flex items-end justify-end gap-1.5 leading-none">
              <p className="text-white text-5xl font-bold tabular-nums leading-none">
                {format(now, "HH:mm")}
              </p>
              <p className="text-white/40 text-2xl font-bold tabular-nums leading-none mb-0.5">
                {format(now, "ss")}
              </p>
            </div>
            <p className="text-white/50 text-sm mt-1">
              {format(now, "EEEE, d MMMM yyyy", { locale: ms })}
            </p>
          </div>
        </div>

        {/* ── MIDDLE ROW (flex-1, fills remaining height) ── */}
        {/* vertical → flex-row: slideshow left + prayer panel right */}
        {/* horizontal → flex-col: slideshow top + prayer panel bottom */}
        <div className={`flex-1 min-h-0 flex gap-4 ${panelLayout === "vertical" ? "flex-row" : "flex-col"}`}>

          {containerScene ? (
            <div className="flex-1 min-h-0">
              <TimedCountdownScene
                scene={containerScene}
                prayerLabel={activePrayerLabel}
              />
            </div>
          ) : config.slideshow.enabled && slides.length > 0 ? (
            <div className="flex-1 relative rounded-2xl overflow-hidden min-h-0">
              {slides.map((slide, i) => (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-opacity duration-1000 ${i === slideIdx ? "opacity-100" : "opacity-0"}`}
                >
                  <img
                    src={slide.url}
                    alt={slide.caption}
                    className="w-full h-full object-cover"
                  />
                  {slide.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                      <p className="text-white text-xl font-semibold">{slide.caption}</p>
                    </div>
                  )}
                </div>
              ))}
              {slides.length > 1 && (
                <div className="absolute bottom-4 right-4 flex gap-1.5">
                  {slides.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all ${i === slideIdx ? "bg-white w-5" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 relative rounded-2xl overflow-hidden min-h-0 flex items-center justify-center bg-black/30 border border-white/10">
              <div
                className="absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg fill='none' stroke='%23fff' stroke-width='1' stroke-linejoin='round'%3E%3Crect x='4' y='4' width='112' height='112'/%3E%3Cpolygon points='37,4 83,4 116,37 116,83 83,116 37,116 4,83 4,37'/%3E%3Cpolygon points='60,20 67,44 88,32 76,54 100,60 76,66 88,88 67,76 60,100 53,76 32,88 44,66 20,60 44,54 32,32 53,44'/%3E%3Cpolygon points='67,44 76,54 76,66 67,76 53,76 44,66 44,54 53,44'/%3E%3Cline x1='60' y1='0' x2='60' y2='20'/%3E%3Cline x1='120' y1='60' x2='100' y2='60'/%3E%3Cline x1='60' y1='120' x2='60' y2='100'/%3E%3Cline x1='0' y1='60' x2='20' y2='60'/%3E%3Cline x1='0' y1='0' x2='32' y2='32'/%3E%3Cline x1='120' y1='0' x2='88' y2='32'/%3E%3Cline x1='0' y1='120' x2='32' y2='88'/%3E%3Cline x1='120' y1='120' x2='88' y2='88'/%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundSize: "120px 120px",
                }}
              />
              <div className="absolute top-5 left-5 w-10 h-10 border-t-2 border-l-2 border-white/20 rounded-tl-lg" />
              <div className="absolute top-5 right-5 w-10 h-10 border-t-2 border-r-2 border-white/20 rounded-tr-lg" />
              <div className="absolute bottom-5 left-5 w-10 h-10 border-b-2 border-l-2 border-white/20 rounded-bl-lg" />
              <div className="absolute bottom-5 right-5 w-10 h-10 border-b-2 border-r-2 border-white/20 rounded-br-lg" />
              <div className="relative z-10 flex flex-col items-center gap-5 px-12 py-10 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-2xl text-center max-w-md">
                <p className="text-white/90 text-3xl leading-relaxed" style={{ fontFamily: "serif", direction: "rtl" }}>
                  بسم الله الرحمن الرحيم
                </p>
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 h-px bg-white/20" />
                  <div className="w-2 h-2 bg-white/30 rotate-45" />
                  <div className="flex-1 h-px bg-white/20" />
                </div>
                <p className="text-white text-2xl font-bold tracking-widest uppercase leading-tight">
                  {sysSettings?.system_desc || sysSettings?.system_name || "MASJID"}
                </p>
              </div>
            </div>
          )}

          {/* ── VERTICAL: right prayer panel ── */}
          {panelLayout === "vertical" && config.panel_waktu.enabled && prayers && (
            <div className="w-60 flex-shrink-0 flex flex-col">
              {/* Prayer list — fills full middle-row height */}
              <div className="flex-1 min-h-0 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col">
                {/* Hijri date header */}
                {hijriDate && (
                  <div className="flex-shrink-0 px-4 py-2 border-b border-white/10 text-center">
                    <p className="text-white/40 text-[11px] font-medium tracking-widest">{hijriDate}</p>
                  </div>
                )}
                <div className="flex flex-col divide-y divide-white/10 flex-1 min-h-0">
                  {PRAYER_DISPLAY.map(({ key, ms: label }) => {
                    const isCurrent = key === currentPrayer;
                    const isNext = key === nextPrayer;
                    const isJumaat = isFriday && key === "dhuhr";
                    const isSyuruk = key === "syuruk";
                    return (
                      <div
                        key={key}
                        className={[
                          "flex-1 flex flex-col justify-center px-5 relative transition-all",
                          isSyuruk && !isCurrent ? "opacity-40" : "",
                          isCurrent
                            ? isJumaat ? "bg-amber-500/80" : "bg-emerald-500/80"
                            : isNext ? "bg-white/20" : "",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {isCurrent && <div className="w-2 h-2 rounded-full bg-white animate-pulse flex-shrink-0" />}
                          <p className={`text-lg font-bold uppercase tracking-widest ${isCurrent ? "text-white" : isNext ? "text-white" : "text-white/50"
                            }`}>{label}</p>
                          {isCurrent && (
                            <span className={`text-[9px] font-bold tracking-widest rounded-full px-1.5 py-0.5 ${isJumaat ? "text-amber-100 bg-white/10" : "text-emerald-100 bg-white/10"
                              }`}>NOW</span>
                          )}
                          {isFriday && key === "dhuhr" && !isCurrent && (
                            <span className="text-[9px] font-bold tracking-widest text-amber-300 bg-amber-500/20 rounded-full px-1.5 py-0.5">JUMAAT</span>
                          )}
                        </div>
                        <p className={`text-3xl font-bold tabular-nums ${isCurrent ? "text-white" : isNext ? "text-white" : "text-white/60"
                          }`}>
                          {unixToTimeStr(prayers[key])}
                        </p>
                        {isNext && !isCurrent && (() => {
                          const secs = Math.max(0, prayers[key] - nowUnix);
                          const h = Math.floor(secs / 3600);
                          const m = Math.floor((secs % 3600) / 60);
                          const s = secs % 60;
                          return (
                            <p className="text-xs text-white/40 tabular-nums mt-0.5">
                              {`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}
                            </p>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── HORIZONTAL: prayer panel below the slideshow ── */}
          {panelLayout === "horizontal" && config.panel_waktu.enabled && prayers && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex-shrink-0">
              <div className="grid grid-cols-6">
                {PRAYER_DISPLAY.map(({ key, ms: label }) => {
                  const isCurrent = key === currentPrayer;
                  const isNext = key === nextPrayer;
                  const isJumaat = isFriday && key === "dhuhr";
                  const isSyuruk = key === "syuruk";
                  return (
                    <div
                      key={key}
                      className={[
                        "flex flex-col items-center py-5 px-2 relative transition-all",
                        isSyuruk && !isCurrent ? "opacity-40" : "",
                        isCurrent
                          ? isJumaat ? "bg-amber-500/80 text-white" : "bg-emerald-500/80 text-white"
                          : isNext ? "bg-white/20 text-white" : "text-white/60",
                      ].join(" ")}
                    >
                      {isCurrent && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-pulse" />}
                      <p className={`text-base font-bold uppercase tracking-wider mb-2 ${isCurrent ? "text-white" : ""}`}>{label}</p>
                      <p className={`text-3xl font-bold tabular-nums ${isCurrent ? "text-white" : ""}`}>{unixToTimeStr(prayers[key])}</p>
                      {isCurrent && (
                        <p className={`text-[11px] mt-1 font-bold tracking-widest ${isJumaat ? "text-amber-100" : "text-emerald-100"}`}>SEKARANG</p>
                      )}
                      {isFriday && key === "dhuhr" && !isCurrent && (
                        <p className="text-[10px] text-amber-300 font-bold tracking-widest mt-1">JUMAAT</p>
                      )}
                      {isNext && !isCurrent && (() => {
                        const secs = Math.max(0, prayers[key] - nowUnix);
                        const h = Math.floor(secs / 3600);
                        const m = Math.floor((secs % 3600) / 60);
                        const s = secs % 60;
                        return <p className="text-[11px] text-white/50 mt-1 font-medium tabular-nums">{`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}</p>;
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>{/* closes middle row */}

      </div>{/* closes main content layer */}

      {/* ── ANNOUNCEMENT TICKER ──────────────── */}
      {tickerActive && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/70 backdrop-blur-sm border-t border-white/10 overflow-hidden" style={{ height: 40 }}>
          <div className="flex items-center h-full">
            <span className="flex-shrink-0 bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-widest px-3 h-full flex items-center">
              MAKLUMAN
            </span>
            {/* Scrolling track — starts off-screen right, scrolls to off-screen left */}
            <div className="flex-1 overflow-hidden h-full relative">
              <div
                className="absolute inset-y-0 left-0 flex items-center animate-ticker"
                style={{ animationDuration: `${tickerDuration}s` }}
              >
                <span className="text-white/80 text-sm font-medium px-6">{tickerText}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TEST PANEL TRIGGER (corner tap / T key) ─── */}
      <button
        onClick={() => setShowTestPanel(v => !v)}
        className="absolute top-4 left-4 z-30 w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 transition flex items-center justify-center text-white/20 hover:text-white/60"
        title="Panel Ujian (T)"
      >
        <Monitor size={16} />
      </button>

      {/* ── TEST PANEL OVERLAY ──────────────────────── */}
      {showTestPanel && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowTestPanel(false)}>
          <div
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10">
              <div>
                <p className="text-white font-bold text-base">Panel Ujian Skrin</p>
                <p className="text-white/40 text-xs mt-0.5">Tekan ESC atau klik luar untuk tutup</p>
              </div>
              <button onClick={() => setShowTestPanel(false)} className="text-white/40 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Settings row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1.5">Waktu Solat</label>
                  <div className="relative">
                    <select
                      value={testPrayer}
                      onChange={e => setTestPrayer(e.target.value as PrayerKey)}
                      className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-3 py-2 text-white text-sm appearance-none outline-none"
                    >
                      {AZAN_PRAYERS.map(key => (
                        <option key={key} value={key}>
                          {PRAYER_DISPLAY.find(p => p.key === key)?.ms ?? key}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-1.5">Tempoh (saat)</label>
                  <input
                    type="number" min={5} max={900} value={testIqamatSecs}
                    onChange={e => setTestIqamatSecs(Math.max(5, Number(e.target.value)))}
                    className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none"
                  />
                </div>
              </div>

              {/* State 1 — Pre-Azan Countdown */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">State 1 — Pra-Azan</p>
                <button
                  onClick={testPreAzan}
                  className="w-full flex items-center gap-3 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/25 text-cyan-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
                >
                  <AlarmClock size={16} />
                  <span>Akan Masuk Waktu — Countdown {testIqamatSecs}s</span>
                </button>
              </div>

              {/* State 2 — Azan Alert */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">State 2 — Azan (2 min, auto)</p>
                <div className="space-y-2">
                  <button
                    onClick={testAlert}
                    className="w-full flex items-center gap-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/25 text-emerald-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
                  >
                    <Bell size={16} />
                    <span>Telah Masuk Waktu — Skrin Penuh</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => testAzan("subuh")}
                      className="flex items-center justify-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 text-amber-300 rounded-xl px-3 py-2.5 text-xs font-semibold transition"
                    >
                      <Volume2 size={13} />
                      Audio Subuh
                    </button>
                    <button
                      onClick={() => testAzan("other")}
                      className="flex items-center justify-center gap-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/25 text-amber-300 rounded-xl px-3 py-2.5 text-xs font-semibold transition"
                    >
                      <Volume2 size={13} />
                      Audio Lain
                    </button>
                  </div>
                </div>
              </div>

              {/* State 3 — Iqamat */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">State 3 — Iqamat</p>
                <div className="space-y-2">
                  <button
                    onClick={testIqamat}
                    className="w-full flex items-center gap-3 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 text-blue-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
                  >
                    <Timer size={16} />
                    <span>Kiraan Iqamat Utama — {testIqamatSecs}s</span>
                  </button>
                  <button
                    onClick={testIqamatFinal}
                    className="w-full flex items-center gap-3 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/25 text-orange-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
                  >
                    <AlertTriangle size={16} />
                    <span>Amaran Iqamat (2 min terakhir) — {testIqamatSecs}s</span>
                  </button>
                </div>
              </div>

              {/* State 4 — Solat */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">State 4 — Solat (2 min, auto)</p>
                <button
                  onClick={testSolat}
                  className="w-full flex items-center gap-3 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/25 text-violet-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
                >
                  <Users size={16} />
                  <span>Sila Rapatkan Saf — Ikon Telefon &amp; Senyap</span>
                </button>
              </div>

              {/* State 5 — Khutbah Jumaat */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-2">State 5 — Khutbah Jumaat</p>
                <button
                  onClick={testKhutbah}
                  className="w-full flex items-center gap-3 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/25 text-yellow-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
                >
                  <BookOpen size={16} />
                  <span>Adab Khutbah — {testIqamatSecs}s</span>
                </button>
              </div>

              {/* Reset */}
              <button
                onClick={stopAll}
                className="w-full flex items-center gap-3 bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-400 rounded-xl px-4 py-3 text-sm font-semibold transition"
              >
                <X size={16} />
                Henti Semua &amp; Kembali ke Idle
              </button>

              {/* Current active scene indicator */}
              {activeScene.kind !== "idle" && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Fasa Aktif Sekarang</p>
                  <p className="text-white text-sm font-semibold">{activeScene.kind}</p>
                  {activeScene.prayerKey && (
                    <p className="text-white/50 text-xs mt-0.5">{getPrayerLabel(activeScene.prayerKey)} · {Math.round(activeScene.remainingMs / 1000)}s berbaki</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fullScreenScene && (
        <FullScreenAlertScene
          scene={fullScreenScene}
          prayerLabel={activePrayerLabel}
          prayerTimeText={activePrayerTime}
          onDismiss={() => {
            dismissedTokenRef.current = fullScreenScene.token;
            if (debugOverride) setDebugOverride(null);
          }}
        />
      )}

      {/* ── AUDIO ELEMENTS ───────────────────────────── */}
      <audio ref={audioSubuhRef} src="/audio/adzan_subuh.mp3" preload="auto" />
      <audio ref={audioOtherRef} src="/audio/adzan_nahawand.mp3" preload="auto" />
      <audio ref={audioBeepRef} src="/audio/beep.wav" preload="auto" />
    </div>
  );
}
