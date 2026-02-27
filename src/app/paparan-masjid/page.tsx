"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { ms } from "date-fns/locale";
import { useScreenConfig } from "@/hooks/useScreenConfig";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { createClient } from "@/lib/supabase/client";
import { Monitor, X, Volume2, Bell, Timer, ChevronDown } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────
interface PrayerDay {
  day: number;
  hijri: string;
  fajr: number;
  syuruk: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

type PrayerKey = "fajr" | "syuruk" | "dhuhr" | "asr" | "maghrib" | "isha";

const PRAYER_DISPLAY: { key: PrayerKey; ms: string }[] = [
  { key: "fajr", ms: "Subuh" },
  { key: "syuruk", ms: "Syuruk" },
  { key: "dhuhr", ms: "Zuhur" },
  { key: "asr", ms: "Asar" },
  { key: "maghrib", ms: "Maghrib" },
  { key: "isha", ms: "Isyak" },
];

// Prayers that have azan (exclude syuruk)
const AZAN_PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

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

  const [now, setNow] = useState<Date>(new Date());
  const [prayers, setPrayers] = useState<PrayerDay | null>(null);
  const [hijriDate, setHijriDate] = useState<string>("");

  // Slideshow
  const [slideIdx, setSlideIdx] = useState(0);

  // Alert / Iqamat state
  const [alertPrayer, setAlertPrayer] = useState<PrayerKey | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [showIqamat, setShowIqamat] = useState(false);
  // iqamatTarget: absolute unix second when iqamat fires
  const [iqamatTarget, setIqamatTarget] = useState<number>(0);
  const [iqamatSeconds, setIqamatSeconds] = useState(0);
  const [iqamatTotal, setIqamatTotal] = useState(0);

  // Test panel
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testPrayer, setTestPrayer] = useState<PrayerKey>("dhuhr");
  const [testIqamatSecs, setTestIqamatSecs] = useState(30);

  // Auto-detected zone (used when config.zone is blank)
  const [detectedZone, setDetectedZone] = useState<string>("");
  const [zoneDetecting, setZoneDetecting] = useState(false);

  // Active broadcasts for the ticker
  const [activeBroadcasts, setActiveBroadcasts] = useState<string[]>([]);

  // Refs to avoid stale closures in setInterval
  const lastAzanFired = useRef<number>(0);
  const lastAlertFired = useRef<number>(0);
  const lastIqamatFired = useRef<number>(0);
  const audioSubuhRef = useRef<HTMLAudioElement | null>(null);
  const audioOtherRef = useRef<HTMLAudioElement | null>(null);
  const audioBeepRef = useRef<HTMLAudioElement | null>(null);
  const prayersRef = useRef<PrayerDay | null>(null);
  const configRef = useRef(config);
  const activeZoneRef = useRef("");
  // Track the calendar date last fetched so we can re-fetch at midnight
  const lastFetchedDate = useRef<number>(new Date().getDate());

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { prayersRef.current = prayers; }, [prayers]);

  // ── Restore fired-guards from sessionStorage on mount ──
  useEffect(() => {
    const storedAzan = sessionStorage.getItem("lastAzanFired");
    if (storedAzan) lastAzanFired.current = parseInt(storedAzan, 10);
    const storedAlert = sessionStorage.getItem("lastAlertFired");
    if (storedAlert) lastAlertFired.current = parseInt(storedAlert, 10);
  }, []);

  // ── Helper: play a double-beep pattern, repeated `reps` times ──
  // Pattern per rep: beep → 150ms → beep  |  600ms gap before next rep
  const playBeeps = useCallback((reps = 10) => {
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
        setShowAlert(false);
        setShowIqamat(false);
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

  // ── Clock + alert + azan logic ──
  useEffect(() => {
    const timer = setInterval(() => {
      const nowDate = new Date();
      setNow(nowDate);

      const cfg = configRef.current;
      const p = prayersRef.current;
      if (!p) return;

      const nowUnix = Math.floor(nowDate.getTime() / 1000);

      // ── Midnight prayer-data refresh ─────────────────────────────
      const todayDay = nowDate.getDate();
      if (todayDay !== lastFetchedDate.current && activeZoneRef.current) {
        fetchPrayers(activeZoneRef.current);
      }

      // ── Alert Masuk Waktu ────────────────────────────────────────
      // Shows for the first ALERT_WINDOW seconds after prayer time.
      // When iqamat is also enabled the alert gets ALERT_WINDOW seconds
      // of exclusive screen time before the countdown takes over.
      const ALERT_WINDOW = 10; // seconds the alert banner is shown
      if (cfg.alert_masuk.enabled) {
        const triggered = AZAN_PRAYERS.find(
          key => nowUnix >= p[key] && nowUnix < p[key] + 120
        );
        if (triggered && lastAlertFired.current !== p[triggered]) {
          lastAlertFired.current = p[triggered];
          sessionStorage.setItem("lastAlertFired", String(p[triggered]));
          setAlertPrayer(triggered);
          setShowAlert(true);
          setShowIqamat(false);
          // Beep x10 immediately when the alert appears
          playBeeps(10);
          // Auto-dismiss: use ALERT_WINDOW when iqamat will take over, else 90s
          const dismissAfter = cfg.alert_iqamat.enabled
            ? ALERT_WINDOW * 1000
            : 90_000;
          setTimeout(() => setShowAlert(false), dismissAfter);
        }
      }

      // ── Iqamat countdown ─────────────────────────────────────────
      // Starts ALERT_WINDOW seconds after azan so the alert banner plays
      // first. Counts down from iqamat_delay to 0.
      if (cfg.alert_iqamat.enabled) {
        const delayMs = cfg.alert_iqamat.delay_minutes * 60;
        const iqamatStart = ALERT_WINDOW; // don't start until alert has shown
        const triggered = AZAN_PRAYERS.find(key =>
          nowUnix >= p[key] + iqamatStart && nowUnix < p[key] + delayMs
        );
        if (triggered && lastIqamatFired.current !== p[triggered]) {
          lastIqamatFired.current = p[triggered];
          setAlertPrayer(triggered);
          setIqamatTarget(p[triggered] + delayMs);
          setIqamatTotal(delayMs);
          // showAlert will already have auto-dismissed by now
          setShowAlert(false);
          setShowIqamat(true);
          // Beep x10 immediately when the iqamat countdown screen appears
          playBeeps(10);
        }
      }

      // Live iqamat seconds countdown
      if (iqamatTarget > 0) {
        const rem = iqamatTarget - nowUnix;
        if (rem <= 0) {
          setIqamatSeconds(0);
          setShowIqamat(false);
          setIqamatTarget(0);
        } else {
          setIqamatSeconds(rem);
        }
      }

      // Azan autoplay
      if (cfg.bunyi_azan.enabled) {
        const triggered = AZAN_PRAYERS.find(
          key => nowUnix >= p[key] && nowUnix < p[key] + 60
        );
        if (triggered && lastAzanFired.current !== p[triggered]) {
          lastAzanFired.current = p[triggered];
          sessionStorage.setItem("lastAzanFired", String(p[triggered]));
          if (triggered === "fajr" && audioSubuhRef.current) {
            audioSubuhRef.current.currentTime = 0;
            audioSubuhRef.current.play().catch(() => { });
          } else if (audioOtherRef.current) {
            audioOtherRef.current.currentTime = 0;
            audioOtherRef.current.play().catch(() => { });
          }
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [iqamatTarget, fetchPrayers, playBeeps]);

  // ── Slideshow rotation ──
  useEffect(() => {
    if (!config.slideshow.enabled || slides.length === 0) return;
    const interval = Math.max(3, config.slideshow.interval_seconds) * 1000;
    const t = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [config.slideshow, slides]);

  // ── Test action handlers ───────────────────────────────────────────
  const testAlert = () => {
    setAlertPrayer(testPrayer);
    setShowIqamat(false);
    setShowAlert(true);
    setShowTestPanel(false);
    playBeeps(10);
    setTimeout(() => setShowAlert(false), 90_000);
  };

  const testIqamat = () => {
    const target = Math.floor(Date.now() / 1000) + testIqamatSecs;
    setAlertPrayer(testPrayer);
    setIqamatTarget(target);
    setIqamatSeconds(testIqamatSecs);
    setIqamatTotal(testIqamatSecs);
    setShowAlert(false);
    setShowIqamat(true);
    setShowTestPanel(false);
    playBeeps(10);
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
    if (audioSubuhRef.current) audioSubuhRef.current.currentTime = 0;
    if (audioOtherRef.current) audioOtherRef.current.currentTime = 0; if (audioBeepRef.current) { audioBeepRef.current.pause(); audioBeepRef.current.currentTime = 0; } setShowAlert(false);
    setShowIqamat(false);
    setIqamatTarget(0);
  };

  // ── Helpers ─────────────────────────────────────────────────
  const prayerLabel = useCallback((key: PrayerKey | null) => {
    if (!key) return "";
    return PRAYER_DISPLAY.find(p => p.key === key)?.ms ?? key;
  }, []);

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
  const overlayDarkness = (now.getHours() >= 0 && now.getHours() < 4) ? "bg-black/93" : "bg-black/70";
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
                    {prayerLabel(nextPrayer)}
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

          {/* ── SLIDESHOW ──────────────────────────────── */}
          {config.slideshow.enabled && slides.length > 0 && (
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
              {/* Slide dots */}
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
          )}

          {/* ── NO-SLIDE PLACEHOLDER ────────────────────── */}
          {(!config.slideshow.enabled || slides.length === 0) && (
            <div className="flex-1 relative rounded-2xl overflow-hidden min-h-0 flex items-center justify-center bg-black/30 border border-white/10">
              {/* Islamic geometric tile pattern overlay */}
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='none' stroke='%23fff' stroke-width='0.8'%3E%3Cpolygon points='40,4 51,14 64,10 64,24 75,32 68,44 75,56 64,56 56,68 44,62 32,68 24,56 12,56 18,44 12,32 24,24 24,10 36,14'/%3E%3Cpolygon points='40,16 48,22 57,19 57,28 65,34 60,42 65,50 57,50 51,58 43,54 34,58 28,50 20,50 25,42 20,34 28,28 28,19 37,22'/%3E%3Cline x1='40' y1='4' x2='40' y2='16'/%3E%3Cline x1='75' y1='32' x2='65' y2='34'/%3E%3Cline x1='75' y1='56' x2='65' y2='50'/%3E%3Cline x1='40' y1='68' x2='40' y2='58'/%3E%3Cline x1='12' y1='56' x2='20' y2='50'/%3E%3Cline x1='12' y1='32' x2='20' y2='34'/%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundSize: "80px 80px",
                }}
              />
              {/* Corner ornaments */}
              <div className="absolute top-5 left-5 w-10 h-10 border-t-2 border-l-2 border-white/20 rounded-tl-lg" />
              <div className="absolute top-5 right-5 w-10 h-10 border-t-2 border-r-2 border-white/20 rounded-tr-lg" />
              <div className="absolute bottom-5 left-5 w-10 h-10 border-b-2 border-l-2 border-white/20 rounded-bl-lg" />
              <div className="absolute bottom-5 right-5 w-10 h-10 border-b-2 border-r-2 border-white/20 rounded-br-lg" />
              {/* Centre card */}
              <div className="relative z-10 flex flex-col items-center gap-5 px-12 py-10 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-2xl text-center max-w-md">
                {/* Arabic bismillah */}
                <p className="text-white/90 text-3xl leading-relaxed" style={{ fontFamily: "serif", direction: "rtl" }}>
                  بسم الله الرحمن الرحيم
                </p>
                {/* Divider with diamond */}
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 h-px bg-white/20" />
                  <div className="w-2 h-2 bg-white/30 rotate-45" />
                  <div className="flex-1 h-px bg-white/20" />
                </div>
                {/* Mosque name */}
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
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-white font-bold text-base">Panel Ujian</p>
                <p className="text-white/40 text-xs mt-0.5">Tekan ESC atau klik luar untuk tutup</p>
              </div>
              <button onClick={() => setShowTestPanel(false)} className="text-white/40 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            {/* Prayer selector */}
            <div className="mb-4">
              <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-1.5">Pilih Waktu Solat</label>
              <div className="relative">
                <select
                  value={testPrayer}
                  onChange={e => setTestPrayer(e.target.value as PrayerKey)}
                  className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm appearance-none outline-none"
                >
                  {AZAN_PRAYERS.map(key => (
                    <option key={key} value={key}>
                      {PRAYER_DISPLAY.find(p => p.key === key)?.ms ?? key}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* Iqamat seconds */}
            <div className="mb-5">
              <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-1.5">
                Kiraan Detik Iqamat (saat)
              </label>
              <input
                type="number" min={5} max={600} value={testIqamatSecs}
                onChange={e => setTestIqamatSecs(Math.max(5, Number(e.target.value)))}
                className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none"
              />
            </div>

            <div className="space-y-2.5">
              <button
                onClick={testAlert}
                className="w-full flex items-center gap-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
              >
                <Bell size={16} />
                Uji Alert Masuk Waktu
              </button>

              <button
                onClick={testIqamat}
                className="w-full flex items-center gap-3 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
              >
                <Timer size={16} />
                Uji Iqamat ({testIqamatSecs}s)
              </button>

              <button
                onClick={() => testAzan("subuh")}
                className="w-full flex items-center gap-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
              >
                <Volume2 size={16} />
                Uji Azan Subuh
              </button>

              <button
                onClick={() => testAzan("other")}
                className="w-full flex items-center gap-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 rounded-xl px-4 py-3 text-sm font-semibold transition"
              >
                <Volume2 size={16} />
                Uji Azan (Solat Lain)
              </button>

              <button
                onClick={stopAll}
                className="w-full flex items-center gap-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm font-semibold transition"
              >
                <X size={16} />
                Henti Semua &amp; Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ALERT MASUK WAKTU OVERLAY ───────────────── */}
      {showAlert && config.alert_masuk.enabled && alertPrayer && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer bg-black/80 backdrop-blur-sm"
          onClick={() => setShowAlert(false)}
        >
          <div className="text-center px-8 animate-in fade-in zoom-in duration-500">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/70 text-sm uppercase tracking-widest">Waktu Solat</span>
            </div>
            <p className="text-white/60 text-xl tracking-widest uppercase mb-2">Telah Masuk Waktu</p>
            <p className="text-white text-[12rem] font-bold tracking-tight leading-none mb-4">
              {prayerLabel(alertPrayer)}
            </p>
            {prayers && (
              <p className="text-white/50 text-3xl tabular-nums">{unixToTimeStr(prayers[alertPrayer])}</p>
            )}
            <p className="text-white/20 text-xs mt-12 tracking-widest">KETUK UNTUK TUTUP</p>
          </div>
        </div>
      )}

      {/* ── IQAMAT COUNTDOWN OVERLAY ─────────────────── */}
      {showIqamat && config.alert_iqamat.enabled && alertPrayer && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setShowIqamat(false)}>
          <div className="text-center px-8 animate-in fade-in zoom-in duration-500 w-full max-w-lg">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-6">
              <Timer size={14} className="text-blue-400" />
              <span className="text-white/70 text-sm uppercase tracking-widest">{prayerLabel(alertPrayer)}</span>
            </div>
            <p className="text-white/60 text-xl tracking-widest uppercase mb-2">Iqamat Dalam</p>
            <p className="text-white text-9xl font-bold tabular-nums leading-none mb-6">
              {String(Math.floor(iqamatSeconds / 60)).padStart(2, "0")}
              <span className="text-white/30 mx-1">:</span>
              {String(iqamatSeconds % 60).padStart(2, "0")}
            </p>
            {/* Progress bar */}
            <div className="w-full bg-white/10 rounded-full h-2 mb-4 overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${iqamatTotal > 0 ? (iqamatSeconds / iqamatTotal) * 100 : 0}%` }}
              />
            </div>
            <p className="text-emerald-400 text-base mt-4 tracking-wide">
              Sila bersiap untuk solat berjemaah
            </p>
            <p className="text-white/20 text-xs mt-8 tracking-widest">KETUK UNTUK TUTUP</p>
          </div>
        </div>
      )}

      {/* ── AUDIO ELEMENTS ───────────────────────────── */}
      <audio ref={audioSubuhRef} src="/audio/adzan_subuh.mp3" preload="auto" />
      <audio ref={audioOtherRef} src="/audio/adzan_nahawand.mp3" preload="auto" />
      <audio ref={audioBeepRef} src="/audio/beep.wav" preload="auto" />
    </div>
  );
}
