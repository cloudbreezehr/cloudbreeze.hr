// ── Timestamp Formatting ──
// Pure helpers for turning timestamps into human strings.  Shared by any
// UI that displays "2m ago", "3d ago", or absolute dates — keeps a single
// source of truth so the style stays consistent across the site.

const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const WEEK_MS = 604800000;

/**
 * Relative time like "just now", "5m ago", "3h ago", "2d ago".  For
 * timestamps older than a week, falls back to an absolute short date
 * ("Feb 3") since "7d ago" rounds poorly at that age.
 */
export function formatRelativeTime(ts) {
  const delta = Date.now() - ts;
  if (delta < MINUTE_MS) return "just now";
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)}m ago`;
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)}h ago`;
  if (delta < WEEK_MS) return `${Math.floor(delta / DAY_MS)}d ago`;
  return formatAbsoluteDate(ts);
}

/** Long absolute form: "3 Feb 2026, 14:07". */
export function formatAbsoluteTime(ts) {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString("en", { month: "short" });
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

/** Short absolute form: "Feb 3". */
export function formatAbsoluteDate(ts) {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString("en", { month: "short" });
  return `${month} ${day}`;
}
