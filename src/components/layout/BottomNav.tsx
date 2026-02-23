"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, HandHeart, QrCode, MapPin } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  // Mobile navigation is visible globally

  const links = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/gigs', label: 'Gigs', icon: Users },
    { href: '/crowdfunding', label: 'Fund', icon: HandHeart },
    { href: '/e-kupon', label: 'Kupon', icon: QrCode },
    { href: '/zakat', label: 'Zakat', icon: MapPin },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 w-full glass border-t border-border z-50 safe-area-bottom pb-env-bottom">
      <div className="flex justify-around items-center h-[60px] px-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname.startsWith(link.href);
          return (
            <Link 
              key={link.href} 
              href={link.href}
              className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-colors ${
                isActive ? "text-primary dark:text-primary-light" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${isActive ? "bg-primary-50 dark:bg-primary-100/20" : ""}`}>
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
