"use client";

import { useAuth } from "@/components/providers/AuthContext";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import React, { useEffect, useState, useCallback } from "react";
import {
  BookOpen, Plus, X, Loader2, AlertTriangle,
  Calendar, Clock, MapPin, Mic2, RefreshCw, Pencil, Trash2,
  ChevronLeft, ChevronRight, CalendarPlus, Star,
} from "lucide-react";
import { toast } from "react-hot-toast";
import type { MosqueProgram, ProgramType } from "@/types/database";
import { getIslamicHolidays, type IslamicHoliday } from "@/lib/islamicHolidays";

/* ── Helpers ── */
function formatDate(d: string, lang: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(t: string) { return t.slice(0, 5); }

function typeColor(type: ProgramType | "holiday") {
  if (type === "holiday") return "bg-amber-500 text-black dark:bg-amber-400/80";
  const map: Record<ProgramType, string> = {
    lecture:  "bg-blue-600 text-white dark:bg-blue-500/80",
    halaqah:  "bg-emerald-600 text-white dark:bg-emerald-500/80",
    jumuah:   "bg-amber-500 text-white dark:bg-amber-500/80",
    other:    "bg-purple-600 text-white dark:bg-purple-500/80",
  };
  return map[type];
}

function typeDotColor(type: ProgramType | "holiday") {
  if (type === "holiday") return "bg-amber-400";
  const map: Record<ProgramType, string> = {
    lecture: "bg-blue-500",
    halaqah: "bg-emerald-500",
    jumuah:  "bg-amber-500",
    other:   "bg-purple-500",
  };
  return map[type];
}

function typeLabel(type: ProgramType, t: any) {
  const map: Record<ProgramType, string> = {
    lecture: t.mpLecture,
    halaqah: t.mpHalaqah,
    jumuah:  t.mpJumuah,
    other:   t.mpOther,
  };
  return map[type];
}

const todayStr = () => new Date().toISOString().split("T")[0];

/* ── .ics download ── */
function downloadICS(prog: MosqueProgram) {
  const dateCompact  = prog.program_date.replace(/-/g, "");
  const startCompact = prog.start_time.slice(0, 5).replace(":", "") + "00";
  const endCompact   = prog.end_time.slice(0, 5).replace(":", "")   + "00";
  const stamp        = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//Makmur Masjid//Mosque Programs//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${prog.id}@makmur-masjid`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Asia/Kuala_Lumpur:${dateCompact}T${startCompact}`,
    `DTEND;TZID=Asia/Kuala_Lumpur:${dateCompact}T${endCompact}`,
    `SUMMARY:${prog.title}`,
    prog.description     ? `DESCRIPTION:${prog.description.replace(/\n/g, "\\n")}` : null,
    prog.location        ? `LOCATION:${prog.location}`                               : null,
    prog.speaker         ? `ORGANIZER;CN=${prog.speaker}:MAILTO:noreply@makmur-masjid.app` : null,
    prog.recurrence_note ? `COMMENT:${prog.recurrence_note}`                         : null,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${prog.title.replace(/\s+/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Mini Calendar                                                      */
/* ═══════════════════════════════════════════════════════════════════ */
interface CalendarProps {
  programs: MosqueProgram[];
  islamicHolidays: IslamicHoliday[];
  selectedDate: string | null;
  onSelectDate: (d: string | null) => void;
  language: string;
  t: any;
}
function MiniCalendar({ programs, islamicHolidays, selectedDate, onSelectDate, language, t }: CalendarProps) {
  const today  = todayStr();
  const locale = language === "ms" ? "ms-MY" : "en-MY";
  const [viewDate, setViewDate] = useState(() => new Date());
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = new Date(year, month, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
  // Day headers Mon–Sun (ISO)
  const dayHeaders = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" })
  );
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // date → Set<ProgramType> for dots
  const dotMap: Record<string, Set<ProgramType | "holiday">> = {};
  programs.forEach(p => {
    if (!dotMap[p.program_date]) dotMap[p.program_date] = new Set();
    dotMap[p.program_date].add(p.program_type);
  });
  // Add Islamic holiday dots (amber)
  islamicHolidays.forEach(h => {
    if (!dotMap[h.gregorianDate]) dotMap[h.gregorianDate] = new Set();
    dotMap[h.gregorianDate].add("holiday" as any);
  });
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div className="card p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-border/40 text-text-muted transition-colors">
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-bold text-text capitalize">{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-border/40 text-text-muted transition-colors">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-text-muted uppercase py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`f${i}`} className="h-9" />;
          const isToday    = dateStr === today;
          const isSelected = selectedDate === dateStr;
          const types      = dotMap[dateStr];
          return (
            <div key={dateStr}
              onClick={() => onSelectDate(isSelected ? null : dateStr)}
              className={`relative flex flex-col items-center justify-center h-9 rounded-lg cursor-pointer transition-all select-none ${
                isSelected ? "bg-primary text-white shadow-sm"
                : isToday  ? "bg-primary/15 text-primary font-bold ring-1 ring-primary/30"
                : "hover:bg-border/40 text-text"
              }`}
            >
              <span className="text-xs leading-none">{new Date(dateStr + "T00:00:00").getDate()}</span>
              {types && types.size > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {Array.from(types).slice(0, 3).map(type => (
                    <span key={type}
                      className={`w-1 h-1 rounded-full ${isSelected ? "bg-white/80" : typeDotColor(type)}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-3 pt-3 border-t border-border/60 justify-center flex-wrap">
        {(["lecture", "halaqah", "jumuah", "other"] as ProgramType[]).map(type => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${typeDotColor(type)}`} />
            <span className="text-[10px] text-text-muted">{typeLabel(type, t)}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-400" />
          <span className="text-[10px] text-text-muted">Cuti Umum / Hari Islam</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Main Page                                                          */
/* ═══════════════════════════════════════════════════════════════════ */
export default function MosqueProgramsPage() {
  const { isAdmin } = useAuth();
  const { t, language } = useLanguage();

  const [programs, setPrograms] = useState<MosqueProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [islamicHolidays, setIslamicHolidays] = useState<IslamicHoliday[]>([]);

  const [typeFilter, setTypeFilter] = useState<ProgramType | "all">("all");
  const [timeFilter, setTimeFilter] = useState<"upcoming" | "today" | "past">("upcoming");

  // Calendar date selection
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<MosqueProgram | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<MosqueProgram | null>(null);

  /* ── Fetch ── */
  const fetchPrograms = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("mosque_programs")
        .select("*")
        .order("program_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) { setFetchError(error.message); setPrograms([]); }
      else { setFetchError(null); setPrograms(data ?? []); }
    } catch (e: any) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
    const supabase = createClient();
    const chan = supabase
      .channel("mosque-programs-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "mosque_programs" }, fetchPrograms)
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [fetchPrograms]);

  useEffect(() => {
    getIslamicHolidays(new Date().getFullYear()).then(setIslamicHolidays);
  }, []);

  /* ── Derived ── */
  const today = todayStr();
  const todayPrograms = programs.filter(p => p.program_date === today);
  const visible = programs.filter(p => {
    if (typeFilter !== "all" && p.program_type !== typeFilter) return false;
    if (selectedDate) return p.program_date === selectedDate;
    if (timeFilter === "today")    return p.program_date === today;
    if (timeFilter === "upcoming") return p.program_date >= today;
    if (timeFilter === "past")     return p.program_date < today;
    return true;
  });

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!deletingProgram) return;
    const supabase = createClient();
    const { error } = await supabase.from("mosque_programs").delete().eq("id", deletingProgram.id);
    if (error) toast.error(error.message);
    else { toast.success(t.mpDeleted); setPrograms(prev => prev.filter(p => p.id !== deletingProgram.id)); }
    setDeletingProgram(null);
  };

  const typeFilters: { key: ProgramType | "all"; label: string }[] = [
    { key: "all",     label: t.mpAll },
    { key: "lecture", label: t.mpLecture },
    { key: "halaqah", label: t.mpHalaqah },
    { key: "jumuah",  label: t.mpJumuah },
    { key: "other",   label: t.mpOther },
  ];

  const timeFilters: { key: "upcoming" | "today" | "past"; label: string }[] = [
    { key: "upcoming", label: t.mpUpcoming },
    { key: "today",    label: t.mpToday },
    { key: "past",     label: t.mpPast },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="text-primary"><BookOpen size={28} strokeWidth={2.5} /></div>
          <div>
            <h1 className="text-2xl font-bold text-text">{t.mpTitle}</h1>
            <p className="text-sm text-text-muted">{t.mpSubtitle}</p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingProgram(null); setShowModal(true); }}
            className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <Plus size={16} /> <span className="hidden sm:inline">{t.mpAddProgram}</span>
          </button>
        )}
      </div>

      {/* Mini calendar */}
      {!loading && !fetchError && (
        <MiniCalendar
          programs={programs}
          islamicHolidays={islamicHolidays}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          language={language}
          t={t}
        />
      )}

      {/* Time filter pills — hidden when a calendar date is selected */}
      {!selectedDate && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {timeFilters.map(f => (
            <button
              key={f.key}
              onClick={() => setTimeFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                timeFilter === f.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface border border-border text-text-muted hover:border-primary/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Selected date chip */}
      {selectedDate && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
            <Calendar size={11} />
            {new Date(selectedDate + "T00:00:00").toLocaleDateString(
              language === "ms" ? "ms-MY" : "en-MY",
              { weekday: "short", day: "numeric", month: "short", year: "numeric" }
            )}
          </div>
          <button
            onClick={() => setSelectedDate(null)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-surface border border-border text-text-muted hover:border-primary/50 transition-all"
          >
            {t.mpClearDate}
          </button>
        </div>
      )}

      {/* Type filter pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {typeFilters.map(f => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              typeFilter === f.key
                ? "bg-primary text-white shadow-sm"
                : "bg-surface border border-border text-text-muted hover:border-primary/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-text-muted">
          <Loader2 size={20} className="animate-spin" /> <span>{t.loading}</span>
        </div>
      )}

      {/* Error */}
      {!loading && fetchError && (
        <div className="card p-8 text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold text-text mb-1">{t.loadFailed}</p>
          <p className="text-sm text-text-muted mb-4">{fetchError}</p>
          <button onClick={fetchPrograms} className="px-5 py-2 btn-primary text-sm flex items-center gap-2 mx-auto">
            <RefreshCw size={14} /> {t.retry}
          </button>
        </div>
      )}

      {/* Today's Programs Banner */}
      {!loading && !fetchError && !selectedDate && timeFilter === "upcoming" && todayPrograms.length > 0 && (
        <div className="card border-primary/40 bg-primary/5 dark:bg-primary/10 p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
            <span className="text-sm font-bold text-primary">
              {t.mpTodayBanner} ({todayPrograms.length})
            </span>
          </div>
          <div className="space-y-2">
            {todayPrograms.map(p => (
              <div key={p.id} className="flex items-center gap-2.5">
                <span className="text-xs font-mono text-primary/70 w-11 flex-shrink-0">{formatTime(p.start_time)}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeColor(p.program_type)}`}>
                  {typeLabel(p.program_type, t)}
                </span>
                <span className="text-sm text-text font-medium truncate">{p.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchError && visible.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={32} className="text-primary" />
          </div>
          <p className="font-semibold text-text mb-1">
            {programs.length === 0 ? t.mpNoPrograms : t.mpNoProgramsFilter}
          </p>
        </div>
      )}

      {/* Program cards — grouped by date */}
      {!loading && !fetchError && (() => {
        const byDate: Record<string, MosqueProgram[]> = {};
        visible.forEach(p => {
          if (!byDate[p.program_date]) byDate[p.program_date] = [];
          byDate[p.program_date].push(p);
        });

        // Merge Islamic holidays into the date groups
        const visibleHolidays = islamicHolidays.filter(h => {
          if (selectedDate) return h.gregorianDate === selectedDate;
          if (timeFilter === "today")    return h.gregorianDate === today;
          if (timeFilter === "upcoming") return h.gregorianDate >= today;
          if (timeFilter === "past")     return h.gregorianDate < today;
          return true;
        });
        visibleHolidays.forEach(h => {
          if (!byDate[h.gregorianDate]) byDate[h.gregorianDate] = [];
        });

        // Holiday lookup for rendering
        const holidayByDate: Record<string, IslamicHoliday[]> = {};
        visibleHolidays.forEach(h => {
          if (!holidayByDate[h.gregorianDate]) holidayByDate[h.gregorianDate] = [];
          holidayByDate[h.gregorianDate].push(h);
        });

        return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
          <div key={date} className="mb-6">
            {/* Date header */}
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-primary" />
              <span className={`text-xs font-bold uppercase tracking-wider ${
                date === today ? "text-primary" : "text-text-muted"
              }`}>
                {date === today ? `${t.mpToday} — ` : ""}{formatDate(date, language)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-3">
              {/* Islamic holiday cards for this date */}
              {(holidayByDate[date] ?? []).map(h => (
                <div key={`holiday-${h.gregorianDate}-${h.name}`}
                  className="rounded-xl p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Star size={14} className="text-amber-500 flex-shrink-0" />
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-400 text-black">
                      {h.name}
                    </span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{h.hijriLabel}</p>
                </div>
              ))}

              {items.map(prog => (
                <div key={prog.id} className="card p-4 group hover:border-primary/30 transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Type badge + recurring */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`badge text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor(prog.program_type)}`}>
                          {typeLabel(prog.program_type, t)}
                        </span>
                        {prog.is_recurring && (
                          <span className="badge bg-surface border border-border text-text-muted text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <RefreshCw size={10} /> {t.mpRecurring}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-text text-base leading-snug mb-1">{prog.title}</h3>

                      {prog.description && (
                        <p className="text-sm text-text-secondary mb-2 line-clamp-2">{prog.description}</p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatTime(prog.start_time)} – {formatTime(prog.end_time)}
                        </span>
                        {prog.speaker && (
                          <span className="flex items-center gap-1">
                            <Mic2 size={11} /> {prog.speaker}
                          </span>
                        )}
                        {prog.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {prog.location}
                          </span>
                        )}
                      </div>

                      {prog.recurrence_note && (
                        <p className="text-xs text-primary/70 mt-1 italic">{prog.recurrence_note}</p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {/* Add to Calendar — always visible */}
                      <button
                        onClick={() => downloadICS(prog)}
                        className="p-1.5 rounded-lg bg-surface border border-border/60 text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
                        title={t.mpAddToCalendar}
                      >
                        <CalendarPlus size={13} />
                      </button>
                      {/* Admin only */}
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => { setEditingProgram(prog); setShowModal(true); }}
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100"
                            title={t.edit}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingProgram(prog)}
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
                            title={t.delete}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ));
      })()}

      {/* Add / Edit Modal */}
      {showModal && (
        <ProgramModal
          program={editingProgram}
          onClose={() => { setShowModal(false); setEditingProgram(null); }}
          onSaved={(p) => {
            if (editingProgram) {
              setPrograms(prev => prev.map(x => x.id === p.id ? p : x));
            } else {
              setPrograms(prev => [p, ...prev].sort((a, b) =>
                a.program_date === b.program_date
                  ? a.start_time.localeCompare(b.start_time)
                  : a.program_date.localeCompare(b.program_date)
              ));
            }
            setShowModal(false);
            setEditingProgram(null);
          }}
          t={t}
        />
      )}

      {/* Delete Confirm Modal */}
      {deletingProgram && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDeletingProgram(null)}>
          <div className="bg-surface rounded-2xl shadow-xl max-w-sm w-full border border-border/60" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <h2 className="font-bold text-text">{t.mpDeleteTitle}</h2>
              <button onClick={() => setDeletingProgram(null)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-text-muted hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-text-secondary mb-2">{t.mpDeleteConfirm}</p>
              <p className="font-semibold text-text mb-5">"{deletingProgram.title}"</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingProgram(null)} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary text-sm hover:bg-background transition-colors">{t.cancel}</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors">{t.delete}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  Add / Edit Modal                                                   */
/* ═══════════════════════════════════════════════════════════════════ */
interface ModalProps {
  program: MosqueProgram | null;
  onClose: () => void;
  onSaved: (p: MosqueProgram) => void;
  t: any;
}

function ProgramModal({ program, onClose, onSaved, t }: ModalProps) {
  const { user } = useAuth();
  const isEdit = !!program;

  const [title, setTitle]             = useState(program?.title ?? "");
  const [type, setType]               = useState<ProgramType>(program?.program_type ?? "lecture");
  const [date, setDate]               = useState(program?.program_date ?? new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime]     = useState(program?.start_time?.slice(0, 5) ?? "20:00");
  const [endTime, setEndTime]         = useState(program?.end_time?.slice(0, 5) ?? "21:00");
  const [speaker, setSpeaker]         = useState(program?.speaker ?? "");
  const [location, setLocation]       = useState(program?.location ?? "");
  const [desc, setDesc]               = useState(program?.description ?? "");
  const [isRecurring, setIsRecurring] = useState(program?.is_recurring ?? false);
  const [recurrenceNote, setRecurrenceNote] = useState(program?.recurrence_note ?? "");
  const [saving, setSaving]           = useState(false);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !startTime || !endTime) return;
    if (endTime < startTime) { toast.error(t.mpTimeError); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      title:           title.trim(),
      program_type:    type,
      program_date:    date,
      start_time:      startTime,
      end_time:        endTime,
      speaker:         speaker.trim() || null,
      location:        location.trim() || null,
      description:     desc.trim() || null,
      is_recurring:    isRecurring,
      recurrence_note: isRecurring && recurrenceNote.trim() ? recurrenceNote.trim() : null,
      is_active:       true,
    };

    if (isEdit && program) {
      const { data, error } = await supabase
        .from("mosque_programs")
        .update(payload)
        .eq("id", program.id)
        .select()
        .single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success(t.mpUpdated);
      onSaved(data as MosqueProgram);
    } else {
      const { data, error } = await supabase
        .from("mosque_programs")
        .insert({ ...payload, created_by: user?.id ?? null })
        .select()
        .single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success(t.mpCreated);
      onSaved(data as MosqueProgram);
    }
  };

  const programTypes: { value: ProgramType; label: string }[] = [
    { value: "lecture", label: t.mpLecture },
    { value: "halaqah", label: t.mpHalaqah },
    { value: "jumuah",  label: t.mpJumuah },
    { value: "other",   label: t.mpOther },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-border/60" onClick={e => e.stopPropagation()}>
        {/* Sticky header */}
        <div className="sticky top-0 bg-surface border-b border-border/60 flex items-center justify-between px-5 py-4 z-10 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg hero-gradient flex items-center justify-center flex-shrink-0">
              {isEdit ? <Pencil size={12} className="text-white" /> : <Plus size={12} className="text-white" />}
            </div>
            <h2 className="font-bold text-text">{isEdit ? t.mpEditTitle : t.mpAddTitle}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-text-muted hover:text-red-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldTitle}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required autoFocus
              className="input w-full" placeholder="Kuliah Maghrib Harian" />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldType}</label>
            <select value={type} onChange={e => setType(e.target.value as ProgramType)} className="input w-full">
              {programTypes.map(pt => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldDate}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="input w-full" />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldStart}</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="input w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldEnd}</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required className="input w-full" />
            </div>
          </div>

          {/* Speaker + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldSpeaker}</label>
              <input value={speaker} onChange={e => setSpeaker(e.target.value)}
                className="input w-full" placeholder="Ustaz Ahmad" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldLocation}</label>
              <input value={location} onChange={e => setLocation(e.target.value)}
                className="input w-full" placeholder="Dewan Utama" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldDesc}</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              className="input w-full resize-none" placeholder="Penerangan singkat..." />
          </div>

          {/* Recurring */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
              className="w-4 h-4 accent-primary rounded" />
            <span className="text-sm text-text">{t.mpFieldRecurring}</span>
          </label>

          {isRecurring && (
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldRecurrenceNote}</label>
              <input value={recurrenceNote} onChange={e => setRecurrenceNote(e.target.value)}
                className="input w-full" placeholder="Setiap malam Ramadan" />
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={saving}
            className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <><Loader2 size={16} className="animate-spin" /> {t.saving}</> : isEdit ? t.save : t.mpAddProgram}
          </button>
        </form>
      </div>
    </div>
  );
}
