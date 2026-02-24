"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { useState } from "react";
import { X, Mail, Lock, User as UserIcon, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";

export function AuthModal() {
  const { showLoginModal, setShowLoginModal, signInWithEmail, signUp } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  if (!showLoginModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = mode === "login"
      ? await signInWithEmail(email, password)
      : await signUp(email, password, name);

    if (result) {
      setError(result);
      setLoading(false);
      return;
    }

    window.location.assign("/");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (err) setError(err.message);
    else setForgotSent(true);
  };

  const close = () => {
    setShowLoginModal(false);
    setError(null);
    setEmail("");
    setPassword("");
    setName("");
    setMode("login");
    setForgotSent(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-surface rounded-2xl w-full max-w-md shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={close}
          className="absolute top-4 right-4 z-20 text-white/50 hover:text-white transition bg-black/20 rounded-full p-1"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="hero-gradient p-7 text-white overflow-hidden rounded-t-2xl relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-surface/5 rounded-full -mt-16 -mr-16 blur-2xl" />
          <p className="text-2xl mb-1"></p>
          <h2 id="auth-modal-title" className="text-xl font-bold relative z-10">{t.authWelcome}</h2>
          <p className="text-white/60 text-sm mt-1 relative z-10">
            {mode === "forgot"
              ? "Enter your email and we'll send a reset link"
              : mode === "login" ? t.authLoginSubtitle : t.authRegisterSubtitle}
          </p>
        </div>

        {/* Tabs — hidden in forgot mode */}
        {mode !== "forgot" && (
          <div className="flex">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m as "login" | "register"); setError(null); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition border-b-2 ${
                  mode === m ? "text-primary border-primary" : "text-text-muted border-transparent hover:text-text-secondary"
                }`}
              >
                {m === "login" ? t.authLogin : t.authRegister}
              </button>
            ))}
          </div>
        )}

        {/* Forgot password */}
        {mode === "forgot" && (
          <div className="p-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setForgotSent(false); }}
              className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition mb-4"
            >
              <ArrowLeft size={14} /> Back to login
            </button>
            {forgotSent ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 size={42} className="text-emerald-500" />
                <p className="font-semibold text-text">Check your email</p>
                <p className="text-sm text-text-muted">A reset link was sent to <span className="font-medium text-text">{email}</span></p>
                <button onClick={close} className="mt-2 w-full py-3 btn-primary text-sm">Close</button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>}
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-3.5 text-text-muted" />
                  <input type="email" placeholder={t.authEmail} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                    className="w-full pl-11 pr-4 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition bg-background" />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3.5 btn-primary text-sm">
                  {loading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Login / Register form */}
        {mode !== "forgot" && (
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>
          )}

          {mode === "register" && (
            <div className="relative">
              <UserIcon size={16} className="absolute left-3.5 top-3.5 text-text-muted" />
              <input type="text" placeholder={t.authFullName} value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full pl-11 pr-4 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition bg-background" />
            </div>
          )}

          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-3.5 text-text-muted" />
            <input
              type="email"
              pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
              placeholder={t.authEmail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition bg-background"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-3.5 text-text-muted" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder={t.authPassword}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full pl-11 pr-11 py-3 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition bg-background"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-3 text-text-muted hover:text-text-secondary transition"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === "login" && (
            <div className="text-right -mt-1">
              <button type="button" onClick={() => { setMode("forgot"); setError(null); }}
                className="text-xs text-primary hover:underline">
                Forgot password?
              </button>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full py-3.5 btn-primary text-sm">
            {loading
              ? (mode === "login" ? t.authSigningIn : t.authCreating)
              : (mode === "login" ? t.authSubmitLogin : t.authSubmitRegister)}
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
