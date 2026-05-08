// ── Analytics Entry Point ──
// Public initializer.  Call this first in index.html so every bridge is
// attached before the site modules start dispatching their events.  The
// adapter defaults to the console logger — in production, pass a real
// vendor adapter to swap.
//
// initAnalytics() is idempotent and safe to call before DOMContentLoaded;
// the bridges only attach listeners, they don't read DOM state eagerly.

import { start, track, flush } from "./core.js";
import * as consent from "./consent.js";
import { initSessionBridge } from "./bridges/session.js";
import { initPageBridge } from "./bridges/page.js";
import { initCtaBridge } from "./bridges/cta.js";
import { initAchievementsBridge } from "./bridges/achievements.js";
import { initModesBridge } from "./bridges/modes.js";
import { initCanvasBridge } from "./bridges/canvas.js";
import { initThemeBridge } from "./bridges/theme.js";
import { initErrorsBridge } from "./bridges/errors.js";

// Bridges always attach, even when consent is denied.  They're cheap
// (listener registrations), and every track() call short-circuits
// inside core.js when consent is not allowed — so no events leak.
// Attaching unconditionally also means a user who flips the opt-out
// toggle at runtime starts getting their data recorded on the next
// interaction without a page reload.
export function initAnalytics(options = {}) {
  start({ adapter: options.adapter });
  initSessionBridge();
  initPageBridge();
  initCtaBridge();
  initAchievementsBridge();
  initModesBridge();
  initCanvasBridge();
  initThemeBridge();
  initErrorsBridge();
}

export { track, flush, consent };
