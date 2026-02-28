"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useRef, useState } from "react";
import {
  User, Phone, Mail, Camera, Loader2, Save, ShieldCheck,
  CalendarDays, KeyRound, LogOut, XCircle, Bell, Smartphone, Star
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import ChangePasswordModal from "@/components/auth/ChangePasswordModal";
import IOSPushModal from "@/components/modals/iOSPushModal";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/* ─────────────────────────────────────────────────────────────── */

function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", {
    day: "numeric", month: "long", year: "numeric",
  });
}

/* ─────────────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const { user, isAnonymous, isAdmin, points, signOut, setShowLoginModal, refreshProfile } = useAuth();
  const { t, language } = useLanguage();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showiOSModal, setShowiOSModal] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
  const { subscribeToNotifications, unsubscribeFromNotifications, isSubscribing } = usePushNotifications();

  const avatarRef = useRef<HTMLInputElement>(null);

  /* ── Redirect guests ── */
  useEffect(() => {
    if (!isAnonymous) return;
    setShowLoginModal(true);
    router.push("/");
  }, [isAnonymous, router, setShowLoginModal]);

  /* ── Load profile ── */
  useEffect(() => {
    if (!user || isAnonymous) return;

    const fetchProfile = async () => {
      setLoadingProfile(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone, avatar_url, fcm_tokens")
        .eq("id", user.id)
        .single();

      if (data) {
        setDisplayName(data.display_name ?? "");
        setPhone(data.phone ?? "");
        setAvatarUrl(data.avatar_url ?? null);
        setAvatarPreview(data.avatar_url ?? null);
        
        // Initial subscription check (very basic)
        if (data.fcm_tokens && data.fcm_tokens.length > 0) {
          setIsNotificationsEnabled(true);
        }
      }
      setLoadingProfile(false);
    };

    fetchProfile();
  }, [user, isAnonymous]);

  /* ── Avatar file select ── */
  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t.profileImgTooBig);
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const clearAvatarChange = () => {
    setAvatarFile(null);
    setAvatarPreview(avatarUrl); // revert to saved
  };

  /* ── Save profile ── */
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();

    let newAvatarUrl = avatarUrl;

    // Upload new avatar if selected
    if (avatarFile) {
      setUploading(true);
      const ext = avatarFile.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });
      setUploading(false);
      if (uploadErr) {
        toast.error(uploadErr.message);
        setSaving(false);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(uploadData.path);
      newAvatarUrl = publicUrl;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: displayName.trim() || null,
      phone: phone.trim() || null,
      avatar_url: newAvatarUrl,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      toast.error(error.message);
    } else {
      setAvatarUrl(newAvatarUrl);
      setAvatarFile(null);
      await refreshProfile(); // push new avatar/name to Navbar instantly
      toast.success(t.profileSaved);
    }
    setSaving(false);
  };

  const handleToggleNotifications = async () => {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

    if (isIOS && !isStandalone) {
      setShowiOSModal(true);
      return;
    }

    if (isNotificationsEnabled) {
      await unsubscribeFromNotifications();
      setIsNotificationsEnabled(false);
    } else {
      const success = await subscribeToNotifications();
      if (success) setIsNotificationsEnabled(true);
    }
  };

  /* ── Sign out ── */
  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  /* ── Loading / redirect ── */
  if (isAnonymous) return null;

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-text-muted">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">{t.loading}</span>
      </div>
    );
  }

  const initials = (displayName || user?.email || "U")[0].toUpperCase();
  const isBusy = saving || uploading;

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-8">
        <div className="text-primary"><User size={28} strokeWidth={2.5} /></div>
        <div>
          <h1 className="text-2xl font-bold text-text">
            {t.profileTitle}
          </h1>
          <p className="text-sm text-text-muted">
            {t.profileSubtitle}
          </p>
        </div>
      </div>

      {/* ── Avatar card ── */}
      <div className="card p-6 mb-5 flex flex-col items-center gap-4">
        <div className="relative">
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="avatar"
              className="w-24 h-24 rounded-2xl object-cover border-2 border-border/50 shadow"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl hero-gradient flex items-center justify-center text-white text-3xl font-bold shadow">
              {initials}
            </div>
          )}
          <button
            onClick={() => avatarRef.current?.click()}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary-dark transition"
            title={t.profileChangePhoto}
          >
            <Camera size={14} />
          </button>
        </div>

        {/* Changed indicator */}
        {avatarFile && (
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <span>{t.profilePhotoSelected}</span>
            <button onClick={clearAvatarChange} className="text-text-muted hover:text-red-500 transition">
              <XCircle size={14} />
            </button>
          </div>
        )}

        {isAdmin && (
          <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">
            <ShieldCheck size={12} /> {t.profileAdminBadge}
          </span>
        )}

        <input
          ref={avatarRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarSelect}
        />

        {/* ── Points display ── */}
        <div className="flex flex-col items-center pt-2">
          <div className="flex items-center gap-2 text-2xl font-bold text-text">
            <Star size={20} className="text-gold fill-gold" />
            {points.toLocaleString()}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">
            {t.profilePoints}
          </p>
        </div>
      </div>

      {/* ── Info card ── */}
      <div className="card p-6 mb-5 space-y-5">

        {/* Email — read-only */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            <Mail size={11} /> {t.profileEmailReadOnly}
          </label>
          <div className="px-4 py-2.5 rounded-xl bg-surface-alt border border-border/40 text-sm text-text-muted select-all">
            {user?.email}
          </div>
        </div>

        {/* Display name */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            <User size={11} /> {t.profileDisplayName}
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t.profileNamePlaceholder}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            <Phone size={11} /> {t.profilePhone}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="012-345 6789"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Member since */}
        {user?.created_at && (
          <div className="flex items-center gap-2 text-xs text-text-muted pt-1 border-t border-border/40">
            <CalendarDays size={12} />
            <span>
              {t.profileMemberSince}{" "}
              {formatDate(user.created_at, language)}
            </span>
          </div>
        )}
      </div>

      {/* ── Notifications Card ── */}
      <div className="card p-6 mb-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text leading-tight">
                {t.profileNotifications}
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                {t.profileNotificationsDesc}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleNotifications}
            disabled={isSubscribing}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              isSubscribing 
                ? 'bg-surface-alt text-text-muted cursor-not-allowed'
                : isNotificationsEnabled
                  ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            {isSubscribing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isNotificationsEnabled ? (
              <Bell size={14} className="opacity-70" />
            ) : (
              <Smartphone size={14} />
            )}
            {isSubscribing 
              ? t.profileSaving 
              : isNotificationsEnabled 
                ? (language === 'ms' ? 'Matikan' : 'Disable') 
                : (language === 'ms' ? 'Aktifkan' : 'Enable')}
          </button>
        </div>
      </div>

      {/* ── Save button ── */}
      <button
        onClick={handleSave}
        disabled={isBusy}
        className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
      >
        {uploading ? (
          <><Loader2 size={16} className="animate-spin" /> {t.profileUploading}</>
        ) : saving ? (
          <><Loader2 size={16} className="animate-spin" /> {t.saving}</>
        ) : (
          <><Save size={16} /> {t.profileSave}</>
        )}
      </button>

      {/* ── Account actions ── */}
      <div className="card p-4 space-y-2 mt-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          {t.profileAccount}
        </p>
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-alt flex items-center gap-2.5 transition"
        >
          <KeyRound size={15} className="text-primary" />
          {t.navResetPassword}
        </button>
        <button
          onClick={handleSignOut}
          className="w-full px-4 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition"
        >
          <LogOut size={15} />
          {t.signOut}
        </button>
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {showiOSModal && (
        <IOSPushModal onClose={() => setShowiOSModal(false)} />
      )}
    </div>
  );
}
