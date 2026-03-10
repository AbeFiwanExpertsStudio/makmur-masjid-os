import * as admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";

// Initialize Firebase Admin SDK
export const initializeFirebaseAdmin = () => {
  if (admin.apps.length > 0) return admin.app();

  const serviceAccountStr = process.env.FIREBASE_ADMIN_SDK_JSON;
  if (!serviceAccountStr) {
    console.error("FIREBASE_ADMIN_SDK_JSON is missing");
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountStr);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Error parsing FIREBASE_ADMIN_SDK_JSON:", error);
    return null;
  }
};

export const PRAYER_LABELS: Record<string, { ms: string; en: string }> = {
  fajr:    { ms: "Subuh",   en: "Fajr" },
  syuruk:  { ms: "Syuruk",  en: "Syuruk" },
  dhuhr:   { ms: "Zohor",   en: "Dhuhr" },
  asr:     { ms: "Asar",    en: "Asr" },
  maghrib: { ms: "Maghrib", en: "Maghrib" },
  isha:    { ms: "Isyak",   en: "Isha" },
};

export async function sendAzanNotification(prayerKey: string) {
  const label = PRAYER_LABELS[prayerKey];
  if (!label) throw new Error(`Invalid prayerKey: ${prayerKey}`);

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all FCM tokens
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("fcm_tokens")
    .not("fcm_tokens", "is", null);

  if (error) throw error;

  const tokens: string[] = (profiles ?? [])
    .flatMap((p: any) => p.fcm_tokens ?? [])
    .filter(Boolean);

  if (tokens.length === 0) return { success: true, sent: 0, failed: 0 };

  const app = initializeFirebaseAdmin();
  if (!app) return { success: false, sent: 0, failed: 0, error: "Firebase not configured" };

  const title = `🕌 Waktu ${label.ms}`;
  const body = `Telah masuk waktu solat ${label.ms}. Segera berwudhu.`;

  const message = {
    notification: { title, body },
    data: { type: "azan", prayerKey },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (err: any) {
    return { success: false, sent: 0, failed: 0, error: err.message };
  }
}
