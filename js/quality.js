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

// ── Live FPS guard ──
// The startup tier reads hardware signals, which are imperfect — a
// capable laptop on battery saver throttles, a busy machine drops
// frames.  observeFps watches frame timing and, after a sustained dip,
// reports a downscale factor (<1) so the caller can shed cost; it
// reports 1 again once frames recover (hysteresis prevents one bad
// stretch from locking the page down permanently).  Today the factor's
// magnitude is a forward hook — the sole caller treats any value <1 as a
// boolean and sheds CSS-only decoration — but it's reported so a future
// consumer can scale particle counts proportionally.

// Below this FPS for SUSTAINED_MS → downscale.  Above the recover line
// for the same window → restore.  The gap is the hysteresis band.
const FPS_LOW = 40;
const FPS_RECOVER = 52;
const SUSTAINED_MS = 2000;
const DOWNSCALE = 0.7;

export function observeFps(onChange) {
  let last = performance.now();
  let belowSince = 0;
  let aboveSince = 0;
  let downscaled = false;
  let rafId = null;

  function tick(now) {
    const dt = now - last;
    last = now;
    // Ignore absurd gaps (tab was backgrounded) so a resume frame can't
    // trip the guard.
    if (dt > 0 && dt < 1000) {
      const fps = 1000 / dt;
      if (!downscaled) {
        if (fps < FPS_LOW) {
          if (belowSince === 0) belowSince = now;
          else if (now - belowSince >= SUSTAINED_MS) {
            downscaled = true;
            belowSince = 0;
            onChange(DOWNSCALE);
          }
        } else {
          belowSince = 0;
        }
      } else {
        if (fps > FPS_RECOVER) {
          if (aboveSince === 0) aboveSince = now;
          else if (now - aboveSince >= SUSTAINED_MS) {
            downscaled = false;
            aboveSince = 0;
            onChange(1);
          }
        } else {
          aboveSince = 0;
        }
      }
    }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);
  return () => {
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}
