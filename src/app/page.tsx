"use client";

import Link from "next/link";
import { LayoutDashboard, QrCode, MapPin, Users, HandHeart, ArrowRight, Star, Shield, PackageSearch, Building2, CalendarDays, Monitor, Clock } from "lucide-react";
import { useAuth } from "@/components/providers/AuthContext";
import { useLiveStats } from "@/hooks/useLiveStats";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useLanguage } from "@/components/providers/LanguageContext";

function formatStat(value: number, prefix = "", suffix = ""): string {
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M${suffix}`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(1)}K${suffix}`;
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
    { href: "/mosque-programs", icon: CalendarDays, title: t.navMosquePrograms, desc: t.featureProgramsDesc, color: "text-primary" },
    { href: "/lost-found", icon: PackageSearch, title: t.navLostFound, desc: t.featureLostFoundDesc, color: "text-primary" },
    { href: "/facility-booking", icon: Building2, title: t.navFacilityBooking, desc: t.featureFacilityDesc, color: "text-primary" },
    { href: "/waktu-solat", icon: Clock, title: t.navWaktuSolat, desc: t.featureWaktuSolatDesc, color: "text-primary" },
    { href: "/paparan-masjid", icon: Monitor, title: t.navPaparanMasjid, desc: t.featurePaparanMasjidDesc, color: "text-primary" },
  ];

  const adminFeatures = [
    { href: "/dashboard", icon: LayoutDashboard, title: "AI Dashboard", desc: t.featureDashboardDesc, color: "text-[#00d084]" },
    { href: "/admin", icon: Shield, title: "AJK Admin", desc: t.featureAdminDesc, color: "text-[#00d084]" },
  ];

  const features = [...adminFeatures, ...publicFeatures];

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
    <div className="min-h-screen overflow-x-hidden w-full relative">
      {/* ═══ HERO SECTION ═══ */}
      <section className="hero-gradient text-white relative overflow-hidden pb-16 md:pb-24">
        {/* Islamic Geometric Pattern */}
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-[0.12]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg fill='none' stroke='%23fff' stroke-width='1.5' stroke-linejoin='round'%3E%3Crect x='4' y='4' width='112' height='112'/%3E%3Cpolygon points='37,4 83,4 116,37 116,83 83,116 37,116 4,83 4,37'/%3E%3Cpolygon points='60,20 67,44 88,32 76,54 100,60 76,66 88,88 67,76 60,100 53,76 32,88 44,66 20,60 44,54 32,32 53,44'/%3E%3Cpolygon points='67,44 76,54 76,66 67,76 53,76 44,66 44,54 53,44'/%3E%3Cline x1='60' y1='0' x2='60' y2='20'/%3E%3Cline x1='120' y1='60' x2='100' y2='60'/%3E%3Cline x1='60' y1='120' x2='60' y2='100'/%3E%3Cline x1='0' y1='60' x2='20' y2='60'/%3E%3Cline x1='0' y1='0' x2='32' y2='32'/%3E%3Cline x1='120' y1='0' x2='88' y2='32'/%3E%3Cline x1='0' y1='120' x2='32' y2='88'/%3E%3Cline x1='120' y1='120' x2='88' y2='88'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: "120px 120px"
          }}
        />
        {/* Fade to bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background pointer-events-none" />

        <div className="absolute top-0 right-0 w-96 h-96 bg-surface/5 rounded-full -mt-48 -mr-48 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-surface/5 rounded-full -mb-32 -ml-32 blur-2xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-gold rounded-full animate-live pointer-events-none" />
        <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-gold/60 rounded-full animate-live pointer-events-none" style={{ animationDelay: '0.5s' }} />

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

      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="container mx-auto px-2 min-[400px]:px-4 -mt-20 md:-mt-24 mb-16 relative z-20">
        <div className="bg-white dark:bg-slate-900/40 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border dark:border-white/10 p-4 min-[400px]:p-6 grid grid-cols-2 md:grid-cols-4 gap-y-6 md:gap-y-0 divide-y md:divide-y-0 md:divide-x divide-border/50 transition-all">
          {statDisplay.map((s) => (
            <div key={s.label} className="text-center py-2 md:py-0 px-2 min-[400px]:px-6 flex flex-col items-center justify-center">
              <p className={`text-3xl md:text-3xl lg:text-4xl font-extrabold text-primary drop-shadow-sm transition-all leading-tight ${stats.isLoading ? "opacity-40" : ""}`}>
                {s.value}
              </p>
              <p className="text-[10px] min-[400px]:text-[11px] text-text-secondary dark:text-text border border-border dark:border-white/5 bg-surface-alt dark:bg-white/5 rounded-full px-3 py-1 font-semibold mt-2 leading-tight uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES SECTION ═══ */}
      <section className="w-full" style={{ backgroundColor: 'var(--features-bg)' }}>
        <div className="container mx-auto px-4 pb-20 pt-8">
          <div className="text-center mb-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gold mb-4">{t.whatWeOffer}</p>
            <h2 className="text-3xl md:text-[2.5rem] font-bold text-text dark:text-white tracking-tight">{t.everythingYourMosqueNeeds}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1100px] mx-auto">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Link
                  key={f.href}
                  href={f.href}
                  className="group flex flex-col p-8 rounded-[18px] bg-white dark:bg-[#1e232e] border border-border dark:border-[#2b3240] shadow-sm hover:shadow-2xl hover:-translate-y-1 hover:border-primary/30 dark:hover:border-[#384152] transition-all duration-300 relative overflow-hidden"
                >
                  {/* Glowing hover dot top left */}
                  <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />

                  {/* Box Icon Container */}
                  <div className="relative z-10 w-[42px] h-[42px] rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-5 group-hover:bg-primary/20 transition-all duration-300">
                    <Icon size={20} className="stroke-primary" strokeWidth={2} />
                  </div>

                  {/* Text Container */}
                  <div className="relative z-10 font-sans">
                    <h3 className="text-base font-semibold text-text dark:text-white mb-2">{f.title}</h3>
                    <p className="text-[13px] text-text-muted dark:text-[#8b949e] leading-relaxed mb-4">{f.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER / CREDITS ═══ */}
      <footer className="w-full bg-background pt-16 pb-12 border-t border-border dark:border-white/5 mt-auto">
        <div className="container mx-auto px-4 max-w-5xl">

          <div className="text-center mb-10">
            <h3 className="text-xl font-bold text-text dark:text-white mb-2">{t.footerDevTitle}</h3>
            <p className="text-sm text-text-muted dark:text-white/40">{t.footerDevSubtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            {/* Developer 1 */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-full bg-surface border border-white/10 mb-4 overflow-hidden relative shadow-lg group-hover:ring-2 ring-primary/50 transition-all">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">👨‍💻</div>
              </div>
              <h4 className="text-base font-bold text-text dark:text-white mb-1">Developer 1</h4>
              <p className="text-xs text-primary font-medium mb-2">Lead Engineer</p>
              <p className="text-xs text-text-muted dark:text-white/40 max-w-[200px] leading-relaxed">{t.footerDev1Desc}</p>
            </div>

            {/* Developer 2 */}
            <div className="flex flex-col items-center text-center group md:mt-4">
              <div className="w-24 h-24 rounded-full bg-surface border border-white/10 mb-4 overflow-hidden relative shadow-lg group-hover:ring-2 ring-primary/50 transition-all">
                <div className="absolute inset-0 bg-gradient-to-tr from-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">👨‍💻</div>
              </div>
              <h4 className="text-base font-bold text-text dark:text-white mb-1">Developer 2</h4>
              <p className="text-xs text-gold font-medium mb-2">Frontend & UI/UX</p>
              <p className="text-xs text-text-muted dark:text-white/40 max-w-[200px] leading-relaxed">{t.footerDev2Desc}</p>
            </div>

            {/* Developer 3 */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-24 h-24 rounded-full bg-surface border border-white/10 mb-4 overflow-hidden relative shadow-lg group-hover:ring-2 ring-primary/50 transition-all">
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl">👨‍💻</div>
              </div>
              <h4 className="text-base font-bold text-text dark:text-white mb-1">Developer 3</h4>
              <p className="text-xs text-cyan-400 font-medium mb-2">Systems & Integration</p>
              <p className="text-xs text-text-muted dark:text-white/40 max-w-[200px] leading-relaxed">{t.footerDev3Desc}</p>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-border dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-text-muted dark:text-white/30 text-xs text-center md:text-left">
                &copy; {new Date().getFullYear()} Makmur Masjid OS. {t.footerCopyright}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
