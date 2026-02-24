"use client";

import { useEffect, useState } from "react";

type ThemeColor =
    | "blue" | "indigo" | "pink" | "red" | "emerald" | "yellow" | "orange" | "cyan" | "zinc";

export interface ThemeOption { id: ThemeColor; hex: string; bgClass: string; textClass: string; }

export const THEMES: ThemeOption[] = [
    { id: "blue", hex: "#3B82F6", bgClass: "bg-blue-500", textClass: "text-blue-500" },
    { id: "indigo", hex: "#6366F1", bgClass: "bg-indigo-500", textClass: "text-indigo-500" },
    { id: "pink", hex: "#EC4899", bgClass: "bg-pink-500", textClass: "text-pink-500" },
    { id: "red", hex: "#EF4444", bgClass: "bg-red-500", textClass: "text-red-500" },
    { id: "emerald", hex: "#10B981", bgClass: "bg-emerald-500", textClass: "text-emerald-500" },
    { id: "yellow", hex: "#F59E0B", bgClass: "bg-yellow-500", textClass: "text-yellow-500" },
    { id: "orange", hex: "#F97316", bgClass: "bg-orange-500", textClass: "text-orange-500" },
    { id: "cyan", hex: "#06B6D4", bgClass: "bg-cyan-500", textClass: "text-cyan-500" },
    { id: "zinc", hex: "#71717A", bgClass: "bg-zinc-500", textClass: "text-zinc-500" },
];

export function usePrayerSettings() {
    const [theme, setTheme] = useState<ThemeOption>(THEMES[4]);
    const [use24Hour, setUse24Hour] = useState(false);
    const [customTitle, setCustomTitle] = useState("");
    const [audioEnabled, setAudioEnabled] = useState(false);

    // New Settings
    const [language, setLanguage] = useState<"en" | "ms">("en");
    const [bgImage, setBgImage] = useState<string>("");
    const [bgOpacity, setBgOpacity] = useState<number>(75);
    const [selectedZone, setSelectedZone] = useState<string>("");
    const [showBannerAlert, setShowBannerAlert] = useState<boolean>(true);
    const [enableBlinking, setEnableBlinking] = useState<boolean>(true);
    const [isLoaded, setIsLoaded] = useState(false);

    // Initial Load
    useEffect(() => {
        const stored = localStorage.getItem("makmur_waktu_settings");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.theme) setTheme(THEMES.find(t => t.id === parsed.theme) || THEMES[4]);
                if (typeof parsed.use24Hour === 'boolean') setUse24Hour(parsed.use24Hour);
                if (parsed.customTitle !== undefined) setCustomTitle(parsed.customTitle);
                if (typeof parsed.audioEnabled === 'boolean') setAudioEnabled(parsed.audioEnabled);
                if (parsed.language) setLanguage(parsed.language);
                if (parsed.bgOpacity !== undefined) setBgOpacity(parsed.bgOpacity);
                if (parsed.selectedZone) setSelectedZone(parsed.selectedZone);
                if (typeof parsed.showBannerAlert === 'boolean') setShowBannerAlert(parsed.showBannerAlert);
                if (typeof parsed.enableBlinking === 'boolean') setEnableBlinking(parsed.enableBlinking);
            } catch (e) { }
        }

        // Load image separately
        const storedImg = localStorage.getItem("makmur_waktu_bgImage");
        if (storedImg) setBgImage(storedImg);
        else if (stored) {
            // Migration edge case if previous crash left it inside makmur_waktu_settings
            try {
                const parsed = JSON.parse(stored);
                if (parsed.bgImage) setBgImage(parsed.bgImage);
            } catch (e) { }
        }

        setIsLoaded(true);
    }, []);

    // Save on changes
    useEffect(() => {
        if (!isLoaded) return;
        try {
            localStorage.setItem("makmur_waktu_settings", JSON.stringify({
                theme: theme.id,
                use24Hour,
                customTitle,
                audioEnabled,
                language,
                bgOpacity,
                selectedZone,
                showBannerAlert,
                enableBlinking
            }));

            // For large base64 images, use extremely simple localstorage with try catch, 
            // if it fails, alert the user the image is too large and clear it.
            try {
                localStorage.setItem("makmur_waktu_bgImage", bgImage);
            } catch (lsError) {
                console.error("Image too large for LocalStorage");
                alert("Gambar terlalu besar untuk disimpan (Melebihi had 5MB). Sila gunakan gambar bersaiz lebih kecil.");
                setBgImage("");
                localStorage.removeItem("makmur_waktu_bgImage");
            }
            window.dispatchEvent(new Event("makmur-bg-update"));
        } catch (e) {
            console.error("Storage save failed", e);
        }
    }, [theme, use24Hour, customTitle, audioEnabled, language, bgImage, bgOpacity, selectedZone, showBannerAlert, enableBlinking, isLoaded]);

    return {
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
    };
}
