"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, X, LogOut, Shield, Sun, Moon, Check, KeyRound, Radio, ChevronDown, UserRound, Building2, CalendarDays } from 'lucide-react';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from 'next-themes';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/providers/LanguageContext";

type Notification = {
  id: string;
  message: string;
  created_at: string;
  notifType?: "broadcast" | "booking";
  is_read?: boolean;
};

function timeAgo(dateStr: string, t: any): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minAgo(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t.hrsAgo(hrs);
  const days = Math.floor(hrs / 24);
  return days === 1 ? t.yesterday : t.daysAgo(days);
}

export function Navbar() {
  const pathname = usePathname();
  const { user, isAnonymous, isAdmin, isLoading, displayName, avatarUrl, setShowLoginModal, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const settings = useSystemSettings();

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications from DB (broadcasts + personal DB notifications)
  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch broadcasts — isolated try/catch so they always work
    let broadcasts: { id: string; message: string; created_at: string }[] = [];
    try {
      const { data } = await supabase
        .from('system_broadcasts')
        .select('id, message, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20);
      broadcasts = data ?? [];
    } catch { /* fail silently */ }

    // Fetch personal DB notifications — isolated try/catch so broadcast still shows
    let dbUnread = 0;
    let personalNotifs: Notification[] = [];
    if (user && !isAnonymous) {
      try {
        const { data: dbNotifs, error } = await supabase
          .from('notifications')
          .select('id, type, payload, is_read, created_at')
          .eq('user_id', user.id)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20);
        if (!error && dbNotifs) {
          personalNotifs = dbNotifs.map((n) => ({
            id: n.id,
            message:
              n.type === 'booking_approved'
                ? t.notifBookingApproved((n.payload as Record<string, string>).facility_name ?? '')
                : n.type === 'booking_cancelled'
                ? t.notifBookingCancelled((n.payload as Record<string, string>).facility_name ?? '')
                : t.notifBookingRejected((n.payload as Record<string, string>).facility_name ?? ''),
            created_at: n.created_at,
            notifType: 'booking' as const,
            is_read: n.is_read,
          }));
          dbUnread = dbNotifs.filter((n) => !n.is_read).length;
        }
      } catch { /* fail silently — table may not exist yet */ }
    }

    // Merge + sort by newest-first
    const broadcastNotifs: Notification[] = broadcasts.map((b) => ({
      id: b.id,
      message: b.message,
      created_at: b.created_at,
      notifType: 'broadcast' as const,
    }));
    const merged = [...personalNotifs, ...broadcastNotifs]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 30);

    setNotifications(merged);
    const lastSeen = localStorage.getItem('lastSeenBroadcast') ?? '1970-01-01';
    const broadcastUnread = broadcasts.filter((n) => n.created_at > lastSeen).length;
    setUnreadCount(broadcastUnread + dbUnread);
  }, [t, user, isAnonymous]);

  // Mark all as read when dropdown opens (localStorage + DB)
  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    localStorage.setItem('lastSeenBroadcast', new Date().toISOString());
    setUnreadCount(0);
    // Mark personal DB notifications as read
    if (user && !isAnonymous) {
      try {
        const supabase = createClient();
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
      } catch { /* silent */ }
    }
  }, [unreadCount, user, isAnonymous]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    setMounted(true);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Effect 1: Initial fetch + broadcast subscription
  // Depends only on fetchNotifications — stable after auth resolves
  useEffect(() => {
    fetchNotifications();

    const supabase = createClient();

    // For INSERT: prepend directly to avoid a round-trip query.
    // For UPDATE/DELETE: re-fetch since dedup/ordering must be recomputed.
    const channel = supabase
      .channel("navbar-broadcasts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "system_broadcasts" },
        (payload) => {
          const raw = payload.new as { id: string; message: string; created_at: string };
          const notif: Notification = {
            id: raw.id,
            message: raw.message,
            created_at: raw.created_at,
            notifType: "broadcast",
          };
          setNotifications((prev) => [notif, ...prev].slice(0, 30));
          const lastSeen = localStorage.getItem("lastSeenBroadcast") ?? "1970-01-01";
          if (raw.created_at > lastSeen) {
            setUnreadCount((c) => c + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "system_broadcasts" },
        fetchNotifications
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "system_broadcasts" },
        fetchNotifications
      )
      .subscribe();

    // Listen for same-tab admin broadcast events (instant, no WebSocket needed)
    const onBroadcastSent = () => fetchNotifications();
    window.addEventListener("makmur:broadcast-sent", onBroadcastSent);

    // 30-second poll as a safety net in case the WebSocket misses an event
    const poll = setInterval(fetchNotifications, 30_000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("makmur:broadcast-sent", onBroadcastSent);
      clearInterval(poll);
    };
  }, [fetchNotifications]);

  // Effect 2: Personal notification subscription — keyed on user.id only so it
  // doesn't tear down/rebuild every render cycle when auth state settles.
  useEffect(() => {
    if (!user?.id || isAnonymous) return;
    const supabase = createClient();
    const userId = user.id;

    const bookingChannel = supabase
      .channel(`navbar-personal-notifs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as {
            id: string;
            type: string;
            payload: Record<string, string>;
            is_read: boolean;
            created_at: string;
          };
          const msg =
            n.type === "booking_approved"
              ? t.notifBookingApproved(n.payload.facility_name ?? "")
              : n.type === "booking_cancelled"
              ? t.notifBookingCancelled(n.payload.facility_name ?? "")
              : t.notifBookingRejected(n.payload.facility_name ?? "");
          const notif: Notification = {
            id: n.id,
            message: msg,
            created_at: n.created_at,
            notifType: "booking",
            is_read: false,
          };
          setNotifications((prev) => [notif, ...prev].slice(0, 30));
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(bookingChannel); };
  }, [user?.id, isAnonymous, t]);

  // When notification dropdown opens, mark all as read
  useEffect(() => {
    if (notifOpen && unreadCount > 0) {
      markAllRead();
    }
  }, [notifOpen, unreadCount, markAllRead]);

  const primaryLinks = [
    ...(isAdmin ? [{ href: '/dashboard', label: t.navDashboard }] : []),
    { href: '/gigs', label: t.navVolunteer },
    { href: '/crowdfunding', label: t.navCrowdfunding },
    { href: '/e-kupon', label: t.navEKupon },
  ];

  const moreLinks = [
    { href: '/zakat',            label: t.navZakat },
    { href: '/lost-found',       label: t.navLostFound },
    { href: '/facility-booking', label: t.navFacilityBooking },
    { href: '/mosque-programs',  label: t.navMosquePrograms },
    { href: '/waktu-solat',      label: t.navWaktuSolat },
  ];

  // Combined for mobile hamburger
  const links = [...primaryLinks, ...moreLinks];

  const handleSignOut = async () => {
    setProfileOpen(false);
    setMobileOpen(false);
    await signOut();
  };

  return (
    <>
    <header className="bg-surface/80 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 transition-colors duration-300 w-full overflow-hidden">
      <div className="container mx-auto px-2 min-[400px]:px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 min-[400px]:gap-3 group shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm border border-border/40 bg-transparent flex items-center justify-center">
            <img src="/navbar_logo.png" alt="logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base min-[400px]:text-lg text-text block leading-tight hidden min-[360px]:block">{settings.system_name}</span>
            <span className="text-[10px] text-text-muted font-medium -mt-0.5 hidden sm:block">{settings.system_desc}</span>
          </div>
        </Link>

        <nav className="hidden lg:flex gap-1 items-center">
          {isLoading ? (
            <div className="w-16 h-8 bg-gray-100 animate-pulse rounded-lg" />
          ) : isAdmin && (
            <Link href="/admin"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${pathname.startsWith('/admin')
                ? 'bg-primary-50 text-primary font-semibold'
                : 'text-gold hover:text-gold-dark hover:bg-gold-light/20'
                }`}
            >
              <Shield size={14} /> {t.admin}
            </Link>
          )}
          {primaryLinks.map((link) => (
            <Link key={link.href} href={link.href}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${pathname.startsWith(link.href)
                ? 'bg-primary-50 text-primary font-semibold'
                : 'text-text-secondary hover:text-primary hover:bg-surface-alt'
                }`}
            >
              {link.label}
            </Link>
          ))}
          {/* More dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                moreLinks.some(l => pathname.startsWith(l.href)) || moreOpen
                  ? 'bg-primary-50 text-primary font-semibold'
                  : 'text-text-secondary hover:text-primary hover:bg-surface-alt'
              }`}
            >
              {t.navMore}
              <ChevronDown size={13} className={`transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-52 bg-surface rounded-xl border border-border/60 shadow-xl py-1.5 z-50">
                {moreLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                      pathname.startsWith(link.href)
                        ? 'text-primary bg-primary-50 font-semibold'
                        : 'text-text-secondary hover:text-primary hover:bg-surface-alt'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-1.5 min-[400px]:gap-2">
          {/* Theme Toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-9 h-9 rounded-xl hover:bg-surface-muted flex items-center justify-center text-text-secondary transition-all relative overflow-hidden group"
              aria-label="Toggle Dark Mode"
            >
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out ${theme === 'dark' ? 'rotate-90 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100 group-hover:text-gold-dark'}`}>
                <Sun size={18} />
              </div>
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out ${theme === 'dark' ? 'rotate-0 opacity-100 scale-100 group-hover:text-blue-400' : '-rotate-90 opacity-0 scale-50'}`}>
                <Moon size={18} />
              </div>
            </button>
          )}

          {/* Language Toggle */}
          {mounted && (
            <button
              onClick={() => setLanguage(language === 'en' ? 'ms' : 'en')}
              className="h-9 px-1.5 min-[400px]:px-2.5 rounded-xl hover:bg-surface-muted flex items-center justify-center text-text-secondary transition-all gap-0.5 min-[400px]:gap-1 font-bold text-[10px] min-[400px]:text-xs"
              aria-label="Toggle Language"
            >
              <span className={`transition-all ${language === 'en' ? 'text-primary' : 'opacity-40'}`}>EN</span>
              <span className="opacity-20 text-[8px]">|</span>
              <span className={`transition-all ${language === 'ms' ? 'text-primary' : 'opacity-40'}`}>BM</span>
            </button>
          )}

          {/* Notification bell with dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="w-9 h-9 rounded-xl hover:bg-surface-muted flex items-center justify-center text-text-secondary transition relative"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-96 bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden z-50">
                {/* Gradient header */}
                <div className="hero-gradient px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-white/15 border border-white/20 rounded-lg flex items-center justify-center shrink-0">
                      <Bell size={13} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white leading-none">{t.notifications}</h3>
                      <p className="text-[10px] text-white/60 mt-0.5 leading-none">{t.notifLast7Days}</p>
                    </div>
                  </div>
                  {notifications.length > 0 && (
                    unreadCount > 0 ? (
                      <span className="shrink-0 text-[10px] font-bold bg-red-500/30 text-white border border-red-400/30 px-2.5 py-1 rounded-full">
                        {t.notifUnread(unreadCount)}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-bold bg-white/15 text-white/90 border border-white/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Check size={9} /> {t.allRead}
                      </span>
                    )
                  )}
                </div>

                {/* Notification list */}
                <div className="max-h-80 overflow-y-auto overscroll-contain">
                  {notifications.length > 0 ? (
                    <div className="divide-y divide-border/50">
                      {notifications.map((n) => (
                        <div key={n.id} className={`flex gap-3 px-4 py-3.5 hover:bg-surface-muted/50 transition-colors relative ${n.is_read === false ? 'bg-primary-50/40 dark:bg-primary/5' : ''}`}>
                          {n.is_read === false && (
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                          <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 flex items-center justify-center">
                            {n.notifType === "booking"
                              ? <Building2 size={12} className="text-primary" />
                              : <Radio size={12} className="text-primary" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">
                              {n.notifType === "booking" ? t.notifTypeBooking : t.notifTypeBroadcast}
                            </p>
                            <p className="text-sm text-text leading-snug break-words">{n.message}</p>
                            <p className="text-[11px] text-text-muted mt-1 font-medium">{timeAgo(n.created_at, t)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-12 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-surface-muted border border-border flex items-center justify-center mx-auto mb-3">
                        <Bell size={24} className="text-text-muted/40" />
                      </div>
                      <p className="text-sm font-semibold text-text-muted">{t.noNotifications}</p>
                      <p className="text-xs text-text-muted/60 mt-1">{t.notifBroadcastHint}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="hidden md:block w-20 h-9 bg-gray-100 animate-pulse rounded-xl ml-1" />
          ) : isAnonymous ? (
            <button 
              onClick={() => setShowLoginModal(true)} 
              className="px-2.5 py-1.5 md:px-4 md:py-2 btn-primary text-[10px] md:text-sm whitespace-nowrap shrink-0"
            >
              {t.signIn}
            </button>
          ) : (
            /* ═══ Profile avatar + dropdown with Logout ═══ */
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="hidden md:flex items-center gap-2 ml-1"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="w-9 h-9 rounded-xl object-cover shadow-sm cursor-pointer hover:opacity-90 transition border border-border/30"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-xl hero-gradient flex items-center justify-center text-white text-xs font-bold shadow-sm cursor-pointer hover:opacity-90 transition">
                    {user?.email?.[0]?.toUpperCase() ?? '👤'}
                  </div>
                )}
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 w-56 bg-surface rounded-xl shadow-2xl border border-border overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-surface-muted flex items-center gap-3">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="avatar" className="w-9 h-9 rounded-xl object-cover shrink-0 border border-border/30" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl hero-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {user?.email?.[0]?.toUpperCase() ?? '👤'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text truncate">
                        {displayName || user?.user_metadata?.full_name || user?.email || 'User'}
                      </p>
                      <p className="text-xs text-text-muted truncate">{user?.email}</p>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setProfileOpen(false)}
                    className="w-full px-4 py-3 text-left text-sm text-text-secondary hover:bg-surface-muted flex items-center gap-2 transition"
                  >
                    <UserRound size={15} /> {t.navMyProfile}
                  </Link>
                  <Link
                    href="/my-bookings"
                    onClick={() => setProfileOpen(false)}
                    className="w-full px-4 py-3 text-left text-sm text-text-secondary hover:bg-surface-muted flex items-center gap-2 transition"
                  >
                    <CalendarDays size={15} /> {t.navMyBookings}
                  </Link>
                  <button
                    onClick={() => { setShowChangePassword(true); setProfileOpen(false); }}
                    className="w-full px-4 py-3 text-left text-sm text-text-secondary hover:bg-surface-muted flex items-center gap-2 transition"
                  >
                    <KeyRound size={15} /> {t.navResetPassword}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-left text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 transition"
                  >
                    <LogOut size={15} /> {t.signOut}
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="lg:hidden w-9 h-9 rounded-xl hover:bg-surface-muted flex items-center justify-center text-text-secondary" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-surface border-t border-border px-4 pb-4 pt-2 space-y-1 shadow-lg">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              className={`block px-4 py-3 rounded-xl text-sm font-medium transition ${pathname.startsWith(link.href) ? 'bg-primary-50 text-primary font-semibold' : 'text-text-secondary hover:bg-surface-alt'
                }`}
            >{link.label}</Link>
          ))}
          {isLoading ? (
            <div className="w-full h-11 bg-gray-100 animate-pulse rounded-xl mt-2" />
          ) : isAnonymous ? (
            <button onClick={() => { setShowLoginModal(true); setMobileOpen(false); }} className="w-full px-4 py-3 btn-primary text-sm mt-2">{t.signIn}</button>
          ) : (
            <>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-medium transition text-gold hover:bg-gold-light/20 flex items-center gap-2 mt-1"
                >
                  <Shield size={15} /> {t.adminPanel}
                </Link>
              )}
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="block w-full px-4 py-3 text-sm text-text-secondary hover:bg-surface-muted rounded-xl flex items-center gap-2 mt-1 border border-border">
                <UserRound size={15} /> {t.navMyProfile}
              </Link>
              <Link href="/my-bookings" onClick={() => setMobileOpen(false)} className="block w-full px-4 py-3 text-sm text-text-secondary hover:bg-surface-muted rounded-xl flex items-center gap-2 mt-1 border border-border">
                <CalendarDays size={15} /> {t.navMyBookings}
              </Link>
              <button onClick={() => { setShowChangePassword(true); setMobileOpen(false); }} className="w-full px-4 py-3 text-sm text-text-secondary hover:bg-surface-muted rounded-xl flex items-center gap-2 mt-1 border border-border">
                <KeyRound size={15} /> {t.navResetPassword}
              </button>
              <button onClick={handleSignOut} className="w-full px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl flex items-center gap-2 mt-1 border border-red-200 dark:border-red-900/60">
                <LogOut size={15} /> {t.signOut}
              </button>
            </>
          )}
        </div>
      )}
    </header>

    {showChangePassword && (
      <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
    )}
  </>
  );
}
