// ── Scribble-to-Clear ──
// Rapidly scribbling the pointer back and forth (many quick horizontal
// reversals) clears every active theme at once — the touch/mouse counterpart
// to the keyboard's double-Escape lights-out. Like lights-out it clears
// silently (a bulk panic-wipe, not a deliberate single-theme exit) and only
// acts when a theme is active. Requires a held button/finger and is
// horizontal-only, so idle mouse drift and vertical scroll-drags never trip
// it; and it yields to drag-capturing themes (paper) so a scribble there
// draws instead of wiping.

import { getThemes, toggleTheme } from "./registry.js";

export const SCRIBBLE_REVERSALS = 6;
export const SCRIBBLE_WINDOW_MS = 1500;
export const SCRIBBLE_MIN_SWING_PX = 30;

// Pure detector: feed pointer x positions with timestamps; returns true once
// enough back-and-forth reversals land within the window, then re-arms. A
// reversal counts only when the pointer turns and travels at least minSwingPx
// the other way, so ordinary drags and small jitter don't register.
export function createScribbleDetector({
  reversalsNeeded = SCRIBBLE_REVERSALS,
  windowMs = SCRIBBLE_WINDOW_MS,
  minSwingPx = SCRIBBLE_MIN_SWING_PX,
} = {}) {
  let extremeX = null; // furthest point reached in the current direction
  let dir = 0; // -1, 0, +1
  let reversals = [];

  function reset() {
    extremeX = null;
    dir = 0;
    reversals = [];
  }

  function feed(x, now) {
    if (extremeX === null) {
      extremeX = x;
      return false;
    }
    const delta = x - extremeX;
    if (dir === 0) {
      // Establish a direction once the first swing clears the threshold.
      if (Math.abs(delta) >= minSwingPx) {
        dir = Math.sign(delta);
        extremeX = x;
      }
      return false;
    }
    if (Math.sign(delta) === dir) {
      extremeX = x; // still travelling the same way — push the turning point out
      return false;
    }
    if (Math.abs(delta) < minSwingPx) return false; // small backtrack / jitter
    // A genuine reversal: turned and travelled a full swing the other way.
    dir = -dir;
    extremeX = x;
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
    if (!detector.feed(e.clientX, performance.now())) return;
    const active = getThemes().filter((m) =>
      document.body.classList.contains(m.id),
    );
    if (active.length === 0) return;
    // A theme that turns drags into content (paper's ink strokes) owns the
    // gesture — a scribble there is drawing, not a clear — so yield to it
    // rather than wipe what the user is actively working in.
    if (active.some((m) => m.capturesPointer)) return;
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
