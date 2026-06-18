// ── Screen Shake ──
// A brief earthquake: jolt the page back and forth, decaying to rest. Animates
// the `translate` property (not `transform`) on the content and sky layers, so
// it composes with any theme flip those elements carry as `transform` rather
// than clobbering it. Crucially it never transforms `body`: a non-`none`
// transform on `body` would make it the containing block for every fixed
// overlay (cursor, sky canvas, scroll bar), which would then lurch by the
// scroll offset for the effect's duration. No fill, so the translate clears
// itself; skipped under reduced motion (a WAAPI animation isn't caught by the
// global CSS clamp).

import { prefersReducedMotion } from "../motion.js";

const BASE_AMPLITUDE_PX = 8;
const DEFAULT_DURATION_MS = 500;
const SHAKE_STEPS = 8; // back-and-forth keyframes before settling
const VERTICAL_RATIO = 0.5; // vertical jolt relative to horizontal
// Layers that shake: page content and the sky behind it. Both can carry a
// theme flip as `transform`, which the animated `translate` composes with.
const SHAKE_SELECTOR = ".page, #bg-canvas";

export function screenShake({
  amplitude = BASE_AMPLITUDE_PX,
  durationMs = DEFAULT_DURATION_MS,
} = {}) {
  if (prefersReducedMotion()) return;
  const frames = [];
  for (let i = 0; i <= SHAKE_STEPS; i++) {
    const decay = 1 - i / SHAKE_STEPS; // amplitude fades toward zero
    const dir = i % 2 === 0 ? 1 : -1;
    const x = dir * amplitude * decay;
    const y = -dir * amplitude * VERTICAL_RATIO * decay;
    frames.push({ translate: `${x}px ${y}px` });
  }
  frames.push({ translate: "0 0" });
  for (const el of document.querySelectorAll(SHAKE_SELECTOR)) {
    el.animate(frames, { duration: durationMs, easing: "ease-out" });
  }
}
