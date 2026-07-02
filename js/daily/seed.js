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
