import type { ScreenConfig } from "@/hooks/useScreenConfig";
import { AZAN_PRAYERS, IDLE_SCENE, type PaparanScene, type PaparanSceneKind, type PrayerDay, type PrayerKey } from "./types";

const PRE_AZAN_MS = 15 * 60 * 1000;
const AZAN_ALERT_MS = 2 * 60 * 1000;
const IQAMAT_FINAL_ALERT_MS = 2 * 60 * 1000;
const SOLAT_PHASE_MS = 2 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildScene(
  kind: PaparanSceneKind,
  prayerKey: PrayerKey,
  startedAtMs: number,
  endsAtMs: number,
  nowMs: number,
): PaparanScene {
  const totalMs = Math.max(endsAtMs - startedAtMs, 1);
  const remainingMs = Math.max(0, endsAtMs - nowMs);
  const progress = clamp((nowMs - startedAtMs) / totalMs, 0, 1);

  return {
    kind,
    token: `${kind}:${prayerKey}:${startedAtMs}`,
    prayerKey,
    startedAtMs,
    endsAtMs,
    totalMs,
    remainingMs,
    progress,
  };
}

function getFridayKhutbahEndMs(now: Date) {
  const khutbahEnd = new Date(now);
  khutbahEnd.setHours(14, 0, 0, 0);
  return khutbahEnd.getTime();
}

export function resolvePaparanScene({
  now,
  prayers,
  config,
}: {
  now: Date;
  prayers: PrayerDay | null;
  config: ScreenConfig;
}): PaparanScene {
  if (!prayers) return IDLE_SCENE;

  const nowMs = now.getTime();
  const iqamatDelayMs = Math.max(0, config.alert_iqamat.delay_minutes) * 60 * 1000;
  const isFriday = now.getDay() === 5;

  for (const prayerKey of AZAN_PRAYERS) {
    const prayerMs = prayers[prayerKey] * 1000;
    const preAzanStartMs = prayerMs - PRE_AZAN_MS;
    const azanEndMs = prayerMs + AZAN_ALERT_MS;

    if (config.alert_masuk.enabled && nowMs >= preAzanStartMs && nowMs < prayerMs) {
      return buildScene("preAzanCountdown", prayerKey, preAzanStartMs, prayerMs, nowMs);
    }

    if (config.alert_masuk.enabled && nowMs >= prayerMs && nowMs < azanEndMs) {
      return buildScene("azanAlert", prayerKey, prayerMs, azanEndMs, nowMs);
    }

    if (isFriday && prayerKey === "dhuhr") {
      const khutbahEndMs = getFridayKhutbahEndMs(now);
      if (nowMs >= azanEndMs && nowMs < khutbahEndMs) {
        return buildScene("fridayKhutbah", prayerKey, azanEndMs, khutbahEndMs, nowMs);
      }
      continue;
    }

    if (!config.alert_iqamat.enabled || iqamatDelayMs === 0) {
      continue;
    }

    const iqamatTargetMs = prayerMs + iqamatDelayMs;
    const iqamatMainStartMs = azanEndMs;
    const iqamatFinalStartMs = Math.max(iqamatMainStartMs, iqamatTargetMs - IQAMAT_FINAL_ALERT_MS);

    if (nowMs >= iqamatMainStartMs && nowMs < iqamatFinalStartMs) {
      return buildScene("iqamatCountdownMain", prayerKey, iqamatMainStartMs, iqamatFinalStartMs, nowMs);
    }

    if (nowMs >= iqamatFinalStartMs && nowMs < iqamatTargetMs) {
      return buildScene("iqamatFinalAlert", prayerKey, iqamatFinalStartMs, iqamatTargetMs, nowMs);
    }

    if (nowMs >= iqamatTargetMs && nowMs < iqamatTargetMs + SOLAT_PHASE_MS) {
      return buildScene("solatPhase", prayerKey, iqamatTargetMs, iqamatTargetMs + SOLAT_PHASE_MS, nowMs);
    }
  }

  return IDLE_SCENE;
}