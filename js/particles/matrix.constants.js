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
});
