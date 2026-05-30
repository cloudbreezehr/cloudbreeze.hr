// ── Timestamp Formatting ──
// Pure helpers for turning timestamps into human strings.  Shared by any
// UI that displays "2m ago", "3d ago", or absolute dates — keeps a single
// source of truth so the style stays consistent across the site.
//
// paintRelativeTime() also wires the element into a shared refresh loop
// so labels stay fresh during long sessions — without it, a "just now"
// rendered at unlock stays "just now" forever, even hours later.

const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const WEEK_MS = 604800000;

// Refresh cadence for the shared loop.  Once a minute would be the
// minimum granularity formatRelativeTime exposes; halving that keeps
// minute-edge transitions feeling responsive without churn.
const REFRESH_INTERVAL_MS = 30000;
// Namespaced to "relative" so the refresh selector below can't collide
// with other modules using a bare data-ts attribute on elements that
// carry richer child markup (e.g. the achievement-card-time block,
// which interleaves a leading text node with a progress span).
const TS_ATTR = "data-relative-ts";
const PREFIX_ATTR = "data-relative-ts-prefix";
let refreshTimer = null;

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

// Refresh every element that opted in via paintRelativeTime.  Driven
// off a single interval so N labels share one timer.
function refreshAll() {
  const els = document.querySelectorAll(`[${TS_ATTR}]`);
  if (els.length === 0) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    return;
  }
  for (const el of els) {
    const ts = parseInt(el.getAttribute(TS_ATTR), 10);
    if (Number.isNaN(ts)) continue;
    const prefix = el.getAttribute(PREFIX_ATTR) || "";
    el.textContent = `${prefix}${formatRelativeTime(ts)}`;
  }
}

/**
 * Paint a relative-time label on `el` and enroll it in the shared
 * refresh loop so the text stays current as wall-clock time advances.
 * Callers that need only a static snapshot can keep using
 * formatRelativeTime directly.
 */
export function paintRelativeTime(el, ts, prefix = "") {
  el.setAttribute(TS_ATTR, String(ts));
  if (prefix) el.setAttribute(PREFIX_ATTR, prefix);
  else el.removeAttribute(PREFIX_ATTR);
  el.textContent = `${prefix}${formatRelativeTime(ts)}`;
  if (!refreshTimer) {
    refreshTimer = setInterval(refreshAll, REFRESH_INTERVAL_MS);
  }
}

// Test hook — drop the shared timer so test runs don't leak intervals.
export function _resetForTests() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}
