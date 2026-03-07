export interface PrayerDay {
  day: number;
  hijri: string;
  fajr: number;
  syuruk: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export type PrayerKey = "fajr" | "syuruk" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYER_DISPLAY: { key: PrayerKey; ms: string }[] = [
  { key: "fajr", ms: "Subuh" },
  { key: "syuruk", ms: "Syuruk" },
  { key: "dhuhr", ms: "Zuhur" },
  { key: "asr", ms: "Asar" },
  { key: "maghrib", ms: "Maghrib" },
  { key: "isha", ms: "Isyak" },
];

export const AZAN_PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export type PaparanSceneKind =
  | "idle"
  | "preAzanCountdown"
  | "azanAlert"
  | "iqamatCountdownMain"
  | "iqamatFinalAlert"
  | "solatPhase"
  | "fridayKhutbah";

export interface PaparanScene {
  kind: PaparanSceneKind;
  token: string;
  prayerKey: PrayerKey | null;
  startedAtMs: number | null;
  endsAtMs: number | null;
  totalMs: number;
  remainingMs: number;
  progress: number;
}

export function getPrayerLabel(prayerKey: PrayerKey | null): string {
  if (!prayerKey) return "";
  return PRAYER_DISPLAY.find((prayer) => prayer.key === prayerKey)?.ms ?? prayerKey;
}

export const IDLE_SCENE: PaparanScene = {
  kind: "idle",
  token: "idle",
  prayerKey: null,
  startedAtMs: null,
  endsAtMs: null,
  totalMs: 0,
  remainingMs: 0,
  progress: 0,
};