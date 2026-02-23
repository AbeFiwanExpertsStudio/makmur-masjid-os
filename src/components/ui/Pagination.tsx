"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageContext";

interface PaginationProps {
  page: number;
  total: number;
  perPage: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, perPage, onChange }: PaginationProps) {
  const { t } = useLanguage();
  const totalPages = Math.ceil(total / perPage);

  if (totalPages <= 1) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  // Build visible page numbers with ellipsis
  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col items-center gap-3 mt-6 mb-2">
      {/* Showing x–y of total */}
      <p className="text-xs text-text-muted">
        {t.pageShowing(from, to, total)}
      </p>

      {/* Controls */}
      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary hover:bg-surface hover:text-text transition-colors"
        >
          <ChevronLeft size={14} />
          {t.pagePrev}
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-1">
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="w-8 text-center text-text-muted text-sm">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p as number)}
                className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                  p === page
                    ? "bg-primary text-white shadow-sm"
                    : "border border-border text-text-secondary hover:bg-surface hover:text-text"
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        {/* Next */}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary hover:bg-surface hover:text-text transition-colors"
        >
          {t.pageNext}
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
