// ── Welcome Back ──
// One-shot greeting for returning users with progress.  Two gates:
//   1. sessionStorage flag — at most one greeting per browser tab
//      (refresh = same session, new tab = fresh).
//   2. localStorage timestamp — at most one greeting per THROTTLE_MS
//      window across all tabs (so a workday doesn't get peppered).
//
// Contract: maybeShowWelcomeBack() shows the toast on init when both
// gates pass, after a brief settle delay so it lands after layout.
// markGreeted() stamps the throttle timestamp; the activation flow
// calls it whenever it shows its own greeting toast so activating /
// restoring Cloudlog also resets the throttle window.

import { ACHIEVEMENTS } from "./registry.js";
import * as storage from "./storage.js";

// ── Constants ──
const SESSION_FLAG_KEY = "cloudlog-welcome-back-shown";
const LAST_GREETED_KEY = "cloudlog-last-greeted";

// Minimum gap between greetings on the same device.
const THROTTLE_MS = 30 * 60 * 1000;

// Brief settle delay so the toast slides in after the page's initial
// layout/paint pass rather than fighting it.
const SETTLE_DELAY_MS = 600;

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

// Stamp the device-wide throttle.  Called when any greeting fires —
// the welcome-back toast itself, plus the activation/restore toasts
// that double as greetings.
export function markGreeted() {
  try {
    window.localStorage.setItem(LAST_GREETED_KEY, String(Date.now()));
  } catch {
    // ignore — localStorage may be unavailable
  }
}

export function maybeShowWelcomeBack(showActivationToast) {
  if (typeof showActivationToast !== "function") return;

  let session = null;
  try {
    session = window.sessionStorage;
  } catch {
    return;
  }
  if (session.getItem(SESSION_FLAG_KEY)) return;

  if (Date.now() - readLastGreeted() < THROTTLE_MS) return;

  if (!storage.isActive()) return;
  const unlockedCount = storage.getUnlocked().length;
  if (unlockedCount <= 0) return;
  const remaining = ACHIEVEMENTS.length - unlockedCount;
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
    const noun = remaining === 1 ? "secret" : "secrets";
    showActivationToast(`Welcome back. ${remaining} ${noun} still hidden.`);
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
