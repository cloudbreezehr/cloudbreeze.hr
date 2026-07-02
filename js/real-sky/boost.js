// ── Meteor-Shower Spawn Boost ──
// During a real annual meteor shower, shooting stars spawn more often —
// hardest at the peak night. The multiplier is read per spawn roll, so the
// calendar check is cached and refreshed on a coarse clock instead of being
// recomputed every frame.

import { activeMeteorShower } from "./astro.js";
import { defineConstants } from "../dev/registry.js";

const BOOST = defineConstants("realSky.shower", {
  SPAWN_BOOST_MAX: {
    value: 3,
    min: 0,
    max: 10,
    step: 0.5,
    description: "Extra spawn-rate multiplier at a shower's peak night",
  },
});

const REFRESH_MS = 300000;

let _cachedAt = -Infinity;
let _cachedBoost = 1;

/**
 * Multiplier for the shooting-star spawn chance: 1 outside shower season,
 * up to 1 + SPAWN_BOOST_MAX at a peak.
 */
export function shootingStarBoost(now = Date.now()) {
  if (now - _cachedAt > REFRESH_MS) {
    const shower = activeMeteorShower(new Date(now));
    _cachedAt = now;
    _cachedBoost = 1 + (shower ? shower.intensity * BOOST.SPAWN_BOOST_MAX : 0);
  }
  return _cachedBoost;
}

// Test hook — drop the cache so a new date takes effect immediately.
export function _resetBoostForTests() {
  _cachedAt = -Infinity;
  _cachedBoost = 1;
}
