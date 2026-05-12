// ── Welcome Back ──
// One-shot greeting for returning users with progress.  Fires once per
// browser tab (sessionStorage gate): refresh = same session, new tab or
// reopened browser = fresh greeting.
//
// Contract: maybeShowWelcomeBack() shows the toast on init when the
// gates pass, after a brief settle delay so it lands after layout
// rather than mid-paint.  No interaction prerequisite — opening the
// tab is intent enough.

import { ACHIEVEMENTS } from "./registry.js";
import * as storage from "./storage.js";

// ── Constants ──
const SESSION_FLAG_KEY = "cloudlog-welcome-back-shown";

// Brief settle delay so the toast slides in after the page's initial
// layout/paint pass rather than fighting it.  Short enough to feel
// immediate.
const SETTLE_DELAY_MS = 600;

export function maybeShowWelcomeBack(showActivationToast) {
  if (typeof showActivationToast !== "function") return;

  let session = null;
  try {
    session = window.sessionStorage;
  } catch {
    return;
  }
  if (session.getItem(SESSION_FLAG_KEY)) return;

  if (!storage.isActive()) return;
  const unlockedCount = storage.getUnlocked().length;
  if (unlockedCount <= 0) return;
  const remaining = ACHIEVEMENTS.length - unlockedCount;
  if (remaining <= 0) return;

  // Mark the session as greeted up-front so a fast double-init (e.g.
  // hot-reload during dev, or two tabs racing) can't double-fire.
  try {
    session.setItem(SESSION_FLAG_KEY, "1");
  } catch {
    return;
  }

  setTimeout(() => {
    const noun = remaining === 1 ? "secret" : "secrets";
    showActivationToast(`Welcome back. ${remaining} ${noun} still hidden.`);
  }, SETTLE_DELAY_MS);
}

// Test hook — clear the session flag so a follow-up call to
// maybeShowWelcomeBack fires again.
export function _resetForTests() {
  try {
    window.sessionStorage.removeItem(SESSION_FLAG_KEY);
  } catch {
    // ignore — sessionStorage may be unavailable in some test envs
  }
}
