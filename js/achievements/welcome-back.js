// ── Welcome Back ──
// One-shot greeting for returning users with progress.  Two gates:
//   1. sessionStorage flag — at most one greeting per browser tab.
//      Refresh = same session; new tab = fresh.
//   2. localStorage timestamp — at most one greeting per THROTTLE_MS
//      window across all tabs.
//
// Contract: maybeShowWelcomeBack() shows the toast on init when both
// gates pass, after a brief settle delay so it lands after layout.
// markGreeted() is the public hook for stamping the throttle from
// other code paths that show their own greeting toast — keeping every
// greeting under the same throttle.

import { getReachableAchievements } from "./registry.js";
import { resolveProgressCurrent, resolveProgressTotal } from "./progress.js";
import * as storage from "./storage.js";

// ── Constants ──
const SESSION_FLAG_KEY = "cloudlog-welcome-back-shown";
const LAST_GREETED_KEY = "cloudlog-last-greeted";

// Minimum gap between greetings on the same device.  Tuned short
// because the toast is small and fleeting — multi-tab churn is rare,
// so erring toward "show it" beats erring toward "hide it".
export const THROTTLE_MS = 30 * 60 * 1000;

// Brief settle delay so the toast slides in after the page's initial
// layout/paint pass rather than fighting it.
export const SETTLE_DELAY_MS = 600;

function readLastGreeted() {
  try {
    const raw = window.localStorage.getItem(LAST_GREETED_KEY);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

// Stamp the device-wide throttle.  Call from any greeting code path
// to keep every greeting under the same throttle.
export function markGreeted() {
  try {
    window.localStorage.setItem(LAST_GREETED_KEY, String(Date.now()));
  } catch {
    // ignore — localStorage may be unavailable
  }
}

// The reachable, non-hidden, started-but-unfinished achievement closest to
// done — a more actionable nudge than a raw remaining count. Hidden ones are
// skipped so the greeting never spoils a "???" secret.
function nearestProgress() {
  let best = null;
  for (const a of getReachableAchievements()) {
    if (!a.progressKey || a.hidden || storage.isUnlocked(a.id)) continue;
    const total = resolveProgressTotal(a.progressKey);
    const current = Math.min(resolveProgressCurrent(a.progressKey), total);
    if (total <= 0 || current <= 0 || current >= total) continue;
    const ratio = current / total;
    if (!best || ratio > best.ratio) best = { ach: a, current, total, ratio };
  }
  return best;
}

export function maybeShowWelcomeBack(showActivationToast) {
  if (typeof showActivationToast !== "function") return;

  let session;
  try {
    session = window.sessionStorage;
  } catch {
    return;
  }
  if (session.getItem(SESSION_FLAG_KEY)) return;

  if (Date.now() - readLastGreeted() < THROTTLE_MS) return;

  if (!storage.isActive()) return;
  // Count against what this device can earn, so the "still hidden" tally never
  // strands a touch user above a total they can't actually reach.
  const reachable = getReachableAchievements();
  const reachableIds = new Set(reachable.map((a) => a.id));
  const unlockedCount = storage
    .getUnlocked()
    .filter((u) => reachableIds.has(u.id)).length;
  if (unlockedCount <= 0) return;
  const remaining = reachable.length - unlockedCount;
  if (remaining <= 0) return;

  // Mark the session greeted up-front so a fast double-init (hot
  // reload, racing tabs) can't double-fire.
  try {
    session.setItem(SESSION_FLAG_KEY, "1");
  } catch {
    return;
  }
  markGreeted();

  setTimeout(() => {
    // Prefer pointing at the nearest in-progress achievement; fall back to the
    // raw remaining count when nothing's mid-flight.
    const near = nearestProgress();
    if (near) {
      showActivationToast(
        `Welcome back. Closest: ${near.ach.title} (${near.current}/${near.total}).`,
      );
    } else {
      const noun = remaining === 1 ? "secret" : "secrets";
      showActivationToast(`Welcome back. ${remaining} ${noun} still hidden.`);
    }
  }, SETTLE_DELAY_MS);
}

// Test hook — clear both gates so a follow-up call fires again.
export function _resetForTests() {
  try {
    window.sessionStorage.removeItem(SESSION_FLAG_KEY);
  } catch {
    // ignore
  }
  try {
    window.localStorage.removeItem(LAST_GREETED_KEY);
  } catch {
    // ignore
  }
}
