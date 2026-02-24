"use client";

import Link from "next/link";
import { LayoutDashboard, QrCode, MapPin, Users, HandHeart, ArrowRight, Star, Shield } from "lucide-react";
import { useAuth } from "@/components/providers/AuthContext";
import { useLiveStats } from "@/hooks/useLiveStats";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useLanguage } from "@/components/providers/LanguageContext";

function formatStat(value: number, prefix = "", suffix = ""): string {
  if (value >= 1000) return `${prefix}${(value / 1000).toFixed(1)}K${suffix}`;
  return `${prefix}${value.toLocaleString()}${suffix}`;
}

export default function HomePage() {
  const { isAdmin } = useAuth();
  const stats = useLiveStats();
  const settings = useSystemSettings();
  const { t } = useLanguage();

  const publicFeatures = [
    { href: "/e-kupon", icon: QrCode, title: t.navEKupon, desc: t.featureEKuponDesc, color: "text-primary" },
    { href: "/zakat", icon: MapPin, title: t.navZakat, desc: t.featureZakatDesc, color: "text-primary" },
    { href: "/gigs", icon: Users, title: t.gigsTitle, desc: t.featureGigsDesc, color: "text-primary" },
    { href: "/crowdfunding", icon: HandHeart, title: t.crowdfundTitle, desc: t.featureCrowdfundDesc, color: "text-primary" },
  ];

  const adminFeatures = [
    { href: "/dashboard", icon: LayoutDashboard, title: "AI Dashboard", desc: t.featureDashboardDesc, color: "text-primary" },
    { href: "/admin", icon: Shield, title: "AJK Admin", desc: t.featureAdminDesc, color: "text-primary" },
  ];

  const features = isAdmin ? [...adminFeatures, ...publicFeatures] : publicFeatures;

  const statDisplay = [
    {
      value: stats.isLoading ? "..." : `${stats.iftarPacksDistributed.toLocaleString()}+`,
      label: t.statIftarPacks,
    },
    {
      value: stats.isLoading ? "..." : stats.activeVolunteers.toString(),
      label: t.statVolunteers,
    },
    {
      value: stats.isLoading ? "..." : formatStat(stats.donationsCollected, "RM "),
      label: t.statDonations,
    },
    {
      value: stats.isLoading ? "..." : stats.zakatCountersLive.toString(),
      label: t.statZakat,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* ═══ HERO SECTION ═══ */}
      <section className="hero-gradient text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-surface/5 rounded-full -mt-48 -mr-48 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-surface/5 rounded-full -mb-32 -ml-32 blur-2xl" />
        <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-gold rounded-full animate-live" />
        <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-gold/60 rounded-full animate-live" style={{ animationDelay: '0.5s' }} />

        <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-surface/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Star size={14} className="text-gold" />
              <span className="text-xs font-semibold text-white/90">Ramadan 1447H — {settings.system_desc}</span>
            </div>

            <h1 className="text-4xl md:text-7xl font-bold leading-tight mb-2 mt-2 flex flex-col items-center">
              <div className="text-white/90 mb-0 drop-shadow-sm font-medium" style={{ fontFamily: "var(--font-kufi)", fontSize: "0.45em", letterSpacing: "0px" }}>
                بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم
              </div>
              <div className="text-gold mb-1 drop-shadow-lg" style={{ fontFamily: "var(--font-amiri)", fontSize: "1.8em", lineHeight: "1.2" }}>
                معمور
              </div>
              <span className="text-2xl md:text-3xl font-medium tracking-wide text-white/90 mt-2">
                Makmur System
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/70 max-w-xl mx-auto mb-10 leading-relaxed">
              {t.heroSubtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {isAdmin ? (
                <>
                  <Link
                    href="/dashboard"
                    className="px-8 py-3.5 bg-gold hover:bg-gold-dark text-[#111827] font-bold rounded-xl text-sm transition-all shadow-lg shadow-gold/20 hover:shadow-gold/30 flex items-center justify-center gap-2"
                  >
                    {t.openDashboard} <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/admin"
                    className="px-8 py-3.5 border-2 border-white/30 text-white font-bold rounded-xl text-sm hover:bg-surface/10 transition-all flex items-center justify-center gap-2"
                  >
                    {t.ajkAdminPanel}
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/e-kupon"
                    className="px-8 py-3.5 bg-gold hover:bg-gold-dark text-[#111827] font-bold rounded-xl text-sm transition-all shadow-lg shadow-gold/20 hover:shadow-gold/30 flex items-center justify-center gap-2"
                  >
                    {t.claimEKupon} <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/gigs"
                    className="px-8 py-3.5 border-2 border-white/30 text-white font-bold rounded-xl text-sm hover:bg-surface/10 transition-all flex items-center justify-center gap-2"
                  >
                    {t.volunteerGigs}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60V20C240 0 480 40 720 30C960 20 1200 0 1440 20V60H0Z" fill="currentColor" className="text-background" />
          </svg>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="container mx-auto px-4 -mt-2 mb-12">
        <div className="bg-surface rounded-2xl shadow-lg border border-border p-6 grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
          {statDisplay.map((s) => (
            <div key={s.label} className="text-center py-4 md:py-0 md:px-6">
              <p className={`text-2xl md:text-3xl font-bold text-primary transition-all ${stats.isLoading ? "opacity-40" : ""}`}>
                {s.value}
              </p>
              <p className="text-xs text-text-muted font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES SECTION ═══ */}
      <section className="container mx-auto px-4 pb-16">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-gold mb-2">{t.whatWeOffer}</p>
          <h2 className="text-3xl font-bold text-text">{t.everythingYourMosqueNeeds}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Link key={f.href} href={f.href} className="card p-6 group flex flex-col">
                <div className="mb-4 w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary/15 dark:group-hover:bg-primary/20 transition-all">
                  <Icon size={22} strokeWidth={2.5} />
                </div>
                <h3 className="font-bold text-text text-lg mb-1.5">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed flex-1">{f.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all">
                  Open <ArrowRight size={12} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
