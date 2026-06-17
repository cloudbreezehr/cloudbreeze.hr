// ── Hue Sweep ──
// Rotates the whole page's hue for a moment — several fast turns (DISCO) or a
// single smooth pass (RAINBOW). Animates a filter on document.body so canvas
// and content shift together; no fill, so it clears itself. Skipped under
// reduced motion (a WAAPI animation isn't caught by the global CSS clamp).

import { prefersReducedMotion } from "../motion.js";

const DEFAULT_DURATION_MS = 1600;
const FULL_TURN_DEG = 360;
const DEFAULT_TURNS = 1;
const DEFAULT_SATURATE = 1;

export function hueSweep({
  turns = DEFAULT_TURNS,
  durationMs = DEFAULT_DURATION_MS,
  saturate = DEFAULT_SATURATE,
} = {}) {
  if (prefersReducedMotion()) return;
  const end = FULL_TURN_DEG * turns;
  document.body.animate(
    [
      { filter: `hue-rotate(0deg) saturate(${saturate})` },
      { filter: `hue-rotate(${end}deg) saturate(${saturate})` },
    ],
    { duration: durationMs, easing: "linear" },
  );
}
