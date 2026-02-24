"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, HandHeart, QrCode, MapPin } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageContext';

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const links = [
    { href: '/', label: t.bnHome, icon: Home },
    { href: '/gigs', label: t.bnGigs, icon: Users },
    { href: '/crowdfunding', label: t.bnFund, icon: HandHeart },
    { href: '/e-kupon', label: t.bnKupon, icon: QrCode },
    { href: '/zakat', label: t.bnZakat, icon: MapPin },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 w-full bg-surface/85 backdrop-blur-xl border-t border-border/60 z-50 safe-area-bottom pb-env-bottom">
      <div className="flex justify-around items-center h-[60px] px-1">
        {links.map((link) => {
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
      </div>
    </nav>
  );
}
