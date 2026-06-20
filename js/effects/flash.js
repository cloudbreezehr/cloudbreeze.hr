// ── Screen Flash ──
// A full-viewport colour wash that fades out — a one-shot cue for a surge, a
// glow, a lightning strike. Defaults to a `screen` blend so it brightens the
// page rather than covering it. Self-cleaning; skipped under reduced motion.

import { prefersReducedMotion } from "../motion.js";
import { playSfx } from "../audio/sfx.js";

const DEFAULT_COLOR = "#ffffff";
const DEFAULT_DURATION_MS = 380;
const DEFAULT_PEAK = 0.6; // starting opacity
const DEFAULT_BLEND = "screen";

export function screenFlash({
  color = DEFAULT_COLOR,
  durationMs = DEFAULT_DURATION_MS,
  peak = DEFAULT_PEAK,
  blend = DEFAULT_BLEND,
} = {}) {
  if (prefersReducedMotion()) return;
  playSfx("flash");
  const el = document.createElement("div");
  el.className = "screen-flash";
  el.setAttribute("aria-hidden", "true");
  el.style.background = color;
  el.style.mixBlendMode = blend;
  document.body.appendChild(el);
  el.animate([{ opacity: peak }, { opacity: 0 }], {
    duration: durationMs,
    easing: "ease-out",
    fill: "forwards",
  }).onfinish = () => el.remove();
}
