"use client";
/**
 * GigCompletionCard — isolated from AdminPage so its 1-second
 * setInterval does NOT force the entire admin page to re-render.
 */
import { useState, useEffect } from "react";
import { Award, CheckCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/utils";
import { toast } from "react-hot-toast";
import Link from "next/link";

export type GigEntry = {
  id: string;
  title: string;
  gig_date: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  completed_at: string | null;
};

interface Props {
  gigs: GigEntry[];
  onRefresh: () => void;
}

export default function GigCompletionCard({ gigs, onRefresh }: Props) {
  const { t } = useLanguage();

  // Timer lives HERE — only this component re-renders every second
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Derived: filter to past gigs, dedup, sort completed to bottom
  const pastGigs = gigs.filter((g) => {
    const gigEnd = new Date(`${g.gig_date}T${g.end_time}`);
    return gigEnd < currentTime;
  });

  const seen = new Set<string>();
  const uniquePastGigs = pastGigs.filter((g) => {
    const key = `${g.title}|${g.gig_date}|${g.start_time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const visibleGigs = uniquePastGigs
    .filter((g) => {
      if (!g.is_completed) return true;
      if (!g.completed_at) return false;
      return currentTime.getTime() - new Date(g.completed_at).getTime() < 12 * 60 * 60 * 1000;
    })
    .sort((a, b) => {
      if (a.is_completed && !b.is_completed) return 1;
      if (!a.is_completed && b.is_completed) return -1;
      return 0;
    });

  const handleCompleteGig = async (gigId: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("complete_gig", { p_gig_id: gigId });
      if (error) {
        toast.error(`Failed: ${error.message}`);
      } else {
        toast.success("Gig completed! Points awarded to volunteers.");
        onRefresh();
      }
    } catch {
      toast.error("An unexpected error occurred.");
    }
  };

  return (
    <div className="card p-6 relative">
      <div className="flex justify-between items-start mb-2">
        <h2 className="font-bold text-lg text-text">{t.adminGigCompletion}</h2>
        <Link href="/admin/gigs" className="text-xs font-bold text-primary hover:text-primary-dark transition-colors border max-w-fit px-2 py-1 rounded-md border-primary/20 bg-primary/5 hover:bg-primary/10">
          Gig Details &raquo;
        </Link>
      </div>
      <p className="text-sm text-text-muted mb-4">{t.adminGigCompletionDesc}</p>

      {visibleGigs.length > 0 ? (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {visibleGigs.map((g) => (
            <div
              key={g.id}
              className={`flex justify-between items-center bg-background border rounded-xl px-4 py-3 transition-all duration-500 ${
                g.is_completed
                  ? "border-primary/30 bg-primary-50/30 dark:bg-primary/5 opacity-70"
                  : "border-border"
              }`}
            >
              <div>
                <span
                  className={`text-sm font-medium ${
                    g.is_completed ? "text-text-muted line-through" : "text-text"
                  }`}
                >
                  {g.title}
                </span>
                <span className="text-xs text-text-muted block">
                  {new Date(g.gig_date).toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {formatTime(g.start_time)} – {formatTime(g.end_time)}
                </span>
              </div>

              {g.is_completed ? (
                <div className="flex flex-col items-end gap-1">
                  <span className="badge bg-primary-50 text-primary border border-primary/20 text-xs">
                    <CheckCircle size={12} /> {t.adminAwardedLabel}
                  </span>
                  {g.completed_at &&
                    (() => {
                      const remainMs =
                        12 * 60 * 60 * 1000 -
                        (currentTime.getTime() - new Date(g.completed_at).getTime());
                      const totalSec = Math.max(0, Math.floor(remainMs / 1000));
                      const h = Math.floor(totalSec / 3600);
                      const m = Math.floor((totalSec % 3600) / 60);
                      const s = totalSec % 60;
                      return (
                        <span className="text-[10px] text-text-muted font-mono">
                          {t.adminClearsIn(h, m, s)}
                        </span>
                      );
                    })()}
                </div>
              ) : (
                <button
                  onClick={() => handleCompleteGig(g.id)}
                  className="badge bg-primary-50 text-primary border border-[#D5F5E3] hover:bg-[#D5F5E3] hover:scale-105 active:scale-95 transition-all text-xs"
                >
                  <Award size={12} /> {t.adminCompleteAward}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted text-center py-6">{t.adminNoPastGigs}</p>
      )}
    </div>
  );
}
