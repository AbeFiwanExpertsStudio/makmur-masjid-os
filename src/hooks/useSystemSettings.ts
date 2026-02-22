"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SystemSettings {
    system_name: string;
    system_desc: string;
}

export function useSystemSettings() {
    const [settings, setSettings] = useState<SystemSettings>({
        system_name: "Makmur",
        system_desc: "Mosque OS", // default fallback
    });

    useEffect(() => {
        const supabase = createClient();

        // Initial fetch
        const fetchSettings = async () => {
            const { data } = await supabase.from("system_settings").select("system_name, system_desc").eq("id", 1).single();
            if (data) {
                setSettings(data);
            }
        };

        fetchSettings();

        // Listen for changes
        const channel = supabase
            .channel("system_settings_changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "system_settings", filter: "id=eq.1" },
                (payload) => {
                    if (payload.new) {
                        const newRecord = payload.new as SystemSettings;
                        setSettings({
                            system_name: newRecord.system_name,
                            system_desc: newRecord.system_desc,
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return settings;
}
