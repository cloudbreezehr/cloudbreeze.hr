// ── Incantations ──
// Secret words that, spelled out anywhere on the page (tapped or typed),
// fire a one-shot effect. Pure content + effect bindings: the letter input
// and matching are shared with the theme speller (spell-trigger.js), which
// merges these words into its single matcher — so there's no separate input
// plumbing here. Each `cast(origin, charge)` receives a resolved { x, y }
// anchored to the cursor by the speller (an effect that scatters on its own,
// like BOOM's rockets, ignores it) plus a charge: extra repeats of the word's
// `chargeChar`, if it declares one (the surplus O's in BOOOOM). Each effect
// handles reduced motion itself.

import { launchRocketFireworks, burstFireworks } from "./fireworks.js";
import { spawnRipple } from "./ripple.js";
import { defineConstants } from "../dev/registry.js";
import { prefersReducedMotion } from "../motion.js";

// Dev-tunable so the BOOOOM payoff can be dialled in live in the dev console —
// the reward scales with how many O's the user bothered to enter.
const BOOM = defineConstants("incantations.boom", {
  ROCKETS: {
    value: 3,
    min: 1,
    max: 30,
    step: 1,
    description: "Base rockets fired by BOOM",
  },
  MAX_EXTRA: {
    value: 50,
    min: 0,
    max: 200,
    step: 5,
    description: "Max extra rockets from surplus O's (BOOOOM)",
  },
});
const PULSE_RINGS = 4;
const PULSE_MAX_SCALE = 14;
const PULSE_DURATION_MS = 1200;

export const INCANTATIONS = [
  {
    word: "BOOM",
    // Rockets rise from the bottom and scatter, so the origin is irrelevant.
    // Each extra O charges another rocket (BOOOOM > BOOM), up to a cap — read
    // live so the dev-console MAX_EXTRA slider also bounds the cursor buildup.
    chargeChar: "O",
    chargeMax: () => BOOM.MAX_EXTRA,
    cast: (origin, charge) =>
      launchRocketFireworks({
        count: BOOM.ROCKETS + Math.min(charge || 0, BOOM.MAX_EXTRA),
      }),
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
