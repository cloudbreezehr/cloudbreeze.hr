// ── Theme Bridge ──
// Translates theme-change CustomEvents into analytics events with a
// per-session toggle counter.  The "via" field distinguishes click from
// other sources; the site currently only has the click path, but the
// field is future-proof for a shortcut.

import { track } from "../core.js";

export function initThemeBridge() {
  let togglesInSession = 0;
  let previousTheme = null;

  window.addEventListener("achievement", (e) => {
    const d = e.detail || {};
    if (d.type !== "theme-change") return;
    togglesInSession++;
    track("theme_toggle", {
      from: previousTheme,
      to: d.theme || null,
      via: "click",
      toggles_in_session: togglesInSession,
    });
    previousTheme = d.theme || null;
  });
}
