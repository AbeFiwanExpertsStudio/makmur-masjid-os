"use client";

import React, { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { MoonStar, Sunrise, SunMedium, Sun, Sunset, Moon, Settings, Volume2, X, MapPin } from "lucide-react";
import { usePrayerSettings, THEMES } from "./PrayerSettingsContext";
import { useSystemSettings } from "@/hooks/useSystemSettings";

interface PrayerTimes { fajr: number; dhuhr: number; asr: number; maghrib: number; isha: number; syuruk: number; }
interface Zone { jakimCode: string; negeri: string; daerah: string; }

export default function DynamicWaktuSolat() {
    const sysSettings = useSystemSettings();
    const [loading, setLoading] = useState(true);
    const [zones, setZones] = useState<Zone[]>([]);
    const [zoneLabel, setZoneLabel] = useState<string>("Kuala Lumpur");

    const [prayers, setPrayers] = useState<PrayerTimes | null>(null);
    const [hijriDate, setHijriDate] = useState<string>("Loading Hijri...");
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    const {
        theme, setTheme,
        use24Hour, setUse24Hour,
        customTitle, setCustomTitle,
        audioEnabled, setAudioEnabled,
        language, setLanguage,
        bgImage, setBgImage,
        bgOpacity, setBgOpacity,
        selectedZone, setSelectedZone,
        showBannerAlert, setShowBannerAlert,
        enableBlinking, setEnableBlinking,
        isLoaded
    } = usePrayerSettings();

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [dismissedAlertTime, setDismissedAlertTime] = useState<number | null>(null);
    const [demoAlertEndTime, setDemoAlertEndTime] = useState<number | null>(null);

    const audioSubuhRef = useRef<HTMLAudioElement | null>(null);
    const audioOtherRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        fetch("https://api.waktusolat.app/zones")
            .then((res) => res.json())
            .then((data: Zone[]) => setZones(data))
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        if (!selectedZone) { // Only force auto-locate if NO zone was ever saved by user
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        try {
                            const { latitude, longitude } = position.coords;
                            const res = await fetch(`https://api.waktusolat.app/zones/gps?lat=${latitude}&long=${longitude}`);
                            const gpsZones = await res.json();
                            if (gpsZones?.length > 0) {
                                setSelectedZone(gpsZones[0].jakimCode || "WLY01");
                                setZoneLabel(gpsZones[0].daerah || "Locating...");
                            } else {
                                setSelectedZone("WLY01");
                            }
                        } catch (err) { setSelectedZone("WLY01"); }
                    },
                    () => { setSelectedZone("WLY01"); }, { enableHighAccuracy: true }
                );
            } else {
                setSelectedZone("WLY01");
            }
        }
    }, [isLoaded, selectedZone, setSelectedZone]);

    useEffect(() => {
        if (!selectedZone) return;
        setLoading(true);
        fetch(`https://api.waktusolat.app/v2/solat/${selectedZone}`)
            .then(res => res.json())
            .then(data => {
                const dayMatch = data.prayers.find((p: any) => p.day === new Date().getDate()) || data.prayers[0];
                setPrayers(dayMatch);

                if (dayMatch.hijri) {
                    const [y, m, d] = dayMatch.hijri.split("-");
                    const map: any = { "01": "Muh", "02": "Saf", "03": "Raw", "04": "Raa", "05": "Jaw", "06": "Jaa", "07": "Raj", "08": "Sha", "09": "Ram", "10": "Syw", "11": "Duk", "12": "Duh" };
                    setHijriDate(`${parseInt(d)} ${map[m]} ${y}H`);
                }

                if (zones.length > 0) {
                    const matched = zones.find(z => z.jakimCode === selectedZone);
                    if (matched) setZoneLabel(`${matched.daerah.split(",")[0]}, ${matched.negeri}`);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [selectedZone, zones]);

    const lastAlertFiredRef = useRef<number>(0);
    const lastAzanFiredRef = useRef<number>(0);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);

            if (audioEnabled && prayers) {
                const nowUnix = Math.floor(now.getTime() / 1000);

                // 15 Minute Alerts window (60 seconds leeway)
                const targetAlertTime = [prayers.fajr, prayers.dhuhr, prayers.asr, prayers.maghrib, prayers.isha]
                    .find(t => nowUnix >= (t - 900) && nowUnix < (t - 900 + 60));

                if (targetAlertTime && lastAlertFiredRef.current !== targetAlertTime) {
                    lastAlertFiredRef.current = targetAlertTime;
                    const prayerNames = [[prayers.fajr, "Subuh"], [prayers.dhuhr, "Zohor"], [prayers.asr, "Asar"], [prayers.maghrib, "Maghrib"], [prayers.isha, "Isyak"]];
                    const matchedPType = prayerNames.find(p => p[0] === targetAlertTime)?.[1] || "Solat";
                    const isM = language === "ms";

                    if (Notification.permission === "granted") {
                        new Notification(isM ? "Peringatan Waktu Solat" : "Prayer Time Alert", {
                            body: isM ? `Waktu ${matchedPType} masuk dalam masa 15 minit.` : `15 minutes until ${matchedPType}.`,
                        });
                    } else if (Notification.permission !== "denied") {
                        Notification.requestPermission();
                    }
                }

                // Autoplay Azan Logic (60 seconds leeway)
                const azanList = [prayers.fajr, prayers.dhuhr, prayers.asr, prayers.maghrib, prayers.isha];
                const targetAzanTime = azanList.find(t => nowUnix >= t && nowUnix < (t + 60));

                if (targetAzanTime && lastAzanFiredRef.current !== targetAzanTime) {
                    lastAzanFiredRef.current = targetAzanTime;
                    if (targetAzanTime === prayers.fajr && audioSubuhRef.current) {
                        audioSubuhRef.current.currentTime = 0;
                        audioSubuhRef.current.play().catch(e => console.log(e));
                    } else if (targetAzanTime !== prayers.fajr && audioOtherRef.current) {
                        audioOtherRef.current.currentTime = 0;
                        audioOtherRef.current.play().catch(e => console.log(e));
                    }
                }
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [audioEnabled, prayers, language]);

    if (!isLoaded) return <div className="min-h-[50vh] flex items-center justify-center">Loading Waktu...</div>;

    const t = (en: string, ms: string) => language === "ms" ? ms : en;

    const activeStyles = theme.bgClass + " text-white flex flex-col justify-center rounded-xl p-4 md:p-6 transition-all scale-[1.02] shadow-xl";
    const inactiveStyles = "text-text flex flex-col justify-center rounded-xl p-4 md:p-6 transition-all bg-surface border border-border shadow-sm hover:shadow-md";

    const formatTimeStr = (unixSec: number) => {
        const d = new Date(unixSec * 1000);
        return format(d, use24Hour ? "HH:mm" : "hh:mm");
    };

    return (
        <div className="flex-1 w-full flex flex-col relative overflow-hidden transition-colors duration-500 shadow-2xl max-h-[calc(100vh-64px)]">

            <div className="relative z-20 w-full max-w-7xl mx-auto px-4 py-4 md:px-8 md:py-6 flex flex-col flex-1 h-full max-h-full">
                {/* Header Data Section */}
                <header className="flex justify-between items-start w-full mb-4 md:mb-6 shrink-0">
                    <div className="space-y-1 text-text font-bold">
                        <h1 className="text-2xl md:text-5xl font-bold tracking-tight">{format(currentTime, "EEEE, d MMM yyyy")}</h1>
                        <h2 className="text-xl md:text-3xl font-medium opacity-90">{customTitle || hijriDate}</h2>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className={`flex items-center gap-2 text-xl md:text-3xl font-bold tracking-tight ${theme.textClass}`}>
                            {sysSettings.system_name || "Makmur OS"}
                            <button onClick={() => setSettingsOpen(true)} className="ml-2 hover:opacity-80 p-2 text-text-muted hover:text-text transition">
                                <Settings size={28} />
                            </button>
                        </div>
                        <div className="text-2xl md:text-4xl font-semibold mt-1 tracking-wider tabular-nums text-text">
                            {format(currentTime, "HH:mm:ss")}
                        </div>
                    </div>
                </header>

                {/* Custom Inline Banner Alert logic (Computed Dynamically) */}
                {(() => {
                    if (!prayers) return null;
                    const nowUnixLocal = Math.floor(currentTime.getTime() / 1000);
                    const times = [prayers.fajr, prayers.dhuhr, prayers.asr, prayers.maghrib, prayers.isha];
                    const prayerNames = ["Subuh", "Zohor", "Asar", "Maghrib", "Isyak"];
                    const prayerNamesEn = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

                    // Find any prayer within exactly 15 mins
                    let activeAlertIdx = -1;
                    let actualDiff = 0;
                    let isDemo = false;

                    const alertIdx = times.findIndex(t => t - nowUnixLocal > 0 && t - nowUnixLocal <= 900);

                    if (demoAlertEndTime !== null) {
                        activeAlertIdx = 3; // Mock Maghrib
                        actualDiff = demoAlertEndTime - nowUnixLocal;
                        isDemo = true;

                        if (actualDiff <= 0) {
                            setTimeout(() => setDemoAlertEndTime(null), 0);
                            return null;
                        }
                    } else if (showBannerAlert && alertIdx !== -1 && times[alertIdx] !== dismissedAlertTime) {
                        activeAlertIdx = alertIdx;
                        actualDiff = times[alertIdx] - nowUnixLocal;
                    }

                    if (activeAlertIdx !== -1) {
                        const isBlinking = enableBlinking && actualDiff <= 300; // <= 5 minutes

                        const m = Math.floor(actualDiff / 60);
                        const s = actualDiff % 60;
                        const countdownStr = `${m}M ${s}S`;

                        const pName = language === "ms" ? prayerNames[activeAlertIdx] : prayerNamesEn[activeAlertIdx];
                        const msg = language === "ms" ? `Azan ${pName} dalam ${countdownStr}` : `${pName} Azan in ${countdownStr}`;

                        return (
                            <div className={`w-full max-w-5xl mx-auto mb-4 md:mb-6 shrink-0 bg-[#2A1E00] border border-yellow-600/60 text-yellow-500 px-6 py-2 md:py-3 flex justify-center items-center gap-3 font-semibold text-lg md:text-xl tracking-wide rounded relative ${isBlinking ? 'animate-pulse' : ''} ${isDemo ? 'ring-2 ring-blue-500/50' : ''}`}>
                                <span>⚠️</span> {msg} {isDemo && <span className="text-[10px] ml-1 bg-blue-500 text-white px-2 rounded-full uppercase tracking-wider">Demo</span>}
                                {isDemo && (
                                    <button onClick={() => setDemoAlertEndTime(null)} className="absolute right-4 hidden md:block text-xs bg-red-500/20 text-red-500 px-3 py-1 rounded-full hover:bg-red-500/30 transition">
                                        Stop Demo
                                    </button>
                                )}
                            </div>
                        );
                    }
                    return null;
                })()}

                {/* Grid Map */}
                {loading || !prayers ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 animate-pulse flex-1 min-h-0 opacity-50">
                        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="bg-surface/10 rounded-xl h-full min-h-[100px] border border-white/5" />)}
                    </div>
                ) : (
                    <main className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-4 md:gap-y-6 md:gap-x-6 w-full max-w-5xl mx-auto flex-1 min-h-0">

                        {(() => {
                            const nowUnixLocal = Math.floor(currentTime.getTime() / 1000);
                            const times = [prayers.fajr, prayers.syuruk, prayers.dhuhr, prayers.asr, prayers.maghrib, prayers.isha];

                            let activeIdx = times.findIndex(t => t > nowUnixLocal);
                            if (activeIdx === -1) activeIdx = 0; // next is tomorrow's Fajr

                            const targetTime = (activeIdx === 0 && nowUnixLocal > prayers.isha) ? prayers.fajr + 86400 : times[activeIdx];
                            const diffSecs = targetTime - nowUnixLocal;

                            let countdownStr = "";
                            if (diffSecs > 0 && diffSecs < 86400) {
                                const h = Math.floor(diffSecs / 3600);
                                const m = Math.floor((diffSecs % 3600) / 60);
                                const s = diffSecs % 60;
                                countdownStr = `Begins ${h}H ${m}M ${s}S`;
                            }

                            const prayerList = [
                                { title: t("Fajr", "Subuh"), icon: MoonStar, time: prayers.fajr },
                                { title: t("Sunrise", "Syuruk"), icon: Sunrise, time: prayers.syuruk },
                                { title: t("Dhuhr", "Zohor"), icon: SunMedium, time: prayers.dhuhr },
                                { title: t("Asr", "Asar"), icon: Sun, time: prayers.asr },
                                { title: "Maghrib", icon: Sunset, time: prayers.maghrib },
                                { title: t("Isha", "Isyak"), icon: Moon, time: prayers.isha },
                            ];

                            return prayerList.map((p, idx) => {
                                const isActive = activeIdx === idx;
                                const Icon = p.icon;
                                // Special case for Active styles overriding local text explicitly 
                                const finalActiveStyle = theme.bgClass + " flex flex-col justify-center rounded-xl p-3 md:p-5 transition-all scale-[1.02] shadow-xl text-white";
                                return (
                                    <div key={idx} className={isActive ? finalActiveStyle : inactiveStyles.replace("p-4 md:p-6", "p-3 md:p-5")}>
                                        <div className={`flex items-center gap-2 md:gap-3 mb-1 md:mb-2 ${isActive ? 'text-white' : ''}`}>
                                            <Icon size={24} className="md:w-8 md:h-8" />
                                            <span className="text-xl md:text-3xl font-semibold">{p.title}</span>
                                        </div>
                                        <div className={`text-4xl md:text-6xl font-bold tracking-tighter tabular-nums ${isActive ? 'mb-2 text-white' : ''}`}>
                                            {formatTimeStr(p.time)}
                                        </div>
                                        {isActive && countdownStr && (
                                            <div className="text-[10px] md:text-xs font-bold uppercase tracking-wider opacity-90 text-white mt-auto">
                                                {countdownStr}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}

                    </main>
                )}

                <footer className="mt-4 md:mt-6 pt-2 shrink-0 text-center text-xs md:text-sm font-semibold opacity-60 text-text">
                    Zone: {zoneLabel}
                </footer>
            </div>

            {/* Massive Settings Drawer Overlay */}
            {settingsOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer" onClick={() => setSettingsOpen(false)} />
                    <div className="relative w-full md:w-[480px] bg-[#1A1A1A] h-full flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#1A1A1A]/95 backdrop-blur z-10">
                            <h3 className="text-xl font-bold text-white">{t("Settings", "Tetapan")}</h3>
                            <button onClick={() => setSettingsOpen(false)} className="p-2 bg-surface/5 rounded-full hover:bg-surface/10 transition text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-10 pb-24">

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">{t("Display Identity", "Identiti Paparan")}</h4>
                                    <p className="text-xs text-white/50">{t("What appears on screen", "Apa yang terpapar di skrin")}</p>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-semibold text-white/90 block mb-2">{t("Custom Title", "Tajuk Tersuai")}</label>
                                        <input
                                            value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                                            type="text" placeholder="Enter custom title"
                                            className="w-full bg-[#2A2A2A] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-white/90 block mb-3">{t("Theme Color", "Warna Tema")}</label>
                                        <div className="flex flex-wrap gap-2.5">
                                            {THEMES.map(tOption => (
                                                <button key={tOption.id} onClick={() => setTheme(tOption)} className={`w-8 h-8 rounded-full transition-transform ${tOption.bgClass} ${theme.id === tOption.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1A1A1A] scale-110' : ''}`} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">{t("Background Appearance", "Penampilan Latar")}</h4>
                                    <p className="text-xs text-white/50">{t("Upload or link an image and adjust transparency", "Muat naik imej dan laraskan kelegapan")}</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="w-full relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setBgImage(reader.result as string);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="w-full bg-[#2A2A2A] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 text-blue-700 hover:file:bg-blue-100"
                                        />
                                        {bgImage && (
                                            <button
                                                onClick={() => setBgImage("")}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full hover:bg-red-500/30 transition"
                                            >
                                                {t("Clear", "Kosongkan")}
                                            </button>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs text-white/70 mb-2">
                                            <span>{t("Overlay Opacity", "Kelegapan Lapisan")} ({bgOpacity}%)</span>
                                            <span>{t("Darker", "Lebih Gelap")}</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="100"
                                            value={bgOpacity} onChange={e => setBgOpacity(Number(e.target.value))}
                                            className="w-full accent-blue-500"
                                        />
                                        <p className="text-[10px] text-white/40 mt-1">{t("Set to 0% for pure photo, 100% for solid dark theme.", "Tetapkan 0% untuk foto tulen, 100% untuk tema gelap penuh.")}</p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">{t("Language", "Bahasa")}</h4>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setLanguage("en")} className={`flex-1 font-medium py-3 rounded-xl transition border ${language === "en" ? 'bg-blue-500 text-white border-blue-500' : 'bg-[#2A2A2A] text-white/80 border-white/5'}`}>English</button>
                                    <button onClick={() => setLanguage("ms")} className={`flex-1 font-medium py-3 rounded-xl transition border ${language === "ms" ? 'bg-blue-500 text-white border-blue-500' : 'bg-[#2A2A2A] text-white/80 border-white/5'}`}>Bahasa Melayu</button>
                                </div>
                            </section>

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">{t("Location & Prayer Time", "Lokasi & Waktu Solat")}</h4>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <select
                                            value={selectedZone} onChange={e => setSelectedZone(e.target.value)}
                                            className="w-full bg-[#2A2A2A] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                        >
                                            {zones.map(z => <option key={z.jakimCode} value={z.jakimCode}>{z.jakimCode} - {z.daerah.split(",")[0]}, {z.negeri}</option>)}
                                        </select>
                                    </div>
                                    <button className="w-full bg-blue-500 text-white font-medium py-3.5 rounded-xl hover:bg-blue-600 transition flex items-center justify-center gap-2">
                                        <MapPin size={18} /> {t("Locate Me", "Cari Lokasi")}
                                    </button>
                                </div>
                            </section>

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">{t("Time Format", "Format Masa")}</h4>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setUse24Hour(false)} className={`flex-1 font-medium py-3 rounded-xl transition border ${!use24Hour ? 'bg-blue-500 text-white border-blue-500' : 'bg-[#2A2A2A] text-white/80 border-white/5'}`}>{t("12 Hour", "12 Jam")}</button>
                                    <button onClick={() => setUse24Hour(true)} className={`flex-1 font-medium py-3 rounded-xl transition border ${use24Hour ? 'bg-blue-500 text-white border-blue-500' : 'bg-[#2A2A2A] text-white/80 border-white/5'}`}>{t("24 Hour", "24 Jam")}</button>
                                </div>
                            </section>

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">{t("Audio", "Audio")}</h4>
                                    <p className="text-xs text-white/50">{t("Sound behaviour", "Kelakuan bunyi")}</p>
                                </div>
                                <div className="space-y-3 bg-[#2A2A2A] rounded-2xl p-2 border border-white/5 mb-3">
                                    <div className="flex justify-between items-center p-2 px-3 cursor-pointer" onClick={() => setAudioEnabled(!audioEnabled)}>
                                        <span className="text-sm font-medium text-white/90">{t("Azan Status", "Status Azan")}</span>
                                        <div className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${audioEnabled ? 'bg-blue-500 justify-end' : 'bg-[#1A1A1A] justify-start'}`}><div className="w-4 h-4 bg-surface rounded-full shadow-sm" /></div>
                                    </div>
                                </div>

                                <div className="flex gap-2 mb-3">
                                    <button
                                        onClick={() => {
                                            if (audioSubuhRef.current) {
                                                audioSubuhRef.current.currentTime = 0;
                                                audioSubuhRef.current.play();
                                            }
                                        }}
                                        className="flex-1 bg-blue-500/20 text-blue-400 font-medium py-3 rounded-lg hover:bg-blue-500/30 transition flex flex-col items-center justify-center gap-1 text-xs border border-blue-500/20"
                                    >
                                        <Volume2 size={16} /> Test Subuh
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (audioOtherRef.current) {
                                                audioOtherRef.current.currentTime = 0;
                                                audioOtherRef.current.play();
                                            }
                                        }}
                                        className="flex-1 bg-emerald-500/20 text-emerald-400 font-medium py-3 rounded-lg hover:bg-emerald-500/30 transition flex flex-col items-center justify-center gap-1 text-xs border border-emerald-500/20"
                                    >
                                        <Volume2 size={16} /> {t("Test Local Azan", "Uji Azan Tempatan")}
                                    </button>
                                </div>
                            </section>

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">{t("Alerts & Notifications", "Amaran & Notifikasi")}</h4>
                                    <p className="text-xs text-white/50">{t("Visual warnings", "Peringatan visual")}</p>
                                </div>
                                <div className="space-y-3 bg-[#2A2A2A] rounded-2xl p-2 border border-white/5 mb-3">
                                    <div className="flex justify-between items-center p-2 px-3 cursor-pointer" onClick={() => setShowBannerAlert(!showBannerAlert)}>
                                        <span className="text-sm font-medium text-white/90">{t("Show 15-Min Banner", "Papar Sepanduk 15 Min")}</span>
                                        <div className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${showBannerAlert ? 'bg-blue-500 justify-end' : 'bg-[#1A1A1A] justify-start'}`}><div className="w-4 h-4 bg-surface rounded-full shadow-sm" /></div>
                                    </div>
                                    <div className="w-full h-px bg-white/5"></div>
                                    <div className={`flex justify-between items-center p-2 px-3 cursor-pointer ${!showBannerAlert ? 'opacity-50 pointer-events-none' : ''}`} onClick={() => setEnableBlinking(!enableBlinking)}>
                                        <span className="text-sm font-medium text-white/90">{t("Blink on last 5 min", "Berkelip pada 5 min akhir")}</span>
                                        <div className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${enableBlinking ? 'bg-blue-500 justify-end' : 'bg-[#1A1A1A] justify-start'}`}><div className="w-4 h-4 bg-surface rounded-full shadow-sm" /></div>
                                    </div>
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <button
                                        onClick={() => {
                                            if (demoAlertEndTime) setDemoAlertEndTime(null);
                                            else setDemoAlertEndTime(Math.floor(currentTime.getTime() / 1000) + 310); // Start at 5m 10s so it blinks soon
                                            setSettingsOpen(false);
                                        }}
                                        className={`flex-1 font-medium py-3 rounded-lg transition flex justify-center items-center gap-2 text-xs border ${demoAlertEndTime ? 'bg-red-500/20 text-red-400 border-red-500/20 hover:bg-red-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/20 hover:bg-blue-500/30'}`}
                                    >
                                        <Settings size={16} />
                                        {demoAlertEndTime ? t("Stop Demo Alert", "Hentikan Demo") : t("Test Banner & Blinking", "Uji Sepanduk & Kerdipan")}
                                    </button>
                                </div>
                            </section>
                        </div>

                        <div className="sticky bottom-0 p-6 bg-[#1A1A1A]/95 backdrop-blur border-t border-white/10 z-10 w-full mt-auto">
                            <button onClick={() => setSettingsOpen(false)} className="w-full bg-[#2A2A2A] text-white font-medium py-4 rounded-xl hover:bg-[#333] transition border border-white/5">
                                {t("Save", "Simpan")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Audio References (Must be outside Settings Modal to exist in DOM) */}
            <audio ref={audioSubuhRef} src="/audio/adzan_subuh.mp3" preload="auto" />
            <audio ref={audioOtherRef} src="/audio/adzan_nahawand.mp3" preload="auto" />
        </div>
    );
}
