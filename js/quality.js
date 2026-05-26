// ── Hardware Quality Tier ──
// Coarse classification of the visitor's device based on navigator
// signals, so particle counts can scale down for low-end hardware
// without changing the design.  Thresholds are conservative — a
// device only drops to "low" when both cores AND memory are weak (or
// either is severely constrained); "high" requires both to be strong.
// Most visitors land in "mid", which uses the unmodified counts.

// Cores at-or-below this push toward "low" when memory is also weak.
const LOW_CORES = 4;
// Memory at-or-below this (in GB) pushes toward "low".
const LOW_MEMORY_GB = 4;
// Both signals must clear these thresholds to reach "high" — either
// alone isn't enough.
const HIGH_CORES = 8;
const HIGH_MEMORY_GB = 8;

// Multipliers applied to per-feature particle counts.  Low scales
// down meaningfully; high nudges up modestly — overdrawing on the
// best hardware doesn't make the site feel premium, just busy.
export const PARTICLE_SCALE = Object.freeze({
  low: 0.6,
  mid: 1.0,
  high: 1.15,
});

export function getQualityTier() {
  const cores = navigator.hardwareConcurrency || 0;
  const memGB = navigator.deviceMemory || 0;

  // Either signal alone, if severely constrained, drops to low.
  if (memGB > 0 && memGB <= LOW_MEMORY_GB / 2) return "low";
  if (cores > 0 && cores <= LOW_CORES && memGB > 0 && memGB <= LOW_MEMORY_GB) {
    return "low";
  }
  if (cores >= HIGH_CORES && memGB >= HIGH_MEMORY_GB) return "high";
  return "mid";
}
