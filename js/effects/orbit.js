// ── Orbit ──
// Small motes circle a point for a moment, then fade. Each is a DOM dot whose
// WAAPI keyframes trace a ring (several turns) while fading out near the end;
// self-cleaning, capped, skipped under reduced motion.

import { prefersReducedMotion } from "../motion.js";
import { playSfx } from "../audio/sfx.js";

const DEFAULT_COUNT = 6;
// Hard cap so a charge-scaled caller can't flood the DOM.
const MAX_DOTS = 40;
const DEFAULT_RADIUS_PX = 60;
const DEFAULT_DURATION_MS = 1600;
const DEFAULT_TURNS = 2;
const DOT_SIZE_PX = 8;
const KEYFRAME_STEPS = 24; // points sampled around the ring
const FADE_START = 0.7; // fraction of the orbit before motes fade
const DEFAULT_COLOR = "#8fd3ff";
const FULL_CIRCLE = Math.PI * 2;

export function orbit({
  origin = null,
  count = DEFAULT_COUNT,
  radius = DEFAULT_RADIUS_PX,
  durationMs = DEFAULT_DURATION_MS,
  turns = DEFAULT_TURNS,
  color = DEFAULT_COLOR,
} = {}) {
  if (prefersReducedMotion()) return;
  playSfx("orbit");
  const cx = origin ? origin.x : window.innerWidth / 2;
  const cy = origin ? origin.y : window.innerHeight / 2;
  const n = Math.min(count, MAX_DOTS);
  for (let i = 0; i < n; i++) {
    const phase = (i / n) * FULL_CIRCLE; // spread evenly around the ring
    const el = document.createElement("div");
    el.className = "orbit-mote";
    el.setAttribute("aria-hidden", "true");
    el.style.width = `${DOT_SIZE_PX}px`;
    el.style.height = `${DOT_SIZE_PX}px`;
    el.style.left = `${cx - DOT_SIZE_PX / 2}px`;
    el.style.top = `${cy - DOT_SIZE_PX / 2}px`;
    el.style.background = color;
    document.body.appendChild(el);

    const frames = [];
    for (let k = 0; k <= KEYFRAME_STEPS; k++) {
      const t = k / KEYFRAME_STEPS;
      const a = phase + t * FULL_CIRCLE * turns;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      const opacity =
        t < FADE_START ? 1 : 1 - (t - FADE_START) / (1 - FADE_START);
      frames.push({ transform: `translate(${x}px, ${y}px)`, opacity });
    }
    el.animate(frames, { duration: durationMs, easing: "linear" }).onfinish =
      () => el.remove();
  }
}
