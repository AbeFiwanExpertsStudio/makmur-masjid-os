"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, HandHeart, QrCode, MapPin, MoreHorizontal, PackageSearch, Building2, Clock, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageContext';
import { useState } from 'react';

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryLinks = [
    { href: '/', label: t.bnHome, icon: Home },
    { href: '/gigs', label: t.bnGigs, icon: Users },
    { href: '/crowdfunding', label: t.bnFund, icon: HandHeart },
    { href: '/e-kupon', label: t.bnKupon, icon: QrCode },
  ];

  const moreItems = [
    { href: '/zakat', label: t.bnZakat, icon: MapPin },
    { href: '/lost-found', label: t.navLostFound, icon: PackageSearch },
    { href: '/facility-booking', label: t.navFacilityBooking, icon: Building2 },
    { href: '/mosque-programs', label: t.navMosquePrograms, icon: CalendarDays },
    { href: '/waktu-solat', label: t.navWaktuSolat, icon: Clock },
  ];

  const moreActive = moreItems.some(l => pathname.startsWith(l.href));

  return (
    <>
      {/* More sheet */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="lg:hidden fixed bottom-[60px] inset-x-0 z-40 bg-surface border-t border-border/60 shadow-2xl rounded-t-2xl px-4 pt-3 pb-4">
            <div className="w-8 h-1 bg-border rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary dark:bg-primary/15 dark:text-primary-light'
                        : 'bg-surface-alt text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}

      <nav className="lg:hidden fixed bottom-0 w-full bg-surface/85 backdrop-blur-xl border-t border-border/60 z-50 safe-area-bottom pb-env-bottom">
        <div className="flex justify-around items-center h-[60px] px-1">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors ${
                  isActive ? "text-primary dark:text-primary-light" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary dark:bg-primary-light rounded-b-full" />
                )}
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? "bg-primary-50 dark:bg-primary/15 scale-105" : ""}`}>
                  <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>{link.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`relative flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors ${
              moreActive || moreOpen ? "text-primary dark:text-primary-light" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {(moreActive || moreOpen) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary dark:bg-primary-light rounded-b-full" />
            )}
            <div className={`p-1.5 rounded-xl transition-all ${moreActive || moreOpen ? "bg-primary-50 dark:bg-primary/15 scale-105" : ""}`}>
              <MoreHorizontal size={19} strokeWidth={moreActive || moreOpen ? 2.5 : 1.8} />
            </div>
            <span className={`text-[10px] leading-none ${moreActive || moreOpen ? "font-bold" : "font-medium"}`}>{t.bnMore}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

