"use client";

import { MessageCircleOff, Smartphone, VolumeX } from "lucide-react";
import type { PaparanScene } from "@/lib/paparan-masjid/types";

function formatMmSs(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function ReminderIcon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-red-500 bg-white text-red-600 shadow-[0_20px_40px_rgba(0,0,0,0.25)] sm:h-28 sm:w-28">
        {children}
      </div>
      <p className="text-center text-xs font-black uppercase tracking-[0.2em] text-white/75 sm:text-sm">
        {label}
      </p>
    </div>
  );
}

export default function FullScreenAlertScene({
  scene,
  prayerLabel,
  prayerTimeText,
  onDismiss,
}: {
  scene: PaparanScene;
  prayerLabel: string;
  prayerTimeText?: string;
  onDismiss?: () => void;
}) {
  if (scene.kind === "azanAlert") {
    return (
      <div
        className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_40%),linear-gradient(135deg,_rgba(10,14,18,0.98),_rgba(0,0,0,0.96))] px-8 text-center text-white"
        onClick={onDismiss}
        style={{ cursor: onDismiss ? "pointer" : "default" }}
      >
        <div className="max-w-6xl space-y-6">
          <p className="text-lg font-black uppercase tracking-[0.38em] text-white/65 sm:text-2xl">
            TELAH MASUK WAKTU
          </p>
          <h2 className="text-[6rem] font-black uppercase leading-[0.88] tracking-tight sm:text-[9rem] lg:text-[14rem] xl:text-[18rem]">
            {prayerLabel}
          </h2>
          {prayerTimeText && (
            <p className="text-2xl font-semibold tabular-nums text-white/50 sm:text-4xl">{prayerTimeText}</p>
          )}
        </div>
        {onDismiss && (
          <p className="absolute bottom-8 left-0 right-0 text-center text-sm font-semibold uppercase tracking-[0.3em] text-white/25 select-none">
            Klik di mana-mana untuk tutup
          </p>
        )}
      </div>
    );
  }

  if (scene.kind === "iqamatFinalAlert") {
    return (
      <div
        className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_38%),linear-gradient(180deg,_rgba(2,6,23,0.96),_rgba(0,0,0,0.97))] px-8 text-center text-white"
        onClick={onDismiss}
        style={{ cursor: onDismiss ? "pointer" : "default" }}
      >
        <div className="max-w-4xl space-y-6">
          <p className="text-lg font-black uppercase tracking-[0.34em] text-blue-200/75 sm:text-2xl">
            IQAMAT AKAN BERMULA
          </p>
          <h2 className="text-[6rem] font-black tabular-nums leading-none tracking-tight sm:text-[9rem] lg:text-[14rem] xl:text-[18rem]">
            {formatMmSs(scene.remainingMs)}
          </h2>
          <p className="text-xl font-semibold uppercase tracking-[0.24em] text-white/65 sm:text-2xl">
            Sila rapatkan saf dan bersedia
          </p>
        </div>
        {onDismiss && (
          <p className="absolute bottom-8 left-0 right-0 text-center text-sm font-semibold uppercase tracking-[0.3em] text-white/25 select-none">
            Klik di mana-mana untuk tutup
          </p>
        )}
      </div>
    );
  }

  if (scene.kind === "solatPhase") {
    return (
      <div
        className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.98))] px-6 text-center text-white"
        onClick={onDismiss}
        style={{ cursor: onDismiss ? "pointer" : "default" }}
      >
        <div className="max-w-5xl space-y-10">
          <div className="space-y-3">
            <p className="text-lg font-black uppercase tracking-[0.38em] text-white/55 sm:text-2xl">SOLAT</p>
            <h2 className="text-[4rem] font-black uppercase leading-[0.92] tracking-tight sm:text-[6rem] lg:text-[9rem] xl:text-[11rem]">
              SILA RAPATKAN SAF
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <ReminderIcon label="Matikan Telefon">
              <Smartphone size={42} strokeWidth={2.5} />
            </ReminderIcon>
            <ReminderIcon label="Silentkan Telefon">
              <VolumeX size={42} strokeWidth={2.5} />
            </ReminderIcon>
          </div>
        </div>
        {onDismiss && (
          <p className="absolute bottom-8 left-0 right-0 text-center text-sm font-semibold uppercase tracking-[0.3em] text-white/25 select-none">
            Klik di mana-mana untuk tutup
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[linear-gradient(180deg,_rgba(17,24,39,0.98),_rgba(0,0,0,0.98))] px-6 text-center text-white"
      onClick={onDismiss}
      style={{ cursor: onDismiss ? "pointer" : "default" }}
    >
      <div className="max-w-5xl space-y-10">
        <div className="space-y-4">
          <p className="text-lg font-black uppercase tracking-[0.38em] text-amber-200/70 sm:text-2xl">
            KHUTBAH JUMAAT
          </p>
          <h2 className="text-[3.5rem] font-black uppercase leading-[0.92] tracking-tight sm:text-[5rem] lg:text-[7rem] xl:text-[9rem]">
            JAGA ADAB DI DALAM MASJID
          </h2>
        </div>

        <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 text-left backdrop-blur-sm sm:grid-cols-2 sm:p-8">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-lg font-black uppercase tracking-[0.16em] text-white">Matikan telefon bimbit</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-lg font-black uppercase tracking-[0.16em] text-white">Silentkan telefon</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-lg font-black uppercase tracking-[0.16em] text-white">Dilarang bercakap</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-lg font-black uppercase tracking-[0.16em] text-white">Dilarang membuat bising</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8">
          <ReminderIcon label="Telefon Bimbit">
            <Smartphone size={42} strokeWidth={2.5} />
          </ReminderIcon>
          <ReminderIcon label="Silent Mode">
            <VolumeX size={42} strokeWidth={2.5} />
          </ReminderIcon>
          <ReminderIcon label="Jangan Bercakap">
            <MessageCircleOff size={42} strokeWidth={2.5} />
          </ReminderIcon>
        </div>
      </div>
      {onDismiss && (
        <p className="absolute bottom-8 left-0 right-0 text-center text-sm font-semibold uppercase tracking-[0.3em] text-white/25 select-none">
          Klik di mana-mana untuk tutup
        </p>
      )}
    </div>
  );
}