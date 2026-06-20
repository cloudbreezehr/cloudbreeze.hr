// ── UI Audio Bridge ──
// Subtle chrome feedback off the achievement stream. Plays dry (ui: true) —
// these are interface cues, not part of the themed world: a tonal tick when the
// appearance preference changes (pitched by where it sits on the dark→light
// axis), and a whoosh when the Cloudlog panel opens. The panel's close whoosh
// is hooked in closePanel (there's no close event to ride).

import { playSfx } from "../sfx.js";

// Dark → low tick, light → high tick, auto → in between.
const APPEARANCE_PITCH = { dark: 0, auto: 0.5, light: 1 };

export function initUiAudioBridge() {
  function onAchievement(e) {
    const d = e.detail || {};
    if (d.type === "appearance-change") {
      playSfx("uiTick", {
        ui: true,
        progress: APPEARANCE_PITCH[d.appearance] ?? 0.5,
      });
    } else if (d.type === "panel-open") {
      playSfx("panelOpen", { ui: true });
    }
  }
  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
