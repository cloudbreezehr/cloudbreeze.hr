// ── Hue Sweep ──
// Rotates the sky's hue for a moment — several fast turns (DISCO) or a single
// smooth pass (RAINBOW). Animates the `filter` on the background canvas rather
// than `body`: a non-`none` filter on `body` would make it the containing block
// for every fixed overlay, which would then lurch by the scroll offset for the
// sweep's duration. No fill, so it reverts to whatever filter the active theme
// set. Skipped under reduced motion (a WAAPI animation isn't caught by the
// global CSS clamp).

import { prefersReducedMotion } from "../motion.js";
import { playSfx } from "../audio/sfx.js";

const DEFAULT_DURATION_MS = 1600;
const FULL_TURN_DEG = 360;
const DEFAULT_TURNS = 1;
const DEFAULT_SATURATE = 1;
const SKY_SELECTOR = "#bg-canvas";

export function hueSweep({
  turns = DEFAULT_TURNS,
  durationMs = DEFAULT_DURATION_MS,
  saturate = DEFAULT_SATURATE,
  sound = "sweep",
} = {}) {
  if (prefersReducedMotion()) return;
  const sky = document.querySelector(SKY_SELECTOR);
  if (!sky) return;
  playSfx(sound);
  const end = FULL_TURN_DEG * turns;
  sky.animate(
    [
      { filter: `hue-rotate(0deg) saturate(${saturate})` },
      { filter: `hue-rotate(${end}deg) saturate(${saturate})` },
    ],
    { duration: durationMs, easing: "linear" },
  );
}
