"use client";

import type { PaparanScene } from "@/lib/paparan-masjid/types";

function formatMmSs(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function IslamicPattern() {
  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.07]"
      xmlns="http://www.w3.org/2000/svg"
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <pattern id="islamicStar" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="white" strokeWidth="0.8">
            <polygon points="50,10 57,38 82,38 62,53 70,78 50,63 30,78 38,53 18,38 43,38" />
            <rect x="36" y="36" width="28" height="28" transform="rotate(45 50 50)" />
            <polygon points="0,0 6,18 24,18 12,28 17,46 0,35" />
            <polygon points="100,0 94,18 76,18 88,28 83,46 100,35" />
            <polygon points="0,100 6,82 24,82 12,72 17,54 0,65" />
            <polygon points="100,100 94,82 76,82 88,72 83,54 100,65" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#islamicStar)" />
    </svg>
  );
}

export default function TimedCountdownScene({
  scene,
  prayerLabel,
}: {
  scene: PaparanScene;
  prayerLabel: string;
}) {
  const isPreAzan = scene.kind === "preAzanCountdown";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-[#060d14]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_140%_90%_at_50%_-15%,rgba(16,80,120,0.55),transparent_60%)]" />
      <IslamicPattern />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.65)_100%)]" />

      <div className="relative z-10 flex h-full items-center px-10 py-8 text-white lg:px-16">
        {/* Left: badge + prayer name + timer */}
        <div className="flex flex-1 min-w-0 flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-bold uppercase tracking-[0.35em] text-white/60">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {isPreAzan ? "Akan Masuk Waktu" : "Menuju Iqamat"}
          </div>

          <h2 className="text-[7rem] font-black uppercase leading-none tracking-tight text-white drop-shadow-[0_8px_32px_rgba(0,0,0,0.6)] sm:text-[9rem] lg:text-[13rem] xl:text-[17rem]">
            {prayerLabel}
          </h2>

          <div className="flex items-baseline gap-4">
            <p className="text-[3rem] font-black tabular-nums leading-none tracking-tight text-white/90 sm:text-[4rem] lg:text-[5.5rem]">
              {formatMmSs(scene.remainingMs)}
            </p>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/40">
              {isPreAzan ? "sebelum azan" : "sebelum iqamat"}
            </p>
          </div>
        </div>


      </div>
    </div>
  );
}
