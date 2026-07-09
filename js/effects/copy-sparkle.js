// ── Copy Sparkle ──
// Copying text off the page is answered with a tiny glitter burst at the
// selection — a wink for the quotable. The burst rides the shared radial
// DOM burst (WAAPI, self-removing). The unlock event fires on every real
// copy regardless of reduced motion (the copy happened); the burst and the
// voice tied to it are a one-shot flourish, skipped entirely when motion
// is reduced.

import { defineConstants } from "../dev/registry.js";
import { prefersReducedMotion } from "../motion.js";
import { spawnRadialBurst } from "./burst.js";
import { playSfx } from "../audio/sfx.js";

export const SPARKLE = defineConstants("effects.copySparkle", {
  COUNT_MIN: { value: 6, min: 0, max: 30, step: 1 },
  COUNT_RANGE: { value: 4, min: 0, max: 30, step: 1 },
  SIZE_MIN: { value: 3, min: 1, max: 16, step: 1 },
  SIZE_RANGE: { value: 3, min: 0, max: 16, step: 1 },
  DIST_MIN: { value: 18, min: 0, max: 200, step: 2 },
  DIST_RANGE: { value: 26, min: 0, max: 200, step: 2 },
  DUR_MIN: { value: 450, min: 100, max: 3000, step: 50 },
  DUR_RANGE: { value: 350, min: 0, max: 3000, step: 50 },
  // A copied word gets a wink, a copied paragraph a small celebration: the
  // burst scales with the selection rect's diagonal, clamped so select-all
  // doesn't blanket the page.
  SCALE_REF_PX: { value: 260, min: 40, max: 2000, step: 20 },
  SCALE_MIN: { value: 0.7, min: 0.1, max: 1, step: 0.05 },
  SCALE_MAX: { value: 2.4, min: 1, max: 6, step: 0.1 },
});

export function initCopySparkle() {
  function onCopy() {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "text-copied" } }),
    );
    if (prefersReducedMotion()) return;
    // A selection inside a text field reports as collapsed or rect-less in
    // some engines — with no spot on the page to sparkle from, stay quiet.
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    const scale = Math.min(
      SPARKLE.SCALE_MAX,
      Math.max(
        SPARKLE.SCALE_MIN,
        Math.hypot(rect.width, rect.height) / SPARKLE.SCALE_REF_PX,
      ),
    );
    spawnRadialBurst({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      className: "copy-sparkle",
      countMin: Math.round(SPARKLE.COUNT_MIN * scale),
      countRange: Math.round(SPARKLE.COUNT_RANGE * scale),
      sizeMin: SPARKLE.SIZE_MIN * scale,
      sizeRange: SPARKLE.SIZE_RANGE * scale,
      distMin: SPARKLE.DIST_MIN * scale,
      distRange: SPARKLE.DIST_RANGE * scale,
      durMin: SPARKLE.DUR_MIN,
      durRange: SPARKLE.DUR_RANGE,
    });
    playSfx("shimmer");
  }
  document.addEventListener("copy", onCopy);
  return () => document.removeEventListener("copy", onCopy);
}
