// ── Meteor-Shower Spawn Boost ──
// During a real annual meteor shower, shooting stars spawn more often —
// hardest at the peak night. The multiplier is read per spawn roll, so the
// calendar check is memoized on a coarse time grid instead of being
// recomputed every frame. The grid is anchored to the wall clock, not to
// when this window first asked: every window evaluates the same bucket for
// the same instant, so a multiplier that feeds a shared seeded schedule
// yields the same schedule everywhere.

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

// Single-entry memo. Callers query near-contiguous instants (a schedule scan
// spans far less than REFRESH_MS), so successive calls land in one bucket and
// hit. A caller sweeping times across bucket boundaries would thrash it — still
// correct (the boost is a pure function of the bucket), just recomputed.
let _cachedBucket = null;
let _cachedBoost = 1;

/**
 * Multiplier for the shooting-star spawn chance: 1 outside shower season,
 * up to 1 + SPAWN_BOOST_MAX at a peak. Constant across each grid bucket.
 */
export function shootingStarBoost(now = Date.now()) {
  const bucket = Math.floor(now / REFRESH_MS);
  if (bucket !== _cachedBucket) {
    const shower = activeMeteorShower(new Date(bucket * REFRESH_MS));
    _cachedBucket = bucket;
    _cachedBoost = 1 + (shower ? shower.intensity * BOOST.SPAWN_BOOST_MAX : 0);
  }
  return _cachedBoost;
}

// Test hook — drop the memo so a new date takes effect immediately.
export function _resetBoostForTests() {
  _cachedBucket = null;
  _cachedBoost = 1;
}
