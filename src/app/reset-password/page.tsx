"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Verify we have an active session before showing the form.
  // The auth callback already exchanged the code — this just confirms it.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else {
        // No session means the link was invalid or already used
        router.replace("/?reset=invalid");
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      setDone(true);
      // Redirect to home after 2 seconds
      setTimeout(() => router.replace("/"), 2000);
    }
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="hero-gradient p-7 text-white">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-3">
              <KeyRound size={22} />
            </div>
            <h1 className="text-xl font-bold">Set New Password</h1>
            <p className="text-white/60 text-sm mt-1">
              {done ? "Password updated — redirecting…" : "Choose a strong password for your account"}
            </p>
          </div>

          <div className="p-6">
            {done ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 size={44} className="text-emerald-500" />
                <p className="font-semibold text-text">Password changed successfully!</p>
                <p className="text-sm text-text-muted">Taking you back to the home page…</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      autoFocus
                      className="w-full pl-4 pr-11 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                    />
                    <button type="button" onClick={() => setShowNew((v) => !v)} tabIndex={-1}
                      className="absolute right-3.5 top-3 text-text-muted hover:text-text-secondary">
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Must match above"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-4 pr-11 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} tabIndex={-1}
                      className="absolute right-3.5 top-3 text-text-muted hover:text-text-secondary">
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={busy}
                  className="w-full py-3.5 btn-primary text-sm flex justify-center items-center gap-2 disabled:opacity-50">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                  {busy ? "Updating…" : "Set New Password"}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-text-muted mt-4">
          This link can only be used once and expires after 1 hour.
        </p>
      </div>
    </div>
  );
}
