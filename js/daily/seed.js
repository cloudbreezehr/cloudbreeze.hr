// ── Daily Seed ──
// Pure building blocks for the sky-of-the-day: a stable key for "today", a
// string hash, and a tiny deterministic PRNG. Everyone hashing the same key
// gets the same sequence — that's the whole feature.

// Local calendar date, so every visitor's sky turns over at their own
// midnight (like a daily puzzle, not a UTC server tick).
export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// FNV-1a, 32-bit — tiny, well-distributed, stable across platforms.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function hashString(str) {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

// Murmur3 finalizer constants — the avalanche step that makes the low bits
// of hashInts usable directly as a uniform value.
const FMIX_MUL_1 = 0x85ebca6b;
const FMIX_MUL_2 = 0xc2b2ae35;

const TWO_32 = 4294967296;

/**
 * Hash a list of numbers into one well-mixed 32-bit unsigned int. Each value
 * is folded in as two 32-bit halves, so inputs beyond 2^32 (world ticks) and
 * negative inputs (tile indices) stay distinct. Same inputs, same hash —
 * everywhere.
 */
export function hashInts(...values) {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const hi = Math.floor(v / TWO_32);
    hash = Math.imul(hash ^ (v >>> 0), FNV_PRIME);
    hash = Math.imul(hash ^ (hi >>> 0), FNV_PRIME);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, FMIX_MUL_1);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, FMIX_MUL_2);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

// Mulberry32 — a solid small PRNG; returns a () => [0, 1) function.
const MULBERRY_INCREMENT = 0x6d2b79f5;

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + MULBERRY_INCREMENT) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
