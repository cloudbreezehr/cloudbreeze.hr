// ── Discovery Audio Bridge ──
// Sounds the "getting warmer" moments off the achievement stream: a build-up
// tick whose pitch climbs as a theme nears its trigger, and a fanfare when the
// Konami code lands. Both are reward/feedback cues, so the fanfare plays dry;
// the build-up tick rides the effects bus (it's usually neutral — no theme has
// won yet — and takes any active theme's colour for free).

import { playSfx } from "../sfx.js";

export function initDiscoveryAudioBridge() {
  function onAchievement(e) {
    const d = e.detail || {};
    if (d.type === "theme-buildup" && d.phase === "activate") {
      // threshold is 0.25 / 0.5 / 0.75 — drive the rising tick pitch.
      playSfx("buildup", { progress: d.threshold });
    } else if (d.type === "konami-cheat") {
      playSfx("fanfare", { ui: true });
    }
  }
  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
