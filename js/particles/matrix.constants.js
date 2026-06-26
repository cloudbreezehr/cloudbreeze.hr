import { defineConstants } from "../dev/registry.js";

// The glyph alphabet — half-width katakana, digits, and a few symbols: the
// classic "digital rain" character set.
export const MATRIX_GLYPHS =
  "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖ0123456789:.=*+<>".split("");

// Intrinsic rain colours — Matrix is green whatever the appearance, so these
// live with the renderer rather than the per-appearance palette.
export const MATRIX_BG = "#020c05"; // dark backdrop the trail fades toward
export const MATRIX_HEAD = "#d8ffe4"; // bright leading glyph
export const MATRIX_TRAIL = "#33d96a"; // green trail / still-field glyphs
export const MATRIX_BRIGHT = "#ffffff"; // pointer/surge/decode highlight

// Hidden phrases a column occasionally resolves into, then scrambles back.
export const MATRIX_MESSAGES = [
  "WAKE UP",
  "KNOCK KNOCK",
  "THE ONE",
  "CLOUDBREEZE",
];

export const MATRIX = defineConstants("particles.matrix", {
  GLYPH_SIZE: {
    value: 16,
    min: 8,
    max: 36,
    step: 1,
    description: "Glyph cell size (px)",
  },
  FALL_MIN: {
    value: 4,
    min: 0.5,
    max: 20,
    step: 0.5,
    description: "Min column fall speed (px/frame)",
  },
  FALL_RANGE: {
    value: 7,
    min: 0,
    max: 30,
    step: 0.5,
    description: "Extra fall speed per column",
  },
  FADE_ALPHA: {
    value: 0.09,
    min: 0.02,
    max: 0.4,
    step: 0.01,
    description: "Per-frame trail fade (higher = shorter trails)",
  },
  MUTATE_CHANCE: {
    value: 0.04,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Per-step chance a column's glyph flickers to another",
  },
  HEAD_GLOW: {
    value: 6,
    min: 0,
    max: 24,
    step: 1,
    description: "Head-glyph glow blur (px)",
  },
  // Under reduced motion the rain doesn't fall; we paint a still field this
  // dense (fraction of each column filled) so the theme still reads as Matrix.
  STILL_FILL: {
    value: 0.45,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Reduced-motion still-field density",
  },

  // ── Pointer reactivity ──
  REACT_RADIUS: {
    value: 120,
    min: 0,
    max: 400,
    step: 10,
    description: "Radius around the pointer the rain reacts within (px)",
  },
  REACT_SPEED_BASE: {
    value: 1.5,
    min: 0,
    max: 6,
    step: 0.5,
    description: "Immediate fall-speed boost at the pointer on press (atop 1×)",
  },
  REACT_SPEED_BOOST: {
    value: 1.5,
    min: 0,
    max: 6,
    step: 0.5,
    description: "Extra fall-speed boost ramped in by holding",
  },
  REACT_GLOW: {
    value: 14,
    min: 0,
    max: 40,
    step: 1,
    description: "Glow blur on heads lit by the pointer or a surge (px)",
  },

  // ── Click surge ──
  SURGE_SPEED: {
    value: 0.6,
    min: 0.1,
    max: 2,
    step: 0.05,
    description: "Surge-ring expansion speed (px/ms)",
  },
  SURGE_BAND: {
    value: 70,
    min: 10,
    max: 200,
    step: 5,
    description: "Thickness of the surge ring that lights heads (px)",
  },
  SURGE_MAX: {
    value: 360,
    min: 60,
    max: 1000,
    step: 20,
    description: "Surge-ring radius at which it expires (px)",
  },
  SURGE_POOL: {
    value: 6,
    min: 1,
    max: 24,
    step: 1,
    description: "Max concurrent click surges",
  },

  // ── Decode ──
  DECODE_REVEAL_MS: {
    value: 550,
    min: 0,
    max: 2000,
    step: 50,
    description: "Time for a hidden word's letters to resolve in",
  },
  DECODE_HOLD_MS: {
    value: 1700,
    min: 200,
    max: 6000,
    step: 100,
    description: "How long a decoded word stays readable",
  },
  DECODE_DISSOLVE_MS: {
    value: 650,
    min: 0,
    max: 2000,
    step: 50,
    description: "Time for a decoded word to scramble back",
  },
  DECODE_CLICK_CHANCE: {
    value: 0.01,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Chance a click in the rain triggers a decode",
  },
});
