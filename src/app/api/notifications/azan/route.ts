import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PRAYER_LABELS: Record<string, { ms: string; en: string }> = {
  fajr:    { ms: "Subuh", en: "Fajr" },
  syuruk:  { ms: "Syuruk", en: "Syuruk" },
  dhuhr:   { ms: "Zohor", en: "Dhuhr" },
  asr:     { ms: "Asar", en: "Asr" },
  maghrib: { ms: "Maghrib", en: "Maghrib" },
  isha:    { ms: "Isyak", en: "Isha" },
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { prayerKey } = await req.json();

    if (!prayerKey || !PRAYER_LABELS[prayerKey]) {
      return NextResponse.json({ error: "Invalid prayerKey" }, { status: 400 });
    }

    // Fetch all FCM tokens from profiles (bypass RLS via service role)
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("fcm_tokens")
      .not("fcm_tokens", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tokens: string[] = (profiles ?? [])
      .flatMap((p: { fcm_tokens: string[] | null }) => p.fcm_tokens ?? [])
      .filter(Boolean);

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const label = PRAYER_LABELS[prayerKey];
    const title = `🕌 Waktu ${label.ms}`;
    const body = `Telah masuk waktu solat ${label.ms}. Segera berwudhu.`;

    // Delegate to the existing push route which handles firebase-admin
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const pushRes = await fetch(`${baseUrl}/api/notifications/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens, title, body, data: { type: "azan", prayerKey } }),
    });

    const pushJson = await pushRes.json();
    if (!pushRes.ok) {
      return NextResponse.json({ error: pushJson.error || "Push failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sent: pushJson.successCount ?? tokens.length });
  } catch (err: any) {
    console.error("[azan push]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
