"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, HandHeart, QrCode, MapPin, Shield,
  Send, ScanLine, Award, Ban, LogOut, Bell,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthContext";

const sidebarLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gigs", label: "Volunteer Gigs", icon: Users },
  { href: "/crowdfunding", label: "Crowdfunding", icon: HandHeart },
  { href: "/e-kupon", label: "E-Kupon", icon: QrCode },
  { href: "/zakat", label: "Zakat Locator", icon: MapPin },
  { href: "/admin", label: "AJK Admin", icon: Shield },
];

const mockDonations = [
  { label: "Replace 5 broken fans in Women's Section", amount: 850 },
  { label: "Iftar Sponsorship Week 1", amount: 1200 },
];

const mockGigs = [
  { id: "1", title: "Stir Bubur Lambuk" },
  { id: "2", title: "Traffic Control" },
];

const mockUsers = [
  { id: "u1", name: "Siti" },
  { id: "u2", name: "Ahmad" },
];

export default function AdminPage() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [scanHistory, setScanHistory] = useState([{ id: "r1", status: "Pending" }]);

  const totalCollected = mockDonations.reduce((s, d) => s + d.amount, 0);

  const handleScan = () => {
    if (!scanInput.trim()) return;
    setScanHistory((prev) => [{ id: scanInput, status: "Scanned ✓" }, ...prev]);
    setScanInput("");
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAF9]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-[#E2E8E5] sticky top-0 h-screen">
        <div className="p-6 border-b border-[#E2E8E5]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 hero-gradient rounded-xl flex items-center justify-center text-white text-lg shadow-sm">🌙</div>
            <div>
              <span className="font-bold text-lg text-[#1A2E2A] block leading-tight">Makmur</span>
              <span className="text-[10px] text-[#8FA39B] font-medium block">Mosque OS</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive ? "bg-[#EEFBF4] text-[#1B6B4A] font-semibold" : "text-[#5A7068] hover:bg-[#F8FAF9] hover:text-[#1A2E2A]"
                }`}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E2E8E5]">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-10 h-10 rounded-xl hero-gradient flex items-center justify-center text-white text-sm font-bold shadow-sm">
              A
            </div>
            <div>
              <p className="text-sm font-bold text-[#1A2E2A]">Ahmad (AJK)</p>
              <p className="text-xs text-[#8FA39B]">Administrator</p>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 text-red-500 text-sm font-medium px-2 hover:text-red-600 transition">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-h-screen">
        {/* Broadcast top bar */}
        <div className="hero-gradient text-white px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Bell size={12} />
          </div>
          <span className="text-sm"><strong>Latest Broadcast:</strong> <span className="text-white/70">Welcome to Makmur App!</span></span>
        </div>

        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="icon-box icon-box-primary"><Shield size={22} /></div>
            <div>
              <h1 className="text-2xl font-bold text-[#1A2E2A]">AJK Admin Panel</h1>
              <p className="text-sm text-[#8FA39B]">Manage operations and community</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Financials */}
            <div className="card p-6">
              <h2 className="font-bold text-lg text-[#1A2E2A] mb-4">Financials Overview</h2>
              <div className="hero-gradient rounded-xl p-5 mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Total Collected (Stripe)</p>
                <p className="text-3xl font-bold text-white">RM {totalCollected.toLocaleString()}</p>
              </div>
              <div className="space-y-3">
                {mockDonations.map((d, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-dashed border-[#E2E8E5] last:border-0">
                    <span className="text-[#5A7068]">{d.label}</span>
                    <span className="font-bold text-[#1A2E2A]">RM {d.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Broadcast */}
            <div className="card p-6">
              <h2 className="font-bold text-lg text-[#1A2E2A] mb-2">Community Broadcast</h2>
              <p className="text-sm text-[#8FA39B] mb-4">Send a push notification to all registered users.</p>
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                placeholder="e.g., Tarawih delayed by 15 mins due to rain..."
                className="w-full border border-[#E2E8E5] rounded-xl p-3 text-sm resize-none h-24 focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9] mb-3"
              />
              <button
                onClick={() => { if (broadcastMsg) { alert("Broadcast: " + broadcastMsg); setBroadcastMsg(""); }}}
                className="w-full py-3 btn-primary text-sm"
              >
                <Send size={16} /> Blast Message
              </button>
            </div>

            {/* Scanner */}
            <div className="card p-6">
              <h2 className="font-bold text-lg text-[#1A2E2A] mb-2">E-Kupon Scanner</h2>
              <p className="text-sm text-[#8FA39B] mb-4">Scan a user&apos;s QR to mark food as claimed.</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Enter Reservation ID (e.g., r1)"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  className="flex-1 border border-[#E2E8E5] rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#1B6B4A]/20 focus:border-[#1B6B4A] outline-none bg-[#F8FAF9]"
                />
                <button onClick={handleScan} className="p-2.5 btn-primary rounded-xl"><ScanLine size={20} /></button>
              </div>
              <div className="space-y-2">
                {scanHistory.map((s, i) => (
                  <div key={i} className="flex justify-between items-center text-sm px-4 py-2.5 bg-[#F8FAF9] rounded-xl border border-[#E2E8E5]">
                    <span className="font-mono text-[#5A7068]">{s.id}</span>
                    <span className={`font-semibold ${s.status === "Pending" ? "text-[#D4A843]" : "text-[#1B6B4A]"}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Gig Management */}
            <div className="card p-6">
              <h2 className="font-bold text-lg text-[#1A2E2A] mb-5">User & Gig Management</h2>

              <p className="text-xs font-bold uppercase tracking-widest text-[#D4A843] mb-3">Complete Gigs (Award Points)</p>
              <div className="space-y-2 mb-6">
                {mockGigs.map((g) => (
                  <div key={g.id} className="flex justify-between items-center bg-[#F8FAF9] border border-[#E2E8E5] rounded-xl px-4 py-3">
                    <span className="text-sm font-medium text-[#1A2E2A]">{g.title}</span>
                    <button className="badge bg-[#EEFBF4] text-[#1B6B4A] border border-[#D5F5E3] hover:bg-[#D5F5E3] transition text-xs">
                      <Award size={12} /> Complete & Award
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs font-bold uppercase tracking-widest text-[#8FA39B] mb-3">Manage Users</p>
              <div className="space-y-2">
                {mockUsers.map((u) => (
                  <div key={u.id} className="flex justify-between items-center bg-[#F8FAF9] border border-[#E2E8E5] rounded-xl px-4 py-3">
                    <span className="text-sm font-medium text-[#1A2E2A]">{u.name}</span>
                    <button className="badge bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition text-xs">
                      <Ban size={12} /> Ban User
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
