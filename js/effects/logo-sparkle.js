// ── Logo Hover Sparkles ──
// Hovering the nav logo emits a small burst of star-shaped particles that
// drift outward and fade.  Purely decorative — never interacts with the
// frozen-theme click counter.

import { prefersReducedMotion } from "../motion.js";

const SPARKLE_COUNT = 4;
const SPARKLE_DURATION_MS = 400;
const SPARKLE_SPREAD_PX = 28;
const SPARKLE_THROTTLE_MS = 300;
// Random angular offset so the fan of sparkles doesn't fire in a rigid cross.
const SPARKLE_ANGLE_JITTER = 0.8;
// Start offset as a fraction of the logo half-size, so each sparkle begins
// scattered around the logo rather than all at its center.
const SPARKLE_START_SPREAD = 1.4;
const SPARKLE_START_OPACITY = 0.9;
const SPARKLE_END_SCALE = 0.2;
// Added to each successive sparkle's duration so they don't fade in lockstep.
const SPARKLE_STAGGER_MS = 40;

let _lastSparkleTime = 0;

export function initLogoSparkle() {
  const logoEl = document.querySelector(".nav-logo");
  if (!logoEl) return;

  logoEl.addEventListener("pointerenter", () => {
    if (prefersReducedMotion()) return;

    const now = Date.now();
    if (now - _lastSparkleTime < SPARKLE_THROTTLE_MS) return;
    _lastSparkleTime = now;

    const rect = logoEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;

    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const angle =
        (i / SPARKLE_COUNT) * Math.PI * 2 +
        Math.random() * SPARKLE_ANGLE_JITTER;
      const startX = cx + (Math.random() - 0.5) * halfW * SPARKLE_START_SPREAD;
      const startY = cy + (Math.random() - 0.5) * halfH * SPARKLE_START_SPREAD;
      const dx = Math.cos(angle) * SPARKLE_SPREAD_PX;
      const dy = Math.sin(angle) * SPARKLE_SPREAD_PX;

      const el = document.createElement("span");
      el.className = "logo-sparkle";
      el.style.left = startX + "px";
      el.style.top = startY + "px";
      document.body.appendChild(el);

      el.animate(
        [
          {
            transform: `translate(-50%, -50%) scale(1)`,
            opacity: SPARKLE_START_OPACITY,
          },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${SPARKLE_END_SCALE})`,
            opacity: 0,
          },
        ],
        {
          duration: SPARKLE_DURATION_MS + i * SPARKLE_STAGGER_MS,
          easing: "ease-out",
          fill: "forwards",
        },
      ).onfinish = () => el.remove();
    }
  });
}
