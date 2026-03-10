"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, HandHeart, QrCode, MapPin, MoreHorizontal, PackageSearch, Building2, Clock, CalendarDays, UserRound, LogOut, Sun, Moon, KeyRound } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageContext';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthContext';
import { useTheme } from 'next-themes';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';

export function BottomNav() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const { user, isAnonymous, avatarUrl, setShowLoginModal, signOut, displayName } = useAuth();
  const { theme, setTheme } = useTheme();

  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const primaryLinksLeft = [
    { href: '/', label: t.bnHome, icon: Home },
    { href: '/crowdfunding', label: t.bnFund, icon: HandHeart },
  ];

  const primaryLinksRight = [
    { href: '/gigs', label: t.bnGigs, icon: Users },
  ];

  const moreItems = [
    { href: '/e-kupon', label: t.bnKupon, icon: QrCode },
    { href: '/zakat', label: t.bnZakat, icon: MapPin },
    { href: '/lost-found', label: t.navLostFound, icon: PackageSearch },
    { href: '/facility-booking', label: t.navFacilityBooking, icon: Building2 },
    { href: '/mosque-programs', label: t.navMosquePrograms, icon: CalendarDays },
    { href: '/waktu-solat', label: t.navWaktuSolat, icon: Clock },
  ];

  const moreActive = moreItems.some(l => pathname.startsWith(l.href));
  const profileActive = pathname.startsWith('/profile') || pathname.startsWith('/my-bookings');

  // Helper to handle toggling menus securely
  const handleMoreClick = () => {
    setProfileOpen(false);
    setMoreOpen(!moreOpen);
  };

  const handleProfileClick = () => {
    setMoreOpen(false);
    if (!user || isAnonymous) {
      setShowLoginModal(true);
    } else {
      setProfileOpen(!profileOpen);
    }
  };

  const executeSignOut = async () => {
    setProfileOpen(false);
    await signOut();
  };

  return (
    <>
      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {/* Dimmed Backdrop for Both Sheetes */}
      {(moreOpen || profileOpen) && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => { setMoreOpen(false); setProfileOpen(false); }}
        />
      )}

      {/* ── More Sheet ────────────────────────── */}
      {moreOpen && (
        <div className="lg:hidden fixed bottom-[90px] inset-x-4 max-w-sm mx-auto z-40 bg-surface border-t border-border/60 shadow-2xl rounded-3xl p-5 fade-in-up">
          <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
          <div className="grid grid-cols-2 gap-3">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl text-sm font-medium transition-colors border ${isActive
                    ? 'bg-primary-50 border-primary/20 text-primary dark:bg-primary/10 dark:text-primary-light'
                    : 'bg-surface-alt border-border text-text-secondary hover:bg-surface-muted'
                    }`}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="text-[11px] leading-tight text-center">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Profile Sheet ────────────────────────── */}
      {profileOpen && user && !isAnonymous && (
        <div className="lg:hidden fixed bottom-[90px] inset-x-4 max-w-sm mx-auto z-40 bg-surface shadow-2xl rounded-3xl overflow-hidden fade-in-up ring-1 ring-border/50">
          <div className="w-10 h-1 bg-border rounded-full mx-auto mt-4 mb-2" />

          <div className="px-5 py-4 border-b border-surface-muted flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-border/30" />
            ) : (
              <div className="w-12 h-12 rounded-2xl hero-gradient flex items-center justify-center text-white text-lg font-bold shrink-0">
                {user.email?.[0]?.toUpperCase() ?? '👤'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-text truncate">
                {displayName || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-text-muted truncate">{user.email}</p>
            </div>
          </div>

          <div className="p-3">
            <Link
              href="/profile"
              onClick={() => setProfileOpen(false)}
              className="w-full p-3.5 mb-1 bg-background border border-border text-sm text-text-secondary hover:text-primary rounded-xl flex items-center gap-3 transition font-medium shadow-sm"
            >
              <UserRound size={18} className="text-primary/70" /> {t.navMyProfile}
            </Link>
            <Link
              href="/my-bookings"
              onClick={() => setProfileOpen(false)}
              className="w-full p-3.5 mb-3 bg-background border border-border text-sm text-text-secondary hover:text-primary rounded-xl flex items-center gap-3 transition font-medium shadow-sm"
            >
              <CalendarDays size={18} className="text-primary/70" /> {t.navMyBookings}
            </Link>

            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Theme Toggle */}
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-3 border border-border rounded-xl bg-surface hover:bg-surface-muted flex flex-col items-center justify-center gap-1.5 transition-colors"
                >
                  {theme === 'dark' ? <Moon size={18} className="text-blue-400" /> : <Sun size={18} className="text-amber-500" />}
                  <span className="text-[10px] font-semibold text-text-secondary">Toggle Theme</span>
                </button>
              )}
              {/* Language Toggle */}
              {mounted && (
                <button
                  onClick={() => setLanguage(language === 'en' ? 'ms' : 'en')}
                  className="p-3 border border-border rounded-xl bg-surface hover:bg-surface-muted flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  <span className="text-[16px] font-black tracking-widest text-primary leading-none uppercase">{language}</span>
                  <span className="text-[10px] font-semibold text-text-secondary">Language</span>
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowChangePassword(true); setProfileOpen(false); }}
                className="flex-1 p-3 text-sm text-text-secondary bg-surface border border-border hover:bg-surface-muted rounded-xl flex items-center justify-center gap-2 transition"
              >
                <KeyRound size={15} /> Reset
              </button>
              <button
                onClick={executeSignOut}
                className="flex-[1.5] p-3 text-sm text-white bg-red-500 font-semibold hover:bg-red-600 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-red-500/20"
              >
                <LogOut size={16} /> {t.signOut}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Nav Pill ────────────────────────── */}
      <nav className="lg:hidden fixed bottom-4 left-4 right-4 max-w-md mx-auto h-[60px] bg-surface/90 backdrop-blur-2xl border border-border/60 z-50 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] px-2 safe-area-bottom pb-env-bottom flex items-center justify-between">

        {/* Left Side Links */}
        <div className="flex flex-1 items-center justify-evenly h-full">
          {primaryLinksLeft.map((link) => {
            const Icon = link.icon;
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? "text-primary dark:text-primary-light" : "text-text-muted hover:text-text-secondary"
                  }`}
              >
                <div className={`p-1.5 rounded-full transition-all ${isActive ? "bg-primary-50 dark:bg-primary/10" : ""}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                {isActive && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </div>

        {/* Center Prominent MORE Button */}
        <div className="shrink-0 relative z-20 mx-1">
          <button
            onClick={handleMoreClick}
            className={`w-[50px] h-[50px] rounded-full flex items-center justify-center transition-all shadow-lg ${moreOpen || moreActive
              ? "bg-primary-dark shadow-primary/30 scale-95"
              : "bg-primary shadow-primary/40 hover:bg-primary-light hover:scale-105"
              }`}
          >
            <div className={`transition-transform duration-300 ${moreOpen ? "rotate-[135deg]" : ""}`}>
              {moreActive && !moreOpen ? (
                /* Dynamic icon mode if a 'more' subpage is active, otherwise '+' or dots */
                <MoreHorizontal size={24} className="text-white" strokeWidth={2.5} />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <path d="M5 12h14" /><path d="M12 5v14" />
                </svg>
              )}
            </div>
          </button>
        </div>

        {/* Right Side Links */}
        <div className="flex flex-1 items-center justify-evenly h-full">
          {primaryLinksRight.map((link) => {
            const Icon = link.icon;
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive ? "text-primary dark:text-primary-light" : "text-text-muted hover:text-text-secondary"
                  }`}
              >
                <div className={`p-1.5 rounded-full transition-all ${isActive ? "bg-primary-50 dark:bg-primary/10" : ""}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                {isActive && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
              </Link>
            );
          })}

          {/* Profile Trigger */}
          <button
            onClick={handleProfileClick}
            className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${profileActive || profileOpen ? "text-primary dark:text-primary-light" : "text-text-muted hover:text-text-secondary"
              }`}
          >
            <div className={`p-1 rounded-full transition-all ${profileActive || profileOpen ? "bg-primary-50 dark:bg-primary/10" : ""}`}>
              {(!user || isAnonymous) ? (
                <UserRound size={32} strokeWidth={profileActive || profileOpen ? 2.5 : 1.8} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Me" className={`w-[36px] h-[36px] rounded-full object-cover border-2 ${profileActive || profileOpen ? 'border-primary' : 'border-border/60'}`} />
              ) : (
                <div className="w-[36px] h-[36px] rounded-full hero-gradient text-white text-[15px] font-bold flex items-center justify-center uppercase">
                  {user.email?.[0] || 'U'}
                </div>
              )}
            </div>
            {(profileActive || profileOpen) && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
          </button>
        </div>

      </nav>
    </>
  );
}

