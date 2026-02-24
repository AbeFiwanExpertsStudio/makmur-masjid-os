/**
 * src/lib/utils.ts
 * Shared helpers used across the app — import from here, not inline.
 */

// ── Async delay ────────────────────────────────────────────
/** Pause execution for `ms` milliseconds. */
export const waitMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ── Date / Time formatting ──────────────────────────────────
/** "17:00:00" → "5:00 PM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? "PM" : "AM";
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${ampm}`;
}

/** Relative time string ("just now", "5 mins ago", etc.). Pass the `t` translations object. */
export function timeAgo(dateStr: string, t: {
  justNow: string;
  minAgo: (m: number) => string;
  hrsAgo: (h: number) => string;
  yesterday: string;
  daysAgo: (d: number) => string;
}): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minAgo(mins);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t.hrsAgo(hrs);
  const days = Math.floor(hrs / 24);
  return days === 1 ? t.yesterday : t.daysAgo(days);
}

// ── Number formatting ───────────────────────────────────────
/** "1200.5" → "RM 1,200.50" */
export function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ── String helpers ──────────────────────────────────────────
/** Truncate a string to `maxLen` chars, adding "…" if needed. */
export function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + "…";
}

/** UUID v4 short display (first 8 chars, upper-cased). */
export function shortId(uuid: string): string {
  return uuid.slice(0, 8).toUpperCase();
}

// ── Class name helper ──────────────────────────────────────
/** Conditionally join class strings, filtering falsy values. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
