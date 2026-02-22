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
    const [selectedZone, setSelectedZone] = useState<string>("WLY01");
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
        isLoaded
    } = usePrayerSettings();

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    const audioSubuhRef = useRef<HTMLAudioElement | null>(null);
    const audioOtherRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        fetch("https://api.waktusolat.app/zones")
            .then((res) => res.json())
            .then((data: Zone[]) => setZones(data))
            .catch(() => { });

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
                        }
                    } catch (err) { }
                },
                () => { }, { enableHighAccuracy: true }
            );
        }
    }, []);

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

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);

            if (audioEnabled && prayers) {
                const nowUnix = Math.floor(now.getTime() / 1000);

                // 15 Minute Alerts
                const tMinus15 = [prayers.fajr, prayers.dhuhr, prayers.asr, prayers.maghrib, prayers.isha]
                    .find(t => Math.abs(t - (nowUnix + 900)) < 2);

                if (tMinus15) {
                    const prayerNames = [[prayers.fajr, "Subuh"], [prayers.dhuhr, "Zohor"], [prayers.asr, "Asar"], [prayers.maghrib, "Maghrib"], [prayers.isha, "Isyak"]];
                    const matchedPType = prayerNames.find(p => p[0] === tMinus15)?.[1] || "Solat";
                    const isM = language === "ms";
                    setAlertMessage(isM ? `Waktu ${matchedPType} masuk dalam masa 15 minit!` : `${matchedPType} begins in 15 minutes!`);

                    if (Notification.permission === "granted") {
                        new Notification(isM ? "Peringatan Waktu Solat" : "Prayer Time Alert", {
                            body: isM ? `Waktu ${matchedPType} masuk dalam masa 15 minit.` : `15 minutes until ${matchedPType}.`,
                        });
                    } else if (Notification.permission !== "denied") {
                        Notification.requestPermission();
                    }
                }

                // Autoplay Azan Logic
                const isFajr = Math.abs(prayers.fajr - nowUnix) < 2;
                const isOther = [prayers.dhuhr, prayers.asr, prayers.maghrib, prayers.isha].some(t => Math.abs(t - nowUnix) < 2);

                if (isFajr && audioSubuhRef.current) {
                    audioSubuhRef.current.currentTime = 0;
                    audioSubuhRef.current.play().catch(e => console.log(e));
                }
                if (isOther && audioOtherRef.current) {
                    audioOtherRef.current.currentTime = 0;
                    audioOtherRef.current.play().catch(e => console.log(e));
                }
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [audioEnabled, prayers, language]);

    if (!isLoaded) return <div className="min-h-[50vh] flex items-center justify-center">Loading Waktu...</div>;

    const t = (en: string, ms: string) => language === "ms" ? ms : en;

    const activeStyles = theme.bgClass + " text-white flex flex-col justify-center rounded-xl p-4 md:p-6 transition-all scale-[1.02] shadow-xl";
    const inactiveStyles = "text-slate-800 flex flex-col justify-center rounded-xl p-4 md:p-6 transition-all bg-white border border-slate-200 shadow-sm hover:shadow-md";

    const formatTimeStr = (unixSec: number) => {
        const d = new Date(unixSec * 1000);
        return format(d, use24Hour ? "HH:mm" : "hh:mm");
    };

    return (
        <div className="flex-1 w-full flex flex-col relative overflow-hidden transition-colors duration-500 shadow-2xl">

            {/* Background Image Layer */}
            <div
                className="absolute inset-0 z-0 bg-[#F8FAF9] transition-opacity"
                style={{
                    backgroundImage: bgImage ? `url(${bgImage})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: bgOpacity ? bgOpacity / 100 : 1
                }}
            />

            {/* Custom Pop-up Toast Alert logic */}
            {alertMessage && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-amber-500 text-black px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                    <span>🔔</span> {alertMessage}
                    <button onClick={() => setAlertMessage(null)} className="opacity-70 hover:opacity-100 ml-2">✕</button>
                </div>
            )}

            <div className="relative z-20 w-full max-w-7xl mx-auto px-4 py-6 md:p-12 flex flex-col flex-1 h-full min-h-[500px]">
                {/* Header Data Section */}
                <header className="flex justify-between items-start w-full mb-10 md:mb-16">
                    <div className="space-y-1 text-slate-800 font-bold">
                        <h1 className="text-2xl md:text-5xl font-bold tracking-tight">{format(currentTime, "EEEE, d MMM yyyy")}</h1>
                        <h2 className="text-xl md:text-3xl font-medium opacity-90">{customTitle || hijriDate}</h2>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className={`flex items-center gap-2 text-xl md:text-3xl font-bold tracking-tight ${theme.textClass}`}>
                            {sysSettings.system_name || "Makmur OS"}
                            <button onClick={() => setSettingsOpen(true)} className="ml-2 hover:opacity-80 p-2 text-slate-400 hover:text-slate-800 transition">
                                <Settings size={28} />
                            </button>
                        </div>
                        <div className="text-2xl md:text-4xl font-semibold mt-1 tracking-wider tabular-nums text-slate-800">
                            {format(currentTime, "HH:mm:ss")}
                        </div>
                    </div>
                </header>

                {/* Grid Map */}
                {loading || !prayers ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6 animate-pulse flex-1 max-h-[60vh] opacity-50">
                        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="bg-white/10 rounded-xl h-40 border border-white/5" />)}
                    </div>
                ) : (
                    <main className="grid grid-cols-2 md:grid-cols-3 gap-y-12 gap-x-6 w-full max-w-5xl mx-auto flex-1 content-center">

                        <div className={activeStyles}>
                            <div className="flex items-center gap-3 mb-2 md:mb-4">
                                <MoonStar size={32} />
                                <span className="text-2xl md:text-4xl font-semibold">{t("Fajr", "Subuh")}</span>
                            </div>
                            <div className="text-5xl md:text-7xl font-bold tracking-tighter mb-4 tabular-nums">{formatTimeStr(prayers.fajr)}</div>
                        </div>

                        <div className={inactiveStyles}>
                            <div className="flex items-center gap-3 mb-2 md:mb-4">
                                <Sunrise size={32} />
                                <span className="text-2xl md:text-4xl font-medium">{t("Sunrise", "Syuruk")}</span>
                            </div>
                            <div className="text-5xl md:text-7xl font-medium tracking-tighter tabular-nums">{formatTimeStr(prayers.syuruk)}</div>
                        </div>

                        <div className={inactiveStyles}>
                            <div className="flex items-center gap-3 mb-2 md:mb-4">
                                <SunMedium size={32} />
                                <span className="text-2xl md:text-4xl font-medium">{t("Dhuhr", "Zohor")}</span>
                            </div>
                            <div className="text-5xl md:text-7xl font-medium tracking-tighter tabular-nums">{formatTimeStr(prayers.dhuhr)}</div>
                        </div>

                        <div className={inactiveStyles}>
                            <div className="flex items-center gap-3 mb-2 md:mb-4">
                                <Sun size={32} />
                                <span className="text-2xl md:text-4xl font-medium">{t("Asr", "Asar")}</span>
                            </div>
                            <div className="text-5xl md:text-7xl font-medium tracking-tighter tabular-nums">{formatTimeStr(prayers.asr)}</div>
                        </div>

                        <div className={inactiveStyles}>
                            <div className="flex items-center gap-3 mb-2 md:mb-4">
                                <Sunset size={32} />
                                <span className="text-2xl md:text-4xl font-medium">Maghrib</span>
                            </div>
                            <div className="text-5xl md:text-7xl font-medium tracking-tighter tabular-nums">{formatTimeStr(prayers.maghrib)}</div>
                        </div>

                        <div className={inactiveStyles}>
                            <div className="flex items-center gap-3 mb-2 md:mb-4">
                                <Moon size={32} />
                                <span className="text-2xl md:text-4xl font-medium">{t("Isha", "Isyak")}</span>
                            </div>
                            <div className="text-5xl md:text-7xl font-medium tracking-tighter tabular-nums">{formatTimeStr(prayers.isha)}</div>
                        </div>

                    </main>
                )}

                <footer className="mt-auto min-h-16 pt-8 text-center text-sm font-semibold opacity-60 text-slate-800">
                    Zone: {zoneLabel}
                </footer>
            </div>

            {/* Massive Settings Drawer Overlay */}
            {settingsOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer" onClick={() => setSettingsOpen(false)} />
                    <div className="relative w-full md:w-[480px] bg-[#1A1A1A] h-full flex flex-col shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#1A1A1A]/95 backdrop-blur z-10">
                            <h3 className="text-xl font-bold text-white">Settings</h3>
                            <button onClick={() => setSettingsOpen(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-10 pb-24">

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">Display Identity</h4>
                                    <p className="text-xs text-white/50">What appears on screen</p>
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-sm font-semibold text-white/90 block mb-2">Custom Title</label>
                                        <input
                                            value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                                            type="text" placeholder="Enter custom title"
                                            className="w-full bg-[#2A2A2A] border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-white/90 block mb-3">Theme Color</label>
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
                                    <h4 className="font-bold text-white mb-1">Background Appearance</h4>
                                    <p className="text-xs text-white/50">Upload or link an image and adjust transparency</p>
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
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs text-white/70 mb-2">
                                            <span>Overlay Opacity ({bgOpacity}%)</span>
                                            <span>Darker</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="100"
                                            value={bgOpacity} onChange={e => setBgOpacity(Number(e.target.value))}
                                            className="w-full accent-blue-500"
                                        />
                                        <p className="text-[10px] text-white/40 mt-1">Set to 0% for pure photo, 100% for solid dark theme.</p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">Language</h4>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setLanguage("en")} className={`flex-1 font-medium py-3 rounded-xl transition border ${language === "en" ? 'bg-blue-500 text-white border-blue-500' : 'bg-[#2A2A2A] text-white/80 border-white/5'}`}>English</button>
                                    <button onClick={() => setLanguage("ms")} className={`flex-1 font-medium py-3 rounded-xl transition border ${language === "ms" ? 'bg-blue-500 text-white border-blue-500' : 'bg-[#2A2A2A] text-white/80 border-white/5'}`}>Bahasa Melayu</button>
                                </div>
                            </section>

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">Location & Prayer Time</h4>
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
                                    <h4 className="font-bold text-white mb-1">Time Format</h4>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setUse24Hour(false)} className={`flex-1 font-medium py-3 rounded-xl transition border ${!use24Hour ? 'bg-blue-500 text-white border-blue-500' : 'bg-[#2A2A2A] text-white/80 border-white/5'}`}>12 Hour</button>
                                    <button onClick={() => setUse24Hour(true)} className={`flex-1 font-medium py-3 rounded-xl transition border ${use24Hour ? 'bg-blue-500 text-white border-blue-500' : 'bg-[#2A2A2A] text-white/80 border-white/5'}`}>24 Hour</button>
                                </div>
                            </section>

                            <section>
                                <div className="mb-4">
                                    <h4 className="font-bold text-white mb-1">Audio</h4>
                                    <p className="text-xs text-white/50">Sound behaviour</p>
                                </div>
                                <div className="space-y-3 bg-[#2A2A2A] rounded-2xl p-2 border border-white/5 mb-3">
                                    <div className="flex justify-between items-center p-2 px-3 cursor-pointer" onClick={() => setAudioEnabled(!audioEnabled)}>
                                        <span className="text-sm font-medium text-white/90">Azan Status</span>
                                        <div className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${audioEnabled ? 'bg-blue-500 justify-end' : 'bg-[#1A1A1A] justify-start'}`}><div className="w-4 h-4 bg-white rounded-full shadow-sm" /></div>
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
                                        <Volume2 size={16} /> Test Local Azan
                                    </button>
                                </div>

                                <audio ref={audioSubuhRef} src="/audio/adzan_subuh.mp3" preload="none" />
                                <audio ref={audioOtherRef} src="/audio/adzan_nahawand.mp3" preload="none" />
                            </section>
                        </div>

                        <div className="sticky bottom-0 p-6 bg-[#1A1A1A]/95 backdrop-blur border-t border-white/10 z-10 w-full mt-auto">
                            <button onClick={() => setSettingsOpen(false)} className="w-full bg-[#2A2A2A] text-white font-medium py-4 rounded-xl hover:bg-[#333] transition border border-white/5">
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
