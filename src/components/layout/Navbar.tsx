"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, X, LogOut, Shield, Sun, Moon, Check, KeyRound, Radio } from 'lucide-react';
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
  const { user, isAnonymous, isAdmin, isLoading, setShowLoginModal, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const settings = useSystemSettings();

  // Notification state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications from DB
  const fetchNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('system_broadcasts')
        .select('id, message, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (!error && data) {
        setNotifications(data);
        // Count broadcasts newer than last-seen timestamp as unread
        const lastSeen = localStorage.getItem('lastSeenBroadcast') ?? '1970-01-01';
        setUnreadCount(data.filter(n => n.created_at > lastSeen).length);
      }
    } catch {
      // Fail silently
    }
  }, []);

  // Mark all as read when dropdown opens
  const markAllRead = useCallback(() => {
    if (unreadCount === 0) return;
    localStorage.setItem('lastSeenBroadcast', new Date().toISOString());
    setUnreadCount(0);
  }, [unreadCount]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    setMounted(true);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch on mount + subscribe to Realtime changes
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
          const n = payload.new as Notification;
          setNotifications((prev) => [n, ...prev].slice(0, 20));
          const lastSeen = localStorage.getItem("lastSeenBroadcast") ?? "1970-01-01";
          if (n.created_at > lastSeen) {
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

  // When notification dropdown opens, mark all as read
  useEffect(() => {
    if (notifOpen && unreadCount > 0) {
      markAllRead();
    }
  }, [notifOpen, unreadCount, markAllRead]);

  const links = [
    ...(isAdmin ? [{ href: '/dashboard', label: t.navDashboard }] : []),
    { href: '/gigs', label: t.navVolunteer },
    { href: '/crowdfunding', label: t.navCrowdfunding },
    { href: '/e-kupon', label: t.navEKupon },
    { href: '/zakat', label: t.navZakat },
    { href: '/waktu-solat', label: t.navWaktuSolat },
  ];

  const handleSignOut = async () => {
    setProfileOpen(false);
    setMobileOpen(false);
    await signOut();
  };

  return (
    <>
    <header className="bg-surface/80 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50 transition-colors duration-300">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 hero-gradient rounded-xl flex items-center justify-center text-white text-lg shadow-sm">🌙</div>
          <div>
            <span className="font-bold text-lg text-text block leading-tight">{settings.system_name}</span>
            <span className="text-[10px] text-text-muted font-medium -mt-0.5 block">{settings.system_desc}</span>
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
          {links.map((link) => (
            <Link key={link.href} href={link.href}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${pathname.startsWith(link.href)
                ? 'bg-primary-50 text-primary font-semibold'
                : 'text-text-secondary hover:text-primary hover:bg-surface-alt'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
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
              className="h-9 px-2.5 rounded-xl hover:bg-surface-muted flex items-center justify-center text-text-secondary transition-all gap-1 font-bold text-xs"
              aria-label="Toggle Language"
            >
              <span className={`transition-all ${language === 'en' ? 'text-primary font-extrabold' : 'opacity-50'}`}>EN</span>
              <span className="opacity-30">|</span>
              <span className={`transition-all ${language === 'ms' ? 'text-primary font-extrabold' : 'opacity-50'}`}>BM</span>
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
                      <p className="text-[10px] text-white/60 mt-0.5 leading-none">Last 24 hours</p>
                    </div>
                  </div>
                  {notifications.length > 0 && (
                    <span className="shrink-0 text-[10px] font-bold bg-white/15 text-white/90 border border-white/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check size={9} /> {t.allRead}
                    </span>
                  )}
                </div>

                {/* Notification list */}
                <div className="max-h-80 overflow-y-auto overscroll-contain">
                  {notifications.length > 0 ? (
                    <div className="divide-y divide-border/50">
                      {notifications.map((n) => (
                        <div key={n.id} className="flex gap-3 px-4 py-3.5 hover:bg-surface-muted/50 transition-colors">
                          <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 flex items-center justify-center">
                            <Radio size={12} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
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
                      <p className="text-xs text-text-muted/60 mt-1">Broadcasts from admins will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="hidden md:block w-20 h-9 bg-gray-100 animate-pulse rounded-xl ml-1" />
          ) : isAnonymous ? (
            <button onClick={() => setShowLoginModal(true)} className="hidden md:block px-4 py-2 btn-primary text-sm">{t.signIn}</button>
          ) : (
            /* ═══ Profile avatar + dropdown with Logout ═══ */
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="hidden md:flex items-center gap-2 ml-1"
              >
                <div className="w-9 h-9 rounded-xl hero-gradient flex items-center justify-center text-white text-xs font-bold shadow-sm cursor-pointer hover:opacity-90 transition">
                  {user?.email?.[0]?.toUpperCase() ?? '👤'}
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 w-56 bg-surface rounded-xl shadow-2xl border border-border overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-surface-muted">
                    <p className="text-sm font-bold text-text truncate">
                      {user?.user_metadata?.full_name || user?.email || 'User'}
                    </p>
                    <p className="text-xs text-text-muted truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { setShowChangePassword(true); setProfileOpen(false); }}
                    className="w-full px-4 py-3 text-left text-sm text-text-secondary hover:bg-surface-muted flex items-center gap-2 transition"
                  >
                    <KeyRound size={15} /> Reset Password
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
              <button onClick={() => { setShowChangePassword(true); setMobileOpen(false); }} className="w-full px-4 py-3 text-sm text-text-secondary hover:bg-surface-muted rounded-xl flex items-center gap-2 mt-1 border border-border">
                <KeyRound size={15} /> Reset Password
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
