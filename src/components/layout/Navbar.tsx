"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, X, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthContext';
import { useState, useRef, useEffect } from 'react';

const mockNotifications = [
  { id: "1", text: "Tarawih tonight at 8:45 PM — led by Sheikh Al-Afasy", time: "5 min ago", read: false },
  { id: "2", text: "Bubur Lambuk ready for distribution at 5 PM", time: "1 hour ago", read: false },
  { id: "3", text: "New volunteer gig: Clean Up Kitchen needs 6 more people", time: "3 hours ago", read: true },
  { id: "4", text: "Crowdfunding target reached for Tabung Iftar Asnaf!", time: "Yesterday", read: true },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isAnonymous, isAdmin, isLoading, setShowLoginModal, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = mockNotifications.filter(n => !n.read).length;

  // Hide navbar on admin page
  if (pathname.startsWith('/admin')) return null;

  const links = [
    ...(isAdmin ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
    { href: '/gigs', label: 'Volunteer' },
    { href: '/crowdfunding', label: 'Crowdfunding' },
    { href: '/e-kupon', label: 'E-Kupon' },
    { href: '/zakat', label: 'Zakat Locator' },
  ];

  const handleSignOut = async () => {
    setProfileOpen(false);
    setMobileOpen(false);
    await signOut();
  };

  return (
    <header className="bg-white border-b border-[#E2E8E5] sticky top-0 z-50">
      <div className="h-1 hero-gradient" />

      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 hero-gradient rounded-xl flex items-center justify-center text-white text-lg shadow-sm">🌙</div>
          <div>
            <span className="font-bold text-lg text-[#1A2E2A] block leading-tight">Makmur</span>
            <span className="text-[10px] text-[#8FA39B] font-medium -mt-0.5 block">Mosque OS</span>
          </div>
        </Link>
        
        <nav className="hidden lg:flex gap-1 items-center">
          {isLoading ? (
             <div className="w-16 h-8 bg-gray-100 animate-pulse rounded-lg" />
          ) : isAdmin && (
            <Link href="/admin"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                pathname.startsWith('/admin')
                  ? 'bg-[#EEFBF4] text-[#1B6B4A] font-semibold'
                  : 'text-[#D4A843] hover:text-[#B8922F] hover:bg-[#FFF9EE]'
              }`}
            >
              <Shield size={14} /> Admin
            </Link>
          )}
          {links.map((link) => (
            <Link key={link.href} href={link.href}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname.startsWith(link.href)
                  ? 'bg-[#EEFBF4] text-[#1B6B4A] font-semibold'
                  : 'text-[#5A7068] hover:text-[#1B6B4A] hover:bg-[#F8FAF9]'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Notification bell with dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="w-9 h-9 rounded-xl hover:bg-[#F1F5F3] flex items-center justify-center text-[#5A7068] transition relative"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-[#E2E8E5] overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[#E2E8E5] flex items-center justify-between">
                  <h3 className="font-bold text-sm text-[#1A2E2A]">Notifications</h3>
                  <span className="badge bg-[#EEFBF4] text-[#1B6B4A] text-xs">{unreadCount} new</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {mockNotifications.map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b border-[#F1F5F3] last:border-0 ${!n.read ? "bg-[#EEFBF4]/40" : ""}`}>
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="w-2 h-2 bg-[#1B6B4A] rounded-full mt-1.5 shrink-0" />}
                        <div>
                          <p className="text-sm text-[#1A2E2A]">{n.text}</p>
                          <p className="text-xs text-[#8FA39B] mt-1">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {isLoading ? (
            <div className="hidden md:block w-20 h-9 bg-gray-100 animate-pulse rounded-xl ml-1" />
          ) : isAnonymous ? (
            <button onClick={() => setShowLoginModal(true)} className="hidden md:block px-4 py-2 btn-primary text-sm">Sign In</button>
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
                <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-2xl border border-[#E2E8E5] overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-[#F1F5F3]">
                    <p className="text-sm font-bold text-[#1A2E2A] truncate">
                      {user?.user_metadata?.full_name || user?.email || 'User'}
                    </p>
                    <p className="text-xs text-[#8FA39B] truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          )}

          <button className="lg:hidden w-9 h-9 rounded-xl hover:bg-[#F1F5F3] flex items-center justify-center text-[#5A7068]" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-[#E2E8E5] px-4 pb-4 pt-2 space-y-1 shadow-lg">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              className={`block px-4 py-3 rounded-xl text-sm font-medium transition ${
                pathname.startsWith(link.href) ? 'bg-[#EEFBF4] text-[#1B6B4A] font-semibold' : 'text-[#5A7068] hover:bg-[#F8FAF9]'
              }`}
            >{link.label}</Link>
          ))}
          {isLoading ? (
            <div className="w-full h-11 bg-gray-100 animate-pulse rounded-xl mt-2" />
          ) : isAnonymous ? (
            <button onClick={() => { setShowLoginModal(true); setMobileOpen(false); }} className="w-full px-4 py-3 btn-primary text-sm mt-2">Sign In</button>
          ) : (
            <>
              {isAdmin && (
                <Link href="/admin" onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 rounded-xl text-sm font-medium transition text-[#D4A843] hover:bg-[#FFF9EE] flex items-center gap-2 mt-1"
                >
                  <Shield size={15} /> Admin Panel
                </Link>
              )}
              <button onClick={handleSignOut} className="w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 mt-1 border border-red-200">
                <LogOut size={15} /> Sign Out
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}
