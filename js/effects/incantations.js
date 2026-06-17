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
import { screenShake } from "./screen-shake.js";
import { hueSweep } from "./hue-sweep.js";
import { lightningStrike } from "./lightning.js";
import { streak } from "./streak.js";
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

// ── QUAKE — screen shake ──
const QUAKE_AMPLITUDE = 8;
const QUAKE_AMP_PER_CHARGE = 3;
const QUAKE_MAX_CHARGE = 8;

// ── DISCO / RAINBOW — hue sweeps ──
const DISCO_TURNS = 3;
const DISCO_DURATION_MS = 2400;
const DISCO_SATURATE = 1.4;
const RAINBOW_DURATION_MS = 1800;

// ── STORM — staggered bolts + a rolling shake ──
const STORM_BOLTS = 2;
const STORM_SPREAD = 120;
const STORM_STAGGER_MS = 120;
const STORM_SHAKE = 6;
const STORM_SHAKE_PER_CHARGE = 2;
const STORM_MAX_CHARGE = 6;

// ── COMET — a lone diagonal streak ──
const COMET_ANGLE_RAD = Math.PI * 0.15; // down-and-to-the-right
const COMET_LENGTH = 220;
const COMET_TRAVEL = 560;
const COMET_DURATION_MS = 800;
const COMET_COLOR = "#bfe0ff";

// ── WARP — radial streaks from centre (lightspeed) ──
const WARP_COUNT = 16;
const WARP_PER_CHARGE = 4;
const WARP_MAX_CHARGE = 8;
const WARP_LENGTH = 180;
const WARP_TRAVEL = 700;
const WARP_DURATION_MS = 600;
const WARP_COLOR = "#cfe0ff";

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
  {
    word: "QUAKE",
    // The whole page shudders; QUAAAKE shakes harder.
    chargeChar: "A",
    chargeMax: () => QUAKE_MAX_CHARGE,
    cast: (origin, charge) =>
      screenShake({
        amplitude:
          QUAKE_AMPLITUDE +
          Math.min(charge || 0, QUAKE_MAX_CHARGE) * QUAKE_AMP_PER_CHARGE,
      }),
  },
  {
    word: "DISCO",
    // The whole page spins through the colour wheel a few times.
    cast: () =>
      hueSweep({
        turns: DISCO_TURNS,
        durationMs: DISCO_DURATION_MS,
        saturate: DISCO_SATURATE,
      }),
  },
  {
    word: "RAINBOW",
    // One smooth pass of the whole page through the spectrum.
    cast: () => hueSweep({ durationMs: RAINBOW_DURATION_MS }),
  },
  {
    word: "BOLT",
    // A lightning bolt cracks down to the cursor, with a flash.
    cast: (origin) => lightningStrike(origin.x, origin.y),
  },
  {
    word: "STORM",
    // Several staggered bolts, a flash, and a rolling shake; STOOORM rages.
    chargeChar: "O",
    chargeMax: () => STORM_MAX_CHARGE,
    cast: (origin, charge) => {
      const extra = Math.min(charge || 0, STORM_MAX_CHARGE);
      const bolts = STORM_BOLTS + extra;
      for (let i = 0; i < bolts; i++) {
        const x = origin.x + (Math.random() - 0.5) * 2 * STORM_SPREAD;
        setTimeout(
          () => lightningStrike(x, origin.y, { flash: i === 0 }),
          i * STORM_STAGGER_MS,
        );
      }
      screenShake({ amplitude: STORM_SHAKE + extra * STORM_SHAKE_PER_CHARGE });
    },
  },
  {
    word: "COMET",
    // A single bright streak arcs past the cursor.
    cast: (origin) =>
      streak({
        origin,
        angle: COMET_ANGLE_RAD,
        length: COMET_LENGTH,
        travel: COMET_TRAVEL,
        durationMs: COMET_DURATION_MS,
        color: COMET_COLOR,
      }),
  },
  {
    word: "WARP",
    // Streaks rip outward from centre like a jump to lightspeed; WAAARP launches
    // more.
    chargeChar: "A",
    chargeMax: () => WARP_MAX_CHARGE,
    cast: (origin, charge) =>
      streak({
        radial: true,
        count:
          WARP_COUNT + Math.min(charge || 0, WARP_MAX_CHARGE) * WARP_PER_CHARGE,
        length: WARP_LENGTH,
        travel: WARP_TRAVEL,
        durationMs: WARP_DURATION_MS,
        color: WARP_COLOR,
      }),
  },
];

// The collectible set for the "cast them all" achievement.
export const INCANTATION_WORDS = INCANTATIONS.map((inc) => inc.word);
