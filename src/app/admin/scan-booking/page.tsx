"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthContext";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import CameraScanner from "@/components/admin/CameraScanner";
import {
  ScanLine, CheckCircle2, XCircle, Loader2, ArrowLeft,
  Building2, Calendar, Clock, Users, Keyboard, Camera, User,
} from "lucide-react";
import type { VerifyBookingResult } from "@/types/database";

type ScanState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "valid"; result: VerifyBookingResult }
  | { phase: "invalid"; reason: string };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}
function fmtTime(t: string) { return t?.slice(0, 5) ?? ""; }

/* ═══════════════════════════════════════════════════════════ */

export default function ScanBookingPage() {
  const router = useRouter();
  const { isAdmin, isLoading } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualId, setManualId] = useState("");
  const [scanState, setScanState] = useState<ScanState>({ phase: "idle" });
  const phaseRef = useRef<ScanState["phase"]>("idle");

  // Keep ref in sync so verify() can guard without a dep on scanState
  useEffect(() => { phaseRef.current = scanState.phase; }, [scanState.phase]);

  // Redirect non-admins
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, isLoading, router]);

  /* ── Call RPC ── */
  const verify = useCallback(async (rawValue: string) => {
    if (phaseRef.current === "loading") return;

    // Strip our prefix if present
    const PREFIX = "makmur-booking:";
    const bookingId = rawValue.startsWith(PREFIX)
      ? rawValue.slice(PREFIX.length)
      : rawValue.trim();

    if (!bookingId) return;

    setScanState({ phase: "loading" });
    const supabase = createClient();

    const { data, error } = await supabase
      .rpc("verify_booking_token", { p_booking_id: bookingId })
      .single<VerifyBookingResult>();

    if (error || !data) {
      setScanState({ phase: "invalid", reason: t.scanBookingNotFound });
      return;
    }

    if (!data.valid) {
      setScanState({
        phase: "invalid",
        reason: t.scanBookingNotApproved(data.booking_status),
      });
      return;
    }

    setScanState({ phase: "valid", result: data });
  }, [t]);

  /* ── Camera scan handler ── */
  const handleCameraScan = useCallback((raw: string) => {
    verify(raw);
  }, [verify]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-text-muted" size={24} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-surface-alt transition text-text-muted"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="text-primary"><ScanLine size={26} strokeWidth={2.5} /></div>
          <div>
            <h1 className="text-2xl font-bold text-text">{t.scanBookingTitle}</h1>
            <p className="text-sm text-text-muted">{t.scanBookingSubtitle}</p>
          </div>
        </div>
      </div>

      {/* ── Mode toggle ── */}
      {scanState.phase !== "valid" && scanState.phase !== "invalid" && (
        <div className="flex gap-1.5 p-1 bg-surface-alt rounded-xl border border-border/60 mb-5">
          <button
            onClick={() => setMode("camera")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === "camera" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            <Camera size={14} /> Camera
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === "manual" ? "bg-primary text-white shadow-sm" : "text-text-muted hover:text-text"
            }`}
          >
            <Keyboard size={14} /> {t.scanBookingManual}
          </button>
        </div>
      )}

      {/* ── Scan UI ── */}
      {scanState.phase === "idle" && (
        <>
          {mode === "camera" ? (
            <div className="rounded-2xl overflow-hidden border border-border/60 shadow-sm">
              <CameraScanner onScan={handleCameraScan} />
            </div>
          ) : (
            <div className="card p-5 space-y-3">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                {t.scanBookingManual}
              </label>
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder={t.scanBookingManualPlaceholder}
                className="input w-full"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && verify(manualId)}
              />
              <button
                onClick={() => verify(manualId)}
                disabled={!manualId.trim()}
                className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.scanBookingVerify}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Loading ── */}
      {scanState.phase === "loading" && (
        <div className="card p-12 flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-primary" />
          <p className="font-semibold text-text-muted">{t.scanBookingVerifying}</p>
        </div>
      )}

      {/* ── Valid result ── */}
      {scanState.phase === "valid" && (
        <div className="card overflow-hidden">
          {/* Green header */}
          <div className="bg-emerald-500 px-6 py-5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t.scanBookingValid}</h2>
              <p className="text-emerald-100 text-sm font-medium">{scanState.result.facility_name}</p>
            </div>
          </div>
          {/* Not-today warning */}
          {!scanState.result.is_today && (
            <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-600/40 flex items-center gap-2">
              <span className="text-amber-500 text-sm">⚠️</span>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {t.scanBookingNotToday}
              </p>
            </div>
          )}
          {/* Details */}
          <div className="p-5 space-y-3">
            <DetailRow icon={<Building2 size={14} />} label={t.scanBookingFacility} value={scanState.result.facility_name} />
            <DetailRow icon={<Calendar size={14} />} label={t.scanBookingDate} value={fmtDate(scanState.result.booking_date)} />
            <DetailRow
              icon={<Clock size={14} />}
              label={t.scanBookingTime}
              value={`${fmtTime(scanState.result.start_time)} – ${fmtTime(scanState.result.end_time)}`}
            />
            <DetailRow icon={<User size={14} />} label={t.scanBookingGuest} value={scanState.result.booked_by_name} />
            <DetailRow icon={<Users size={14} />} label={t.scanBookingAttendees} value={String(scanState.result.attendees)} />
            {scanState.result.purpose && (
              <DetailRow icon={<ScanLine size={14} />} label={t.scanBookingPurpose} value={scanState.result.purpose} />
            )}
          </div>
          <div className="px-5 pb-5">
            <button
              onClick={() => { setScanState({ phase: "idle" }); setManualId(""); }}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all shadow-md"
            >
              {t.scanBookingReset}
            </button>
          </div>
        </div>
      )}

      {/* ── Invalid result ── */}
      {scanState.phase === "invalid" && (
        <div className="card overflow-hidden">
          {/* Red header */}
          <div className="bg-red-500 px-6 py-5 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <XCircle size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t.scanBookingInvalid}</h2>
              <p className="text-red-100 text-sm font-medium">{scanState.reason}</p>
            </div>
          </div>
          <div className="p-5">
            <button
              onClick={() => { setScanState({ phase: "idle" }); setManualId(""); }}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all shadow-md"
            >
              {t.scanBookingReset}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helper row component ── */
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-text-muted shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-text">{value}</p>
      </div>
    </div>
  );
}
