// ── World Clock ──
// The fixed-timestep clock behind the shared sky. Windows never exchange
// time: the tick is derived from wall-clock milliseconds since the Unix
// epoch, so every window on the machine reads the same tick at the same
// instant by construction — a shared epoch with no negotiation, no leader,
// and no re-sync when windows open, close, or come back from hidden.
//
// Two views of the same clock:
//   worldTick()     — integer tick index. Discrete decisions (seeded spawn
//                     rolls) key off this so all windows make them
//                     identically.
//   worldTickTime() — fractional tick. Continuous motion samples this so
//                     animation stays smooth between tick boundaries and
//                     runs at the same world speed on every refresh rate.
//
// Not dev-tunable on purpose: a per-window tweak to the tick rate would
// silently split the shared world.

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Integer world tick at `nowMs` (defaults to the current wall clock). */
export function worldTick(nowMs = Date.now()) {
  return Math.floor(nowMs / TICK_MS);
}

/** Fractional world tick at `nowMs` — worldTick() plus sub-tick progress. */
export function worldTickTime(nowMs = Date.now()) {
  return nowMs / TICK_MS;
}

/** Wall-clock milliseconds at the start of `tick`. */
export function tickToMs(tick) {
  return tick * TICK_MS;
}
