// ── Scribble-to-Clear ──
// Rapidly scribbling the pointer back and forth (many quick horizontal
// reversals) clears every active theme at once — the touch/mouse counterpart
// to the keyboard's double-Escape lights-out. Like lights-out it clears
// silently (a bulk panic-wipe, not a deliberate single-theme exit) and only
// acts when a theme is active. Requires a held button/finger and is
// horizontal-only, so idle mouse drift and vertical scroll-drags never trip
// it; and it yields to a drag-capturing theme (paper) only when that's the
// only thing active, so scribbling a lone drawing draws instead of wiping —
// but a scrub over a stack still clears everything, paper included.

import { getThemes, toggleTheme } from "./registry.js";

// Tuned to demand a deliberate, vigorous scrub — many wide reversals in a
// short window — so the back-and-forth dragging that plays with the pointer
// forces (gravity well, orbit) doesn't accidentally clear every theme.
export const SCRIBBLE_REVERSALS = 9;
export const SCRIBBLE_WINDOW_MS = 1500;
export const SCRIBBLE_MIN_SWING_PX = 55;
// A swing only counts as a horizontal scrub if its vertical excursion stays
// under this fraction of its horizontal distance. A circular/diagonal drag
// swings sideways too, but carries a large vertical excursion (~0.5 for a
// circle), so it's rejected — the gesture must be genuinely left-right.
export const SCRIBBLE_MAX_VERTICAL_RATIO = 0.4;

// Pure detector: feed pointer x/y positions with timestamps; returns true once
// enough back-and-forth reversals land within the window, then re-arms. A
// reversal counts only when the pointer turns and travels at least minSwingPx
// horizontally *and* the swing stayed roughly flat (small vertical excursion),
// so ordinary drags, small jitter, and circular/diagonal motion don't register.
export function createScribbleDetector({
  reversalsNeeded = SCRIBBLE_REVERSALS,
  windowMs = SCRIBBLE_WINDOW_MS,
  minSwingPx = SCRIBBLE_MIN_SWING_PX,
  maxVerticalRatio = SCRIBBLE_MAX_VERTICAL_RATIO,
} = {}) {
  let extremeX = null; // furthest point reached in the current direction
  let dir = 0; // -1, 0, +1
  let reversals = [];
  let minY = 0; // vertical extent travelled during the current swing
  let maxY = 0;

  function reset() {
    extremeX = null;
    dir = 0;
    reversals = [];
  }

  function feed(x, y, now) {
    if (extremeX === null) {
      extremeX = x;
      minY = maxY = y;
      return false;
    }
    // Track how far the pointer wandered vertically during this swing.
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    const delta = x - extremeX;
    if (dir === 0) {
      // Establish a direction once the first swing clears the threshold.
      if (Math.abs(delta) >= minSwingPx) {
        dir = Math.sign(delta);
        extremeX = x;
        minY = maxY = y; // start measuring the next swing's vertical extent
      }
      return false;
    }
    if (Math.sign(delta) === dir) {
      extremeX = x; // still travelling the same way — push the turning point out
      return false;
    }
    if (Math.abs(delta) < minSwingPx) return false; // small backtrack / jitter
    // The swing reversed far enough horizontally — but only count it if it
    // stayed flat. A circular/diagonal drag swings sideways too, yet carries a
    // large vertical excursion; any such swing resets the run so circling never
    // accumulates toward a clear.
    if (maxY - minY > maxVerticalRatio * Math.abs(delta)) {
      reset();
      return false;
    }
    // A genuine horizontal reversal: turned and travelled a full flat swing.
    dir = -dir;
    extremeX = x;
    minY = maxY = y;
    reversals.push(now);
    while (reversals.length && now - reversals[0] > windowMs) reversals.shift();
    if (reversals.length >= reversalsNeeded) {
      reset();
      return true;
    }
    return false;
  }

  return { feed, reset };
}

export function initScribbleClear() {
  const detector = createScribbleDetector();

  function onPointerMove(e) {
    // Require a held button / finger — a deliberate drag, not idle mouse
    // drift. This also matches touch, where pointermove only fires in contact.
    if (e.buttons === 0) {
      detector.reset();
      return;
    }
    if (!detector.feed(e.clientX, e.clientY, performance.now())) return;
    const active = getThemes().filter((m) =>
      document.body.classList.contains(m.id),
    );
    if (active.length === 0) return;
    // A lone drag-capturing theme (paper's ink strokes) owns the gesture — a
    // scribble there is drawing, not a clear — so yield only when the active
    // set is nothing but drawing themes. A scrub over a stack that also holds
    // a normal theme still clears everything, matching the double-Escape wipe.
    if (active.every((m) => m.capturesPointer)) return;
    active.forEach((m) => toggleTheme(m.id, { silent: true }));
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "themes-scribbled" } }),
    );
  }
  function onReset() {
    detector.reset();
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onReset, { passive: true });
  window.addEventListener("pointercancel", onReset, { passive: true });

  return {
    stop() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onReset);
      window.removeEventListener("pointercancel", onReset);
    },
  };
}
