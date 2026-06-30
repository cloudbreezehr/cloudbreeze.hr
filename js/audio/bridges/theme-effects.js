// ── Theme & Sky Effects Audio Bridge ──
// Sounds the discrete, user-triggered effects of the themes and the sky —
// frost breath, a paper stroke, a VHS glitch, and the star / shooting-star /
// constellation interactions. Passive background animations (drifting clouds, a
// jellyfish's pulse) are deliberately left silent — sounding them would be the
// ambient texture we removed.
//
// The snow-globe shake is intentionally absent: its `snow-globe` event fires on
// any shake-scroll (so the achievement is reachable without frozen), but the
// rattle is the sound of the flakes bursting — so frozen.js plays it at the
// source only when that visual actually renders, not from this event.

import { eventVoiceBridge } from "./event-voice.js";

export const initThemeEffectsAudioBridge = eventVoiceBridge({
  "frost-breath": "ice",
  "paper-stroke": "pencil",
  "vhs-glitch": "glitch",
  "rain-thunder": "thunder",
  "star-clicked": "twinkle",
  "shooting-star-clicked": "starWhoosh",
  "constellation-formed": "chord",
  "constellation-wrong-hit": "dud",
  "matrix-click": "glyph",
  "matrix-decode": "decode",
  "upside-down-click": "wobble",
});
