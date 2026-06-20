// ── Theme & Sky Effects Audio Bridge ──
// Sounds the discrete, user-triggered effects of the themes and the sky —
// frost breath, a paper stroke, a snow-globe shake, a VHS glitch, and the
// star / shooting-star / constellation interactions — off the achievement
// events they already dispatch. Routed through the effects bus, so the active
// theme colours them. Passive background animations (drifting clouds, a
// jellyfish's pulse) are deliberately left silent — sounding them would be the
// ambient texture we removed.

import { playSfx } from "../sfx.js";

const EVENT_VOICE = {
  "frost-breath": "ice",
  "paper-stroke": "pencil",
  "snow-globe": "rattle",
  "vhs-glitch": "glitch",
  "star-clicked": "twinkle",
  "shooting-star-clicked": "starWhoosh",
  "constellation-formed": "chord",
  "constellation-wrong-hit": "dud",
};

export function initThemeEffectsAudioBridge() {
  function onAchievement(e) {
    const voice = EVENT_VOICE[(e.detail || {}).type];
    if (voice) playSfx(voice);
  }
  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
