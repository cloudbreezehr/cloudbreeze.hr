import { defineConstants } from "../dev/registry.js";

// Pop-art loading-screen palette — flat, bold, hard-edged. The theme repaints
// the whole backdrop in these inks regardless of the site's light/dark
// appearance, so they live with the renderer rather than the per-appearance
// palette (the same arrangement the matrix rain uses for its greens).
export const WANTED_CREAM = "#f4ead3"; // halftone dots
export const WANTED_ORANGE = "#ff6a00"; // hot diagonal wedge
export const WANTED_TEAL = "#1aa6a0"; // corner block
export const WANTED_INK = "#101010"; // dark ground + outlines

export const WANTED = defineConstants("particles.wanted", {
  DOT_SPACING: {
    value: 40,
    min: 16,
    max: 80,
    step: 2,
    description: "Halftone grid cell size (px)",
  },
  DOT_R_MIN: {
    value: 0,
    min: 0,
    max: 12,
    step: 0.5,
    description: "Smallest halftone dot radius (px)",
  },
  DOT_R_MAX: {
    value: 9,
    min: 2,
    max: 30,
    step: 0.5,
    description: "Largest halftone dot radius (px)",
  },
  DOT_ALPHA: {
    value: 0.5,
    min: 0.1,
    max: 1,
    step: 0.05,
    description: "Halftone dot opacity (lower = softer on the eyes)",
  },
  TONE_EXP: {
    value: 1.6,
    min: 1,
    max: 4,
    step: 0.1,
    description: "Tonal falloff exponent (higher = more sparse area)",
  },
  SPRING: {
    value: 0.09,
    min: 0.01,
    max: 0.4,
    step: 0.01,
    description: "Pull back toward the dot's home cell",
  },
  FRICTION: {
    value: 0.85,
    min: 0.5,
    max: 0.99,
    step: 0.01,
    description: "Per-frame velocity damping",
  },
  REPEL_RADIUS: {
    value: 170,
    min: 30,
    max: 400,
    step: 10,
    description: "Click repulsion radius (px)",
  },
  REPEL_DAMPEN: {
    value: 1.0,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Click repulsion strength",
  },
  ATTRACT_RADIUS: {
    value: 170,
    min: 30,
    max: 400,
    step: 10,
    description: "Drag attraction radius (px)",
  },
  ATTRACT_STRENGTH: {
    value: 0.12,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Drag attraction force",
  },
  ATTRACT_TANGENT: {
    value: 0.7,
    min: 0,
    max: 2,
    step: 0.05,
    description: "Tangential orbit factor under drag",
  },
  // Backdrop panels — flat polygons drawn behind the dots. Fractions of the
  // viewport, so the composition holds at any size.
  WEDGE_TOP: {
    value: 0.58,
    min: 0,
    max: 1,
    step: 0.02,
    description: "Where the orange wedge meets the left edge (height frac)",
  },
  WEDGE_SKEW: {
    value: 0.22,
    min: -0.5,
    max: 0.5,
    step: 0.02,
    description: "Wedge rise across the width (height frac)",
  },
  TEAL_CORNER: {
    value: 0.34,
    min: 0,
    max: 0.8,
    step: 0.02,
    description: "Teal corner-block size (min-dimension frac)",
  },
  // Low-gravity cheat: the upward impulse given to every dot, which the spring
  // then reels back home.
  FLOAT_MIN: {
    value: 14,
    min: 0,
    max: 60,
    step: 1,
    description: "Min upward kick on the low-gravity cheat (px/frame)",
  },
  FLOAT_RANGE: {
    value: 22,
    min: 0,
    max: 60,
    step: 1,
    description: "Extra upward-kick range per dot",
  },
  FLOAT_SIDE: {
    value: 8,
    min: 0,
    max: 40,
    step: 1,
    description: "Sideways scatter on the low-gravity kick",
  },
  // Scroll drag: the field is nudged vertically with the scroll, above a dead
  // zone so a still or slow page leaves the halftone grid at rest.
  SCROLL_THRESHOLD: {
    value: 3,
    min: 0,
    max: 30,
    step: 0.5,
    description: "Min |scroll velocity| before the halftone field drifts",
  },
  SCROLL_FACTOR: {
    value: 0.06,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Vertical nudge per unit of scroll velocity",
  },
});
