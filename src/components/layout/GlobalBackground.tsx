"use client";

import { useEffect, useState } from "react";

export function GlobalBackground() {
    const [bgImage, setBgImage] = useState<string>("");
    // Default opacity from user request "overlay capacity 25%"
    const [bgOpacity, setBgOpacity] = useState<number>(25);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Load image and settings, same as Waktu Solat
        const storedImg = localStorage.getItem("makmur_waktu_bgImage");
        if (storedImg) setBgImage(storedImg);

        const stored = localStorage.getItem("makmur_waktu_settings");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.bgImage && !storedImg) setBgImage(parsed.bgImage);
                // Use the user requested 25% if it's not set
                if (parsed.bgOpacity !== undefined) setBgOpacity(parsed.bgOpacity);
            } catch (e) { }
        }

        setIsLoaded(true);

        // Listen for storage changes from other tabs/components
        const handleStorage = () => {
            const newImg = localStorage.getItem("makmur_waktu_bgImage");
            if (newImg) setBgImage(newImg);
            
            const newStored = localStorage.getItem("makmur_waktu_settings");
            if (newStored) {
                try {
                    const parsed = JSON.parse(newStored);
                    if (parsed.bgOpacity !== undefined) setBgOpacity(parsed.bgOpacity);
                } catch (e) { }
            }
        };

        window.addEventListener("storage", handleStorage);
        // Custom event for same-window updates
        window.addEventListener("makmur-bg-update", handleStorage);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("makmur-bg-update", handleStorage);
        };
    }, []);

    if (!isLoaded || !bgImage) return null;

    return (
        <div
            className="fixed inset-0 z-[-1] bg-background transition-opacity duration-1000 pointer-events-none"
            style={{
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: bgOpacity / 100
            }}
        />
    );
}
