// ── Appearance Bridge ──
// Translates appearance-change CustomEvents into analytics events with
// a per-session toggle counter.  The "via" field distinguishes click
// from other sources; the site currently only has the click path, but
// the field is future-proof for a shortcut.

import { track } from "../core.js";

export function initAppearanceBridge() {
  let togglesInSession = 0;
  let previousAppearance = null;

  window.addEventListener("achievement", (e) => {
    const d = e.detail || {};
    if (d.type !== "appearance-change") return;
    togglesInSession++;
    track("appearance_toggle", {
      from: previousAppearance,
      to: d.appearance || null,
      via: "click",
      toggles_in_session: togglesInSession,
    });
    previousAppearance = d.appearance || null;
  });
}
