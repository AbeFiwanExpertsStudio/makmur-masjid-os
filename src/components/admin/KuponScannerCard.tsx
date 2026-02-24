"use client";

import { useState, useCallback, useMemo } from "react";
import { Camera, Keyboard, Loader2, ScanLine, CheckCircle2, X, ChevronRight, ChevronUp, ChevronDown, QrCode, Users } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";
import { scanKupon } from "@/lib/mutations/claims";
import { toast } from "react-hot-toast";
import CameraScanner from "@/components/admin/CameraScanner";

export type UnclaimedKupon = {
  id: string;
  event_id: string;
  event_name: string;
  guest_uuid: string;
  display_name: string;
  claimed_at: string;
};

interface Props {
  unclaimedKupons: UnclaimedKupon[];
  onRefresh: () => void;
}

/** Returns up to 2 uppercase initials from a display name or email */
function initials(name: string): string {
  const clean = name.replace(/@.*/, ""); // strip email domain
  const parts = clean.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

export default function KuponScannerCard({ unclaimedKupons, onRefresh }: Props) {
  const { t } = useLanguage();
  const [scanInput, setScanInput] = useState("");
  const [cameraMode, setCameraMode] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<{ id: string; name: string; status: "ok" | "fail" }[]>([]);
  const [showUnclaimed, setShowUnclaimed] = useState(true);
  const [activeEvent, setActiveEvent] = useState<string>("all");

  const sessionScanned = scanHistory.filter((s) => s.status === "ok").length;
  const totalUnclaimed = unclaimedKupons.length;

  const eventOptions = useMemo(() => {
    const seen = new Map<string, string>();
    unclaimedKupons.forEach((k) => seen.set(k.event_id, k.event_name));
    return Array.from(seen.entries());
  }, [unclaimedKupons]);

  const filteredUnclaimed = useMemo(
    () => activeEvent === "all" ? unclaimedKupons : unclaimedKupons.filter((k) => k.event_id === activeEvent),
    [unclaimedKupons, activeEvent]
  );

  const handleScan = useCallback(async (overrideValue?: string, meta?: { name?: string }) => {
    const raw = overrideValue ?? scanInput;
    if (!raw.trim() || scanningId) return;
    const input = raw.trim();
    setScanningId(input);
    if (!overrideValue) setScanInput("");
    try {
      const res = await scanKupon(input);
      if (res.success) {
        setScanHistory((prev) => [{ id: input, name: meta?.name ?? input.slice(0, 8), status: "ok" }, ...prev]);
        toast.success(`✓ Scanned — ${res.remaining} packs remaining`);
        onRefresh();
      } else {
        toast.error(res.error || "Failed to scan kupon");
        setScanHistory((prev) => [{ id: input, name: meta?.name ?? input.slice(0, 8), status: "fail" }, ...prev]);
      }
    } catch {
      toast.error("Error scanning kupon");
    } finally {
      setScanningId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanInput, scanningId]);

  const handleCameraQR = useCallback((raw: string) => {
    const PREFIX = "makmur-kupon:";
    handleScan(raw.startsWith(PREFIX) ? raw.slice(PREFIX.length) : raw);
  }, [handleScan]);

  return (
    <div className="card overflow-hidden">

      {/* â”€â”€ Hero header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="hero-gradient px-6 pt-5 pb-4 relative overflow-hidden">
        <div className="pattern-bg absolute inset-0 opacity-10" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <QrCode size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base leading-tight">{t.adminScanner}</h2>
              <p className="text-white/55 text-[11px] font-medium">{t.adminScanDesc}</p>
            </div>
          </div>

          {/* Segment toggle */}
          <div className="flex bg-white/10 border border-white/15 rounded-xl p-0.5 text-xs font-semibold backdrop-blur-sm">
            <button
              onClick={() => setCameraMode(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${!cameraMode ? "bg-white text-primary shadow-sm" : "text-white/70 hover:text-white"}`}
            >
              <Keyboard size={12} /> {t.adminManual}
            </button>
            <button
              onClick={() => setCameraMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${cameraMode ? "bg-white text-primary shadow-sm" : "text-white/70 hover:text-white"}`}
            >
              <Camera size={12} /> {t.adminCamera}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* â”€â”€ Stats row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-primary/20 bg-primary-50 dark:bg-primary/10 px-4 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/15 dark:bg-primary/20 flex items-center justify-center shrink-0">
              <CheckCircle2 size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-primary leading-none">{sessionScanned}</p>
              <p className="text-[11px] text-text-muted font-medium mt-0.5">Scanned</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-alt dark:bg-surface-muted px-4 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-surface dark:bg-surface-alt flex items-center justify-center shrink-0 border border-border">
              <Users size={15} className="text-text-muted" />
            </div>
            <div>
              <p className="text-xl font-bold text-text leading-none">{totalUnclaimed}</p>
              <p className="text-[11px] text-text-muted font-medium mt-0.5">Unclaimed</p>
            </div>
          </div>
        </div>

        {/* â”€â”€ Scan input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {cameraMode ? (
          <div className="rounded-2xl overflow-hidden border border-border">
            <CameraScanner onScan={handleCameraQR} />
            {scanningId && (
              <p className="text-xs text-text-muted text-center py-2 flex items-center justify-center gap-1 bg-surface-alt">
                <Loader2 size={12} className="animate-spin" /> Processingâ€¦
              </p>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t.adminScanInput}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              className="flex-1 border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background transition-colors"
            />
            <button
              onClick={() => handleScan()}
              disabled={!!scanningId}
              className="w-11 h-11 btn-primary rounded-xl disabled:opacity-50 shrink-0"
            >
              {scanningId ? <Loader2 size={18} className="animate-spin" /> : <ScanLine size={18} />}
            </button>
          </div>
        )}

        {/* â”€â”€ Unclaimed list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <button
              onClick={() => setShowUnclaimed((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-text"
            >
              {t.adminUnclaimedKupons}
              <span className="inline-flex items-center justify-center text-[11px] font-bold bg-gold-light/50 text-gold-dark dark:bg-surface-muted dark:text-gold rounded-full px-2 py-0.5 min-w-[1.4rem]">
                {filteredUnclaimed.length}
              </span>
            </button>
            <button
              onClick={() => setShowUnclaimed((v) => !v)}
              className="flex items-center gap-0.5 text-[11px] text-text-muted hover:text-text transition-colors"
            >
              {showUnclaimed
                ? <><ChevronUp size={13} /> {t.adminHide}</>
                : <><ChevronDown size={13} /> {t.adminShow}</>}
            </button>
          </div>

          {/* Event filter pills */}
          {showUnclaimed && eventOptions.length > 1 && (
            <div className="flex gap-1.5 flex-wrap mb-3">
              <button
                onClick={() => setActiveEvent("all")}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${activeEvent === "all" ? "bg-primary text-white border-primary shadow-sm" : "bg-background border-border text-text-muted hover:border-primary/40"}`}
              >
                All ({unclaimedKupons.length})
              </button>
              {eventOptions.map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setActiveEvent(id)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all truncate max-w-[150px] ${activeEvent === id ? "bg-primary text-white border-primary shadow-sm" : "bg-background border-border text-text-muted hover:border-primary/40"}`}
                >
                  {name} ({unclaimedKupons.filter((k) => k.event_id === id).length})
                </button>
              ))}
            </div>
          )}

          {showUnclaimed && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {filteredUnclaimed.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <CheckCircle2 size={22} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">{t.adminAllScanned}</p>
                    <p className="text-xs text-text-muted mt-0.5">{t.adminAllScannedSub}</p>
                  </div>
                </div>
              ) : (
                filteredUnclaimed.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center gap-3 px-3 py-2.5 bg-background border border-border rounded-xl hover:border-primary/40 hover:bg-primary-50/20 dark:hover:bg-primary/5 transition-all"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">
                        {initials(k.display_name || "G")}
                      </span>
                    </div>

                    {/* Info â€” tap to fill input */}
                    <button
                      onClick={() => { setScanInput(k.id); setCameraMode(false); }}
                      className="min-w-0 flex-1 text-left"
                      title="Tap to fill input"
                    >
                      <p className="text-sm font-semibold text-text truncate leading-tight">{k.display_name || t.adminGuest}</p>
                      <p className="text-[11px] text-text-muted truncate">{k.event_name} Â· <span className="font-mono">#{k.id.slice(0, 6)}</span></p>
                    </button>

                    {/* One-tap scan */}
                    <button
                      onClick={() => handleScan(k.id, { name: k.display_name || t.adminGuest })}
                      disabled={!!scanningId}
                      className="shrink-0 w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-95 transition-all flex items-center justify-center disabled:opacity-40"
                      title="Scan now"
                    >
                      {scanningId === k.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <ChevronRight size={15} />}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* â”€â”€ Session history â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {scanHistory.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">{t.adminSessionHistory}</p>
              <button
                onClick={() => setScanHistory([])}
                className="text-[11px] text-text-muted hover:text-text flex items-center gap-0.5 transition-colors"
              >
                <X size={11} /> Clear
              </button>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
              {scanHistory.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                    s.status === "ok"
                      ? "bg-primary-50/50 dark:bg-primary/5 border-primary/20"
                      : "bg-red-50/50 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/40"
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold ${
                    s.status === "ok"
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-red-100 dark:bg-red-950/50 text-red-500 border border-red-200 dark:border-red-900/60"
                  }`}>
                    {initials(s.name)}
                  </div>
                  <span className="font-medium text-text text-sm truncate flex-1">{s.name}</span>
                  <span className={`font-semibold shrink-0 flex items-center gap-1 text-xs ${s.status === "ok" ? "text-primary" : "text-red-500 dark:text-red-400"}`}>
                    {s.status === "ok"
                      ? <><CheckCircle2 size={12} /> Scanned</>
                      : <><X size={12} /> Failed</>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

