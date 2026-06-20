// ── Theme & Sky Effects Audio Bridge ──
// Sounds the discrete, user-triggered effects of the themes and the sky —
// frost breath, a paper stroke, a snow-globe shake, a VHS glitch, and the
// star / shooting-star / constellation interactions. Passive background
// animations (drifting clouds, a jellyfish's pulse) are deliberately left
// silent — sounding them would be the ambient texture we removed.

import { eventVoiceBridge } from "./event-voice.js";

export const initThemeEffectsAudioBridge = eventVoiceBridge({
  "frost-breath": "ice",
  "paper-stroke": "pencil",
  "snow-globe": "rattle",
  "vhs-glitch": "glitch",
  "rain-thunder": "thunder",
  "star-clicked": "twinkle",
  "shooting-star-clicked": "starWhoosh",
  "constellation-formed": "chord",
  "constellation-wrong-hit": "dud",
});
