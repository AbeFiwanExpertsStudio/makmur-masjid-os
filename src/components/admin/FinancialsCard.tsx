"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/providers/LanguageContext";

interface Campaign {
  id: string;
  title: string;
  current_amount: number;
}

export default function FinancialsCard() {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCampaigns() {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("crowdfund_campaigns")
        .select("id, title, current_amount")
        .order("current_amount", { ascending: false });

      if (err) {
        setError(err.message);
      } else {
        setCampaigns(data ?? []);
      }
      setLoading(false);
    }
    fetchCampaigns();
  }, []);

  const totalCollected = campaigns.reduce((s, c) => s + Number(c.current_amount), 0);

  return (
    <div className="card p-6">
      <h2 className="font-bold text-lg text-text mb-4">{t.adminFinancials}</h2>

      {/* Total collected banner */}
      <div className="hero-gradient rounded-xl p-5 mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">
          {t.adminTotalCollected}
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-white/70">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <p className="text-3xl font-bold text-white">
            RM {totalCollected.toLocaleString()}
          </p>
        )}
      </div>

      {/* Error state */}
      {error && (
        <p className="text-red-500 dark:text-red-400 text-sm mb-3">{error}</p>
      )}

      {/* Per-campaign breakdown */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex justify-between items-center py-2 border-b border-dashed border-border last:border-0 animate-pulse"
            >
              <div className="h-3 w-40 bg-surface-alt rounded" />
              <div className="h-3 w-16 bg-surface-alt rounded" />
            </div>
          ))
        ) : campaigns.length === 0 ? (
          <p className="text-text-secondary text-sm">No campaigns yet.</p>
        ) : (
          campaigns.map((c) => (
            <div
              key={c.id}
              className="flex justify-between items-center text-sm py-2 border-b border-dashed border-border last:border-0"
            >
              <span className="text-text-secondary">{c.title}</span>
              <span className="font-bold text-text">
                RM {Number(c.current_amount).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
