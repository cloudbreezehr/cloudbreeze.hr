// ── Incantations ──
// Secret words that, spelled out anywhere on the page (tapped or typed),
// fire a one-shot effect. Pure content + effect bindings: the letter input
// and matching are shared with the theme speller (spell-trigger.js), which
// merges these words into its single matcher — so there's no separate input
// plumbing here. Each `cast(origin)` receives a resolved { x, y } anchored to
// the cursor by the speller; an effect that scatters on its own (BOOM's
// rockets) simply ignores it. Each effect handles reduced motion itself.

import { launchRocketFireworks, burstFireworks } from "./fireworks.js";
import { spawnRipple } from "./ripple.js";
import { prefersReducedMotion } from "../motion.js";

const BOOM_ROCKETS = 3;
const PULSE_RINGS = 4;
const PULSE_MAX_SCALE = 14;
const PULSE_DURATION_MS = 1200;

export const INCANTATIONS = [
  {
    word: "BOOM",
    // Rockets rise from the bottom and scatter, so the origin is irrelevant.
    cast: () => launchRocketFireworks({ count: BOOM_ROCKETS }),
  },
  {
    word: "STAR",
    cast: (origin) => burstFireworks(origin.x, origin.y),
  },
  {
    word: "PULSE",
    cast: (origin) => {
      // spawnRipple animates unconditionally, so gate it here — its siblings
      // (launchRocketFireworks / burstFireworks) already self-skip.
      if (prefersReducedMotion()) return;
      spawnRipple(origin.x, origin.y, {
        className: "incantation-ring",
        count: PULSE_RINGS,
        maxScale: PULSE_MAX_SCALE,
        duration: PULSE_DURATION_MS,
      });
    },
  },
];
