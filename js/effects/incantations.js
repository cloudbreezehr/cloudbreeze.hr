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
import { confettiBurst } from "./confetti.js";
import { screenFlash } from "./flash.js";
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

// ── DEPLOY — brand-blue rocket volley ("ship it") ──
const DEPLOY_ROCKETS = 4;
const DEPLOY_MAX_EXTRA = 30;
const DEPLOY_COLOR = "#5b9bf0";

// ── NOVA — a shockwave ring around a central burst ──
const NOVA_BASE_SCALE = 30;
const NOVA_SCALE_PER_CHARGE = 8;
const NOVA_MAX_CHARGE = 6;
const NOVA_RINGS = 2;
const NOVA_DURATION_MS = 900;

// ── CONFETTI / PARTY / SNOW — drifting pieces ──
const CONFETTI_BASE = 40;
const CONFETTI_PER_CHARGE = 14;
const CONFETTI_MAX_CHARGE = 10;
const PARTY_CONFETTI = 50;
const PARTY_ROCKETS = 3;
const SNOW_BASE = 30;
const SNOW_PER_CHARGE = 12;
const SNOW_MAX_CHARGE = 10;
const SNOW_COLORS = ["#ffffff", "#e8f4ff", "#cfe6ff"];
const SNOW_SWAY = 40;
const SNOW_SPIN = 120;
const SNOW_DURATION_MS = 3200;

// ── SUDO / GLOW — screen flashes ──
const SUDO_COLOR = "#ffffff";
const SUDO_PEAK = 0.55;
const SUDO_DURATION_MS = 320;
const GLOW_COLOR = "#5b9bf0";
const GLOW_PEAK = 0.3;
const GLOW_PEAK_PER_CHARGE = 0.08;
const GLOW_MAX_CHARGE = 5;
const GLOW_DURATION_MS = 700;

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
  {
    word: "DEPLOY",
    // Ship it. A brand-blue rocket volley; DEPLOOOY launches more.
    chargeChar: "O",
    chargeMax: () => DEPLOY_MAX_EXTRA,
    cast: (origin, charge) =>
      launchRocketFireworks({
        count: DEPLOY_ROCKETS + Math.min(charge || 0, DEPLOY_MAX_EXTRA),
        color: DEPLOY_COLOR,
      }),
  },
  {
    word: "NOVA",
    // A shockwave ring rips outward from a central burst; NOOOVA goes bigger.
    chargeChar: "O",
    chargeMax: () => NOVA_MAX_CHARGE,
    cast: (origin, charge) => {
      burstFireworks(origin.x, origin.y);
      if (prefersReducedMotion()) return;
      spawnRipple(origin.x, origin.y, {
        className: "incantation-ring",
        count: NOVA_RINGS,
        maxScale:
          NOVA_BASE_SCALE +
          Math.min(charge || 0, NOVA_MAX_CHARGE) * NOVA_SCALE_PER_CHARGE,
        duration: NOVA_DURATION_MS,
      });
    },
  },
  {
    word: "CONFETTI",
    // Rains across the top of the page; extra T's (CONFETTTTI) drop more.
    chargeChar: "T",
    chargeMax: () => CONFETTI_MAX_CHARGE,
    cast: (origin, charge) =>
      confettiBurst({
        count:
          CONFETTI_BASE +
          Math.min(charge || 0, CONFETTI_MAX_CHARGE) * CONFETTI_PER_CHARGE,
      }),
  },
  {
    word: "PARTY",
    // Confetti from the cursor plus a small rocket volley.
    cast: (origin) => {
      confettiBurst({ origin, count: PARTY_CONFETTI });
      launchRocketFireworks({ count: PARTY_ROCKETS });
    },
  },
  {
    word: "SNOW",
    // A gentle white flurry from the top; SNOOOW comes down heavier.
    chargeChar: "O",
    chargeMax: () => SNOW_MAX_CHARGE,
    cast: (origin, charge) =>
      confettiBurst({
        count:
          SNOW_BASE + Math.min(charge || 0, SNOW_MAX_CHARGE) * SNOW_PER_CHARGE,
        round: true,
        colors: SNOW_COLORS,
        sway: SNOW_SWAY,
        spin: SNOW_SPIN,
        durationMs: SNOW_DURATION_MS,
      }),
  },
  {
    word: "SUDO",
    // Superuser surge — a quick bright flash over the page.
    cast: () =>
      screenFlash({
        color: SUDO_COLOR,
        peak: SUDO_PEAK,
        durationMs: SUDO_DURATION_MS,
      }),
  },
  {
    word: "GLOW",
    // A soft bloom of light over the page; GLOOOW burns brighter.
    chargeChar: "O",
    chargeMax: () => GLOW_MAX_CHARGE,
    cast: (origin, charge) =>
      screenFlash({
        color: GLOW_COLOR,
        peak:
          GLOW_PEAK +
          Math.min(charge || 0, GLOW_MAX_CHARGE) * GLOW_PEAK_PER_CHARGE,
        durationMs: GLOW_DURATION_MS,
      }),
  },
];

// The collectible set for the "cast them all" achievement.
export const INCANTATION_WORDS = INCANTATIONS.map((inc) => inc.word);
