/**
 * src/lib/utils.ts
 * Shared helpers used across the app.
 */

/** "17:00:00" → "5:00 PM" */
export function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? "PM" : "AM";
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${ampm}`;
}

/** Relative time string ("just now", "5 mins ago", etc.). */
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
