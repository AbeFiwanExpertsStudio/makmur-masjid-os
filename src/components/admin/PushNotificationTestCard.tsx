"use client";

import { useState } from "react";
import { Bell, Loader2, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";

const PRAYER_OPTIONS = [
  { key: "fajr",    label: "Subuh (Fajr)" },
  { key: "dhuhr",   label: "Zohor (Dhuhr)" },
  { key: "asr",     label: "Asar (Asr)" },
  { key: "maghrib", label: "Maghrib" },
  { key: "isha",    label: "Isyak (Isha)" },
];

export default function PushNotificationTestCard() {
  const [sending, setSending] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ key: string; sent: number } | null>(null);

  const sendTest = async (prayerKey: string) => {
    setSending(prayerKey);
    setLastResult(null);
    try {
      const res = await fetch("/api/notifications/azan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prayerKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setLastResult({ key: prayerKey, sent: json.sent ?? 0 });
      toast.success(`Push sent to ${json.sent} device(s)`);
    } catch (err: any) {
      toast.error(err.message || "Push failed");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="icon-box icon-box-primary"><Bell size={18} /></div>
        <div>
          <h2 className="text-base font-bold text-text">Push Notification Test</h2>
          <p className="text-xs text-text-muted">Send a test azan push to all registered devices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {PRAYER_OPTIONS.map(({ key, label }) => {
          const isSending = sending === key;
          const isSuccess = lastResult?.key === key;
          return (
            <button
              key={key}
              onClick={() => sendTest(key)}
              disabled={!!sending}
              className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-muted disabled:opacity-50 transition-all text-sm font-medium text-text group"
            >
              <span>{label}</span>
              <span className="flex items-center gap-2 text-xs text-text-muted">
                {isSending && <Loader2 size={14} className="animate-spin text-primary" />}
                {!isSending && isSuccess && (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 size={14} /> {lastResult.sent} sent
                  </span>
                )}
                {!isSending && !isSuccess && (
                  <Bell size={13} className="opacity-40 group-hover:opacity-100 transition" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {lastResult && (
        <p className="text-xs text-text-muted text-center">
          Last: <span className="font-semibold text-primary">
            {PRAYER_OPTIONS.find(p => p.key === lastResult.key)?.label}
          </span> → {lastResult.sent} device(s) notified
        </p>
      )}
    </div>
  );
}
