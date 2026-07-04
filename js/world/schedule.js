// ── World Schedule ──
// Deterministic event streams for the shared sky: every (seed, tile, tick)
// triple names one roll and one parameter stream, computable by any window
// with no messaging and no leader. A window that opens mid-flight replays
// the recent schedule and lands on exactly the state every other window is
// already showing.
//
// Two draws per event slot, deliberately separate: the roll decides *if*
// something happens this tick; the stream supplies *what* it looks like.
// Keeping them independent means reading parameters never perturbs the
// spawn cadence.

import { hashInts, mulberry32 } from "../daily/seed.js";

const TWO_32 = 4294967296;

// Salt distinguishing the parameter stream from the roll at the same slot.
const STREAM_SALT = 1;

/** Uniform [0, 1) roll for the event slot (seed, tile i/j, tick). */
export function tickRoll(seedHash, i, j, tick) {
  return hashInts(seedHash, i, j, tick) / TWO_32;
}

/** Deterministic parameter stream for the same slot — a () => [0, 1)
 *  drop-in, independent of the roll's value. */
export function tickStream(seedHash, i, j, tick) {
  return mulberry32(hashInts(seedHash, i, j, tick, STREAM_SALT));
}
