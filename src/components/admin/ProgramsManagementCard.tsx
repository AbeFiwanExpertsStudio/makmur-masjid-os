"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/providers/LanguageContext";
import { useAuth } from "@/components/providers/AuthContext";
import type { MosqueProgram, ProgramType } from "@/types/database";
import toast from "react-hot-toast";
import {
  CalendarDays, Plus, Pencil, Trash2, X,
  ToggleLeft, ToggleRight, Loader2, Radio,
} from "lucide-react";

/* ─────────────────────────────────────────────────── */
/* Shared helpers                                       */
/* ─────────────────────────────────────────────────── */
function typeColor(type: ProgramType) {
  const map: Record<ProgramType, string> = {
    lecture: "bg-blue-600 text-white dark:bg-blue-500/80",
    halaqah: "bg-emerald-600 text-white dark:bg-emerald-500/80",
    jumuah:  "bg-amber-500 text-white dark:bg-amber-500/80",
    other:   "bg-purple-600 text-white dark:bg-purple-500/80",
  };
  return map[type] ?? map.other;
}

function typeLabel(type: ProgramType, t: any) {
  const map: Record<ProgramType, string> = {
    lecture: t.mpLecture,
    halaqah: t.mpHalaqah,
    jumuah:  t.mpJumuah,
    other:   t.mpOther,
  };
  return map[type] ?? type;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00").toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

/* ─────────────────────────────────────────────────── */
/* Inline Add / Edit Modal                             */
/* ─────────────────────────────────────────────────── */
interface ModalProps {
  program: MosqueProgram | null;
  onClose: () => void;
  onSaved: (p: MosqueProgram) => void;
  t: any;
}

function ProgramModal({ program, onClose, onSaved, t }: ModalProps) {
  const { user } = useAuth();
  const isEdit = !!program;

  const [title,          setTitle]          = useState(program?.title ?? "");
  const [type,           setType]           = useState<ProgramType>(program?.program_type ?? "lecture");
  const [date,           setDate]           = useState(program?.program_date ?? new Date().toISOString().split("T")[0]);
  const [startTime,      setStartTime]      = useState(program?.start_time?.slice(0, 5) ?? "20:00");
  const [endTime,        setEndTime]        = useState(program?.end_time?.slice(0, 5) ?? "21:00");
  const [speaker,        setSpeaker]        = useState(program?.speaker ?? "");
  const [location,       setLocation]       = useState(program?.location ?? "");
  const [desc,           setDesc]           = useState(program?.description ?? "");
  const [isRecurring,    setIsRecurring]    = useState(program?.is_recurring ?? false);
  const [recurrenceNote, setRecurrenceNote] = useState(program?.recurrence_note ?? "");
  const [saving,         setSaving]         = useState(false);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const programTypes: { value: ProgramType; label: string }[] = [
    { value: "lecture", label: t.mpLecture },
    { value: "halaqah", label: t.mpHalaqah },
    { value: "jumuah",  label: t.mpJumuah  },
    { value: "other",   label: t.mpOther   },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !startTime || !endTime) return;

    // Date validation: prevent backdating
    const today = new Date().toISOString().split("T")[0];
    if (date < today) {
      toast.error(t.mpDateInPastError || "Program date cannot be in the past.");
      return;
    }

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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-border/60"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-surface border-b border-border/60 flex items-center justify-between px-5 py-4 z-10 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg hero-gradient flex items-center justify-center flex-shrink-0">
              {isEdit ? <Pencil size={12} className="text-white" /> : <Plus size={12} className="text-white" />}
            </div>
            <h2 className="font-bold text-text">{isEdit ? t.mpEditTitle : t.mpAddTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-text-muted hover:text-red-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldTitle}</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required autoFocus className="input w-full" placeholder="Kuliah Maghrib Harian" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldType}</label>
            <select value={type} onChange={e => setType(e.target.value as ProgramType)} className="input w-full">
              {programTypes.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldDate}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="input w-full" />
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldSpeaker}</label>
              <input value={speaker} onChange={e => setSpeaker(e.target.value)} className="input w-full" placeholder="Ustaz Ahmad" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldLocation}</label>
              <input value={location} onChange={e => setLocation(e.target.value)} className="input w-full" placeholder="Dewan Utama" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldDesc}</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className="input w-full resize-none" placeholder="Penerangan singkat..." />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="w-4 h-4 accent-primary rounded" />
            <span className="text-sm text-text">{t.mpFieldRecurring}</span>
          </label>
          {isRecurring && (
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{t.mpFieldRecurrenceNote}</label>
              <input value={recurrenceNote} onChange={e => setRecurrenceNote(e.target.value)} className="input w-full" placeholder="Setiap malam Ramadan" />
            </div>
          )}
          <button type="submit" disabled={saving}
            className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <><Loader2 size={16} className="animate-spin" /> {t.saving}</> : isEdit ? t.save : t.mpAddProgram}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── */
/* ProgramsManagementCard                              */
/* ─────────────────────────────────────────────────── */
export interface ProgramsManagementCardProps {
  programs: MosqueProgram[];
  onRefresh: () => void;
}

export default function ProgramsManagementCard({ programs, onRefresh }: ProgramsManagementCardProps) {
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<MosqueProgram | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<MosqueProgram | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  /* ── Toggle is_active ── */
  const handleToggle = async (prog: MosqueProgram) => {
    setTogglingId(prog.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("mosque_programs")
      .update({ is_active: !prog.is_active })
      .eq("id", prog.id);
    setTogglingId(null);
    if (error) toast.error(error.message);
    else onRefresh();
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!deletingProgram) return;
    const supabase = createClient();
    const { error } = await supabase.from("mosque_programs").delete().eq("id", deletingProgram.id);
    if (error) toast.error(error.message);
    else { toast.success(t.mpDeleted); onRefresh(); }
    setDeletingProgram(null);
  };

  const sorted = [...programs].sort((a, b) =>
    a.program_date === b.program_date
      ? a.start_time.localeCompare(b.start_time)
      : a.program_date.localeCompare(b.program_date)
  );

  return (
    <div className="card col-span-1 lg:col-span-2">
      {/* Card header */}
      <div className="flex items-center justify-between p-5 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <CalendarDays size={18} />
          </div>
          <div>
            <h2 className="font-bold text-text text-base">{t.adminPrograms}</h2>
            <p className="text-xs text-text-muted">{t.adminProgramsDesc}</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingProgram(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md"
        >
          <Plus size={14} /> {t.mpAddProgram}
        </button>
      </div>

      {/* Program list */}
      <div className="divide-y divide-border/50 max-h-[480px] overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-text-muted">
            <div className="w-12 h-12 rounded-xl bg-surface-alt border border-border flex items-center justify-center">
              <Radio size={20} className="text-text-muted/40" />
            </div>
            <p className="text-sm font-medium">{t.adminProgramsEmpty}</p>
          </div>
        ) : (
          sorted.map(prog => (
            <div
              key={prog.id}
              className={`flex items-center gap-3 px-5 py-3.5 hover:bg-surface-alt/30 transition-colors ${!prog.is_active ? "opacity-50" : ""}`}
            >
              {/* Date + type */}
              <div className="flex flex-col items-center w-14 flex-shrink-0 text-center">
                <span className="text-[10px] font-bold text-text-muted uppercase leading-none">
                  {new Date(prog.program_date + "T00:00").toLocaleDateString(undefined, { month: "short" })}
                </span>
                <span className="text-xl font-extrabold text-text leading-tight">
                  {new Date(prog.program_date + "T00:00").getDate()}
                </span>
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${typeColor(prog.program_type)}`}>
                    {typeLabel(prog.program_type, t)}
                  </span>
                  {!prog.is_active && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {t.mpInactive}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-text truncate">{prog.title}</p>
                {prog.speaker && (
                  <p className="text-xs text-text-muted truncate">{prog.speaker}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Toggle */}
                <button
                  onClick={() => handleToggle(prog)}
                  disabled={togglingId === prog.id}
                  className={`p-1.5 rounded-lg transition-colors ${
                    prog.is_active
                      ? "text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      : "text-gray-400 hover:bg-surface-alt"
                  }`}
                  title={prog.is_active ? "Deactivate" : "Activate"}
                >
                  {togglingId === prog.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : prog.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />
                  }
                </button>
                {/* Edit */}
                <button
                  onClick={() => { setEditingProgram(prog); setShowModal(true); }}
                  className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  title={t.edit}
                >
                  <Pencil size={14} />
                </button>
                {/* Delete */}
                <button
                  onClick={() => setDeletingProgram(prog)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title={t.delete}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <ProgramModal
          program={editingProgram}
          onClose={() => { setShowModal(false); setEditingProgram(null); }}
          onSaved={() => { setShowModal(false); setEditingProgram(null); onRefresh(); }}
          t={t}
        />
      )}

      {/* Delete confirm */}
      {deletingProgram && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setDeletingProgram(null)}
        >
          <div
            className="bg-surface rounded-2xl shadow-xl max-w-sm w-full border border-border/60"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <h2 className="font-bold text-text">{t.mpDeleteTitle}</h2>
              <button
                onClick={() => setDeletingProgram(null)}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-text-muted hover:text-red-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-text-secondary mb-2">{t.mpDeleteConfirm}</p>
              <p className="font-semibold text-text mb-5">"{deletingProgram.title}"</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingProgram(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary text-sm hover:bg-background transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
                >
                  {t.delete}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
