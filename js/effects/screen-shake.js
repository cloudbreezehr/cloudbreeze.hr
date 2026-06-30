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
import { playSfx } from "../audio/sfx.js";

const BASE_AMPLITUDE_PX = 8;
const DEFAULT_DURATION_MS = 500;
const SHAKE_STEPS = 8; // back-and-forth keyframes before settling
const VERTICAL_RATIO = 0.5; // vertical jolt relative to horizontal
// A real impact snaps to its peak and decays fast rather than fading linearly:
// an exponential amplitude falloff plus an overshooting opening jolt reads as a
// hit, not a wobble.
const DECAY_EXPONENT = 1.8;
const LEAD_OVERSHOOT = 1.3; // first jolt punches past the base amplitude
// Layers that shake: page content and the sky behind it. Both can carry a
// theme flip as `transform`, which the animated `translate` composes with.
const SHAKE_SELECTOR = ".page, #bg-canvas";

export function screenShake({
  amplitude = BASE_AMPLITUDE_PX,
  durationMs = DEFAULT_DURATION_MS,
  sound = "rumble",
} = {}) {
  if (prefersReducedMotion()) return;
  playSfx(sound);
  const frames = [];
  for (let i = 0; i <= SHAKE_STEPS; i++) {
    const decay = Math.pow(1 - i / SHAKE_STEPS, DECAY_EXPONENT);
    const dir = i % 2 === 0 ? 1 : -1;
    // The opening jolt overshoots the base amplitude for extra kick.
    const kick = (i === 0 ? LEAD_OVERSHOOT : 1) * amplitude * decay;
    const x = dir * kick;
    const y = -dir * kick * VERTICAL_RATIO;
    frames.push({ translate: `${x}px ${y}px` });
  }
  frames.push({ translate: "0 0" });
  for (const el of document.querySelectorAll(SHAKE_SELECTOR)) {
    // Linear between keyframes keeps each reversal sharp — the decay shapes the
    // envelope, the easing shouldn't round it back into a wobble.
    el.animate(frames, { duration: durationMs, easing: "linear" });
  }
}
