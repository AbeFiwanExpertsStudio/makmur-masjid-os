"use client";

import { useState } from "react";
import { X, KeyRound, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "done";

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const [step, setStep]                   = useState<Step>("form");
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew]             = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [busy, setBusy]                   = useState(false);

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
    if (err) setError(err.message);
    else setStep("done");
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pw-title"
    >
      <div
        className="bg-surface rounded-2xl w-full max-w-sm shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="hero-gradient p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/20 rounded-full p-1"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-3">
            <KeyRound size={20} />
          </div>
          <h2 id="change-pw-title" className="text-lg font-bold">Change Password</h2>
          <p className="text-white/60 text-sm mt-0.5">
            {step === "form" ? "Enter a new password for your account" : "Password updated successfully"}
          </p>
        </div>

        <div className="p-6">
          {/*  Done  */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={44} className="text-emerald-500" />
              <p className="font-semibold text-text">Password changed!</p>
              <p className="text-sm text-text-muted">Your new password is active.</p>
              <button onClick={onClose} className="mt-2 w-full py-3 btn-primary text-sm">
                Close
              </button>
            </div>
          )}

          {/*  Form  */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              {/* New password */}
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
                    className="w-full pl-4 pr-11 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3.5 top-3 text-text-muted hover:text-text-secondary"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
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
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3.5 top-3 text-text-muted hover:text-text-secondary"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 btn-primary text-sm flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                {busy ? "Updating" : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
