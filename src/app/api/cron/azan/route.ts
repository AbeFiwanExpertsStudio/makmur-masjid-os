import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as admin from "firebase-admin";

// ── Prayer labels (same as /api/notifications/azan) ──────────────
const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
type PrayerKey = (typeof PRAYER_KEYS)[number];

const PRAYER_LABELS: Record<PrayerKey, { ms: string; en: string }> = {
  fajr:    { ms: "Subuh",   en: "Fajr" },
  dhuhr:   { ms: "Zohor",   en: "Dhuhr" },
  asr:     { ms: "Asar",    en: "Asr" },
  maghrib: { ms: "Maghrib", en: "Maghrib" },
  isha:    { ms: "Isyak",   en: "Isha" },
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Dedup: stores "2026-03-11:fajr,dhuhr" in system_settings.last_azan_cron ──
async function getFiredPrayers(): Promise<{ date: string; prayers: string[] }> {
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("last_azan_cron")
    .eq("id", 1)
    .single();
  const raw = data?.last_azan_cron ?? "";
  const [date, ...rest] = raw.split(":");
  const prayers = rest.join(":").split(",").filter(Boolean);
  return { date: date || "", prayers };
}

async function markPrayerFired(todayStr: string, prayerKey: string, existingPrayers: string[]) {
  const updated = [...existingPrayers, prayerKey];
  await supabaseAdmin
    .from("system_settings")
    .update({ last_azan_cron: `${todayStr}:${updated.join(",")}` })
    .eq("id", 1);
}

// ── GET the configured zone from screen_config ──────────────────
async function getZone(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("screen_config")
    .eq("id", 1)
    .single();
  return data?.screen_config?.zone || "WLY01";
}

// ── Fetch today's prayer times ──────────────────────────────────
interface PrayerDay {
  day: number;
  fajr: number;
  syuruk: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

async function fetchPrayerTimes(zone: string): Promise<PrayerDay | null> {
  try {
    const res = await fetch(`https://api.waktusolat.app/v2/solat/${zone}`);
    if (!res.ok) return null;
    const data: { prayers: PrayerDay[] } = await res.json();
    const today = new Date().getDate();
    return data.prayers.find((p) => p.day === today) || data.prayers[0] || null;
  } catch {
    return null;
  }
}

// ── Main handler ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // Optional: verify Vercel cron secret for security
    const authHeader = req.headers.get("authorization");
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const zone = await getZone();
    const prayers = await fetchPrayerTimes(zone);
    if (!prayers) {
      return NextResponse.json({ skipped: true, reason: "No prayer data" });
    }

    const nowUnix = Math.floor(Date.now() / 1000);

    let matchedPrayer: PrayerKey | null = null;
    for (const key of PRAYER_KEYS) {
      const prayerUnix = prayers[key];
      const diff = nowUnix - prayerUnix;
      if (diff >= 0 && diff < 90) {
        matchedPrayer = key;
        break;
      }
    }

    if (!matchedPrayer) {
      return NextResponse.json({ skipped: true, reason: "No prayer match", nowUnix });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const fired = await getFiredPrayers();
    const todayPrayers = fired.date === todayStr ? fired.prayers : [];

    if (todayPrayers.includes(matchedPrayer)) {
      return NextResponse.json({ skipped: true, reason: "Already fired", prayer: matchedPrayer });
    }

    // Use centralized notification logic
    const { sendAzanNotification } = await import("@/lib/server/notifications");
    const result = await sendAzanNotification(matchedPrayer);

    // Mark as fired
    await markPrayerFired(todayStr, matchedPrayer, todayPrayers);

    return NextResponse.json({
      success: true,
      matchedPrayer,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err: any) {
    console.error("[cron/azan] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
