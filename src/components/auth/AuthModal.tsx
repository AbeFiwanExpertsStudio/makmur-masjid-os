"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { useState } from "react";
import { X, Mail, Lock, User as UserIcon } from "lucide-react";

export function AuthModal() {
  const { showLoginModal, setShowLoginModal, signInWithEmail, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!showLoginModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = mode === "login"
      ? await signInWithEmail(email, password)
      : await signUp(email, password, name);
    if (result) setError(result);
    setLoading(false);
  };

  const close = () => {
    setShowLoginModal(false);
    setError(null);
    setEmail("");
    setPassword("");
    setName("");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={close}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="hero-gradient p-7 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mt-16 -mr-16 blur-2xl" />
          <button onClick={close} className="absolute top-4 right-4 text-white/50 hover:text-white transition">
            <X size={20} />
          </button>
          <p className="text-2xl mb-1">🌙</p>
          <h2 className="text-xl font-bold relative z-10">Welcome to Makmur</h2>
          <p className="text-white/60 text-sm mt-1 relative z-10">
            {mode === "login"
              ? "Sign in to claim volunteer gigs and track contributions."
              : "Create an account to join the community."}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={`flex-1 py-3.5 text-sm font-semibold transition border-b-2 ${
                mode === m ? "text-[#1B6B4A] border-[#1B6B4A]" : "text-[#8FA39B] border-transparent hover:text-[#5A7068]"
              }`}
            >
              {m === "login" ? "Sign In" : "Register"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>
          )}

          {mode === "register" && (
            <div className="relative">
              <UserIcon size={16} className="absolute left-3.5 top-3.5 text-[#8FA39B]" />
              <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full pl-11 pr-4 py-3 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none transition bg-[#F8FAF9]" />
            </div>
          )}

          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-3.5 text-[#8FA39B]" />
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full pl-11 pr-4 py-3 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none transition bg-[#F8FAF9]" />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-3.5 text-[#8FA39B]" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full pl-11 pr-4 py-3 border border-[#E2E8E5] rounded-xl text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none transition bg-[#F8FAF9]" />
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 btn-primary text-sm">
            {loading ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
