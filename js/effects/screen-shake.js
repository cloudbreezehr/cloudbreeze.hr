// ── Screen Shake ──
// A brief earthquake: translate the whole page back and forth, decaying to
// rest. Animates document.body, so canvas, content and cursor shake together
// (and it composes with the upside-down flip, which lives on child elements).
// The animation has no fill, so the transform clears itself; skipped under
// reduced motion (a WAAPI animation isn't caught by the global CSS clamp).

import { prefersReducedMotion } from "../motion.js";

const BASE_AMPLITUDE_PX = 8;
const DEFAULT_DURATION_MS = 500;
const SHAKE_STEPS = 8; // back-and-forth keyframes before settling
const VERTICAL_RATIO = 0.5; // vertical jolt relative to horizontal

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
    frames.push({ transform: `translate(${x}px, ${y}px)` });
  }
  frames.push({ transform: "translate(0, 0)" });
  document.body.animate(frames, { duration: durationMs, easing: "ease-out" });
}
