// ── Incantations ──
// Secret words that, spelled out anywhere on the page (tapped or typed),
// fire a one-shot effect. Pure content + effect bindings: the letter input
// and matching are shared with the theme speller (spell-trigger.js), which
// merges these words into its single matcher — so there's no separate input
// plumbing here. Each effect handles reduced motion itself.

import { launchRocketFireworks, burstFireworks } from "./fireworks.js";
import { spawnRipple } from "./ripple.js";
import { prefersReducedMotion } from "../motion.js";

const BOOM_ROCKETS = 3;
const PULSE_RINGS = 4;
const PULSE_MAX_SCALE = 14;
const PULSE_DURATION_MS = 1200;
// Viewport-relative origin for keyboard casts (no tapped letter to anchor to):
// horizontally centred, in the upper third where bursts read best.
const FALLBACK_X_FRACTION = 0.5;
const FALLBACK_Y_FRACTION = 1 / 3;

// Where an effect originates: the cast point (the last tapped letter), or a
// viewport-relative fallback when there's none (keyboard-typed casts).
function castPoint(point) {
  return (
    point || {
      x: window.innerWidth * FALLBACK_X_FRACTION,
      y: window.innerHeight * FALLBACK_Y_FRACTION,
    }
  );
}

export const INCANTATIONS = [
  {
    word: "BOOM",
    cast: () => launchRocketFireworks({ count: BOOM_ROCKETS }),
  },
  {
    word: "STAR",
    cast: (point) => {
      const p = castPoint(point);
      burstFireworks(p.x, p.y);
    },
  },
  {
    word: "PULSE",
    cast: (point) => {
      // spawnRipple animates unconditionally, so gate it here — its siblings
      // (launchRocketFireworks / burstFireworks) already self-skip.
      if (prefersReducedMotion()) return;
      const p = castPoint(point);
      spawnRipple(p.x, p.y, {
        className: "incantation-ring",
        count: PULSE_RINGS,
        maxScale: PULSE_MAX_SCALE,
        duration: PULSE_DURATION_MS,
      });
    },
  },
];
