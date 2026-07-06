// ── Daily Arrangement Random ──
// The seeded random stream behind the sky's *arrangement* — star positions,
// sizes, which quadrant each constellation hides in. Seeded from today's
// key, so every visitor shares one sky per day and a fresh one appears at
// midnight; a `sky=<key>` URL parameter revisits any past day's arrangement.
//
// Per-frame randomness (twinkles, spawns, flashes) is NOT this stream —
// only the once-per-load layout draws from here. Lazily initialized so the
// first consumer, whichever module loads first, finds it ready.

import { dayKey, hashString, mulberry32 } from "./seed.js";
import { getParam } from "../url-params.js";

let _rand = null;
let _seedKey = null;

function ensure() {
  if (_rand) return;
  _seedKey = getParam("sky") ?? dayKey();
  _rand = mulberry32(hashString(_seedKey));
}

/** Next draw from the arrangement stream — a drop-in for Math.random(). */
export function arrangementRandom() {
  ensure();
  return _rand();
}

/** The key this page's arrangement was seeded from (today's, or the URL's). */
export function skySeedKey() {
  ensure();
  return _seedKey;
}

/** True when a URL seed points at a different day than today. */
export function isTimeTraveling() {
  ensure();
  return _seedKey !== dayKey();
}

// Test hook — forget the seed so the next call re-reads the URL and clock.
export function _resetForTests() {
  _rand = null;
  _seedKey = null;
}
