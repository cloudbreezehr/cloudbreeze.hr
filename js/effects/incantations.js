// ── Incantations ──
// Secret words that, spelled out anywhere on the page (tapped or typed),
// fire a one-shot effect. Pure content + effect bindings: the letter input
// and matching are shared with the theme speller (spell-trigger.js), which
// merges these words into its single matcher — so there's no separate input
// plumbing here. Each effect handles reduced motion itself.

import { launchRocketFireworks, burstFireworks } from "./fireworks.js";
import { spawnRipple } from "./ripple.js";

const BOOM_ROCKETS = 3;
const PULSE_RINGS = 4;
const PULSE_MAX_SCALE = 14;
const PULSE_DURATION_MS = 1200;

// Where an effect originates: the cast point (the last tapped letter), or the
// upper-centre of the viewport when there's none (keyboard-typed casts).
function castPoint(point) {
  return point || { x: window.innerWidth / 2, y: window.innerHeight / 3 };
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
