// ── Sky Narration ──
// Flavor prose for screen-reader users. The canvas and its themes are
// aria-hidden decoration; these lines are the parallel experience — a
// sentence of atmosphere instead of a bare "<theme> activated". Pure data
// + lookups; the announcer's caller decides when to speak.

import { getTheme } from "./themes/registry.js";
import { INCANTATIONS } from "./effects/incantations.js";

const THEME_ENTER = {
  frozen: "The air turns cold. Frost creeps across the page.",
  "deep-sea": "You sink beneath the surface. The deep glows around you.",
  blocky: "Reality drops to a lower resolution.",
  rainy: "The clouds open. Rain streaks down the glass.",
  paper: "The world flattens into pencil on paper.",
  vhs: "Tracking lost. The tape hisses and rolls.",
  "upside-down": "The world flips. Everything hangs from its floor.",
  constellation: "The sky sharpens. Stars align into figures.",
  matrix: "Green code rains down through the dark.",
  wanted: "Sirens. Halftone ink floods the streets. You're wanted.",
};

const THEME_EXIT = {
  frozen: "The ice recedes. The page thaws.",
  "deep-sea": "You surface. Daylight again.",
  blocky: "Resolution restored.",
  rainy: "The rain passes. The glass dries.",
  paper: "The sketch fades. The page clears.",
  vhs: "The cassette ejects. The picture steadies.",
  "upside-down": "The world rights itself.",
  constellation: "The figures scatter back into ordinary stars.",
  matrix: "The code stops falling. Reality reloads.",
  wanted: "The heat dies down. The ink drains away.",
};

const COMBO_LINES = {
  "cryo-code": "Two skies fuse — frost over falling code. Cryo-Code.",
  "signal-noir":
    "Two skies fuse — a rain-wet broadcast at midnight. Signal Noir.",
  storyboard: "Two skies fuse — inked panels, pulp-orange accents. Storyboard.",
};

// Fallbacks keep future themes announced even before they get prose.
export function themeEnterLine(id) {
  return THEME_ENTER[id] || `${getTheme(id)?.label || id} theme activated`;
}

export function themeExitLine(id) {
  return THEME_EXIT[id] || `${getTheme(id)?.label || id} theme deactivated`;
}

export function comboLine(id) {
  return COMBO_LINES[id] || null;
}

/** "BOOM. A volley of fireworks rockets." — the spell's own hint as prose. */
export function incantationLine(word) {
  const inc = INCANTATIONS.find((i) => i.word === word);
  return inc ? `${inc.word}. ${inc.hint}.` : null;
}
