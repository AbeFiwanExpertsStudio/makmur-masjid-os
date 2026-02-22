"use client";

import Link from "next/link";
import { LayoutDashboard, QrCode, MapPin, Users, HandHeart, ArrowRight, Star, Shield } from "lucide-react";
import { useAuth } from "@/components/providers/AuthContext";
import { useLiveStats } from "@/hooks/useLiveStats";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const publicFeatures = [
  { href: "/e-kupon", icon: QrCode, title: "E-Kupon", desc: "Digital food coupons with live counters and QR codes.", color: "icon-box-primary" },
  { href: "/zakat", icon: MapPin, title: "Zakat Locator", desc: "Find nearest zakat collection points on an interactive map.", color: "icon-box-primary" },
  { href: "/gigs", icon: Users, title: "Volunteer Gigs", desc: "Claim community tasks and contribute this Ramadan.", color: "icon-box-gold" },
  { href: "/crowdfunding", icon: HandHeart, title: "Crowdfunding", desc: "Support mosque fundraising campaigns transparently.", color: "icon-box-gold" },
];

const adminFeatures = [
  { href: "/dashboard", icon: LayoutDashboard, title: "AI Dashboard", desc: "Crowd predictions & resource planning powered by machine learning.", color: "icon-box-primary" },
  { href: "/admin", icon: Shield, title: "AJK Admin", desc: "Manage operations, scan kupons, and broadcast messages.", color: "icon-box-gold" },
];

function formatStat(value: number, prefix = "", suffix = ""): string {
  if (value >= 1000) return `${prefix}${(value / 1000).toFixed(1)}K${suffix}`;
  return `${prefix}${value.toLocaleString()}${suffix}`;
}

export default function HomePage() {
  const { isAdmin } = useAuth();
  const stats = useLiveStats();
  const settings = useSystemSettings();
  const features = isAdmin ? [...adminFeatures, ...publicFeatures] : publicFeatures;

  const statDisplay = [
    {
      value: stats.isLoading ? "..." : `${stats.iftarPacksDistributed.toLocaleString()}+`,
      label: "Iftar Packs Distributed",
    },
    {
      value: stats.isLoading ? "..." : stats.activeVolunteers.toString(),
      label: "Active Volunteers",
    },
    {
      value: stats.isLoading ? "..." : formatStat(stats.donationsCollected, "RM "),
      label: "Donations Collected",
    },
    {
      value: stats.isLoading ? "..." : stats.zakatCountersLive.toString(),
      label: "Zakat Counters Live",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* ═══ HERO SECTION ═══ */}
      <section className="hero-gradient text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mt-48 -mr-48 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -mb-32 -ml-32 blur-2xl" />
        <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-[#D4A843] rounded-full animate-live" />
        <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-[#D4A843]/60 rounded-full animate-live" style={{ animationDelay: '0.5s' }} />

        <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Star size={14} className="text-[#D4A843]" />
              <span className="text-xs font-semibold text-white/90">Ramadan 1447H — {settings.system_desc}</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              {settings.system_name}<br />
              <span className="text-[#D4A843]">Platform</span>
            </h1>

            <p className="text-lg md:text-xl text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
              Manage crowds, resources, volunteers, and zakat — all from one beautiful, intelligent platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {isAdmin ? (
                <>
                  <Link
                    href="/dashboard"
                    className="px-8 py-3.5 bg-[#D4A843] hover:bg-[#B8922F] text-[#1A2E2A] font-bold rounded-xl text-sm transition-all shadow-lg shadow-[#D4A843]/20 flex items-center justify-center gap-2"
                  >
                    Open Dashboard <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/admin"
                    className="px-8 py-3.5 border-2 border-white/30 text-white font-bold rounded-xl text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    AJK Admin Panel
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/e-kupon"
                    className="px-8 py-3.5 bg-[#D4A843] hover:bg-[#B8922F] text-[#1A2E2A] font-bold rounded-xl text-sm transition-all shadow-lg shadow-[#D4A843]/20 flex items-center justify-center gap-2"
                  >
                    Claim E-Kupon <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/gigs"
                    className="px-8 py-3.5 border-2 border-white/30 text-white font-bold rounded-xl text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    Volunteer Gigs
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60V20C240 0 480 40 720 30C960 20 1200 0 1440 20V60H0Z" fill="#F8FAF9" />
          </svg>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="container mx-auto px-4 -mt-2 mb-12">
        <div className="bg-white rounded-2xl shadow-lg border border-[#E2E8E5] p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {statDisplay.map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-2xl md:text-3xl font-bold text-[#1B6B4A] transition-all ${stats.isLoading ? "opacity-40" : ""}`}>
                {s.value}
              </p>
              <p className="text-xs text-[#8FA39B] font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES SECTION ═══ */}
      <section className="container mx-auto px-4 pb-16">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#D4A843] mb-2">What We Offer</p>
          <h2 className="text-3xl font-bold text-[#1A2E2A]">Everything Your Mosque Needs</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Link key={f.href} href={f.href} className="card p-6 group">
                <div className={`icon-box ${f.color} mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon size={22} />
                </div>
                <h3 className="font-bold text-[#1A2E2A] text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-[#5A7068] leading-relaxed">{f.desc}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
