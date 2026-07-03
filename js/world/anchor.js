// ── World Anchoring Regime ──
// One decision shared by every layer that spans the multi-window sky: is this
// window painting the desktop-anchored world (linked), or folding the tile onto
// its own viewport (solo)? And how far through the link/unlink crossfade are we?
//
// The link state is read live from the seam — a peer rect present means the
// world is anchored. The crossfade dissolves the two layouts into each other on
// link/unlink instead of snapping, so the skies read as joining rather than
// glitching; it collapses to instant under reduced motion.

import { peerWorldRects } from "../sky-link/seam.js";
import { prefersReducedMotion } from "../motion.js";
import { defineConstants } from "../dev/registry.js";

export const ANCHOR = defineConstants("world.anchor", {
  LINK_BLEND_MS: {
    value: 1200,
    min: 0,
    max: 5000,
    step: 100,
    description:
      "Crossfade between the window-folded and desktop-anchored layouts (ms)",
  },
});

/** True while this window renders the desktop-anchored world regime. */
export function isWorldAnchored() {
  return peerWorldRects().length > 0;
}

/**
 * A per-layer crossfade tracker. The returned function, called once per frame,
 * reports the current regime and a `blend` weight for it: `1` when the regime
 * has settled, ramping `0 → 1` over `LINK_BLEND_MS` after a link/unlink flip,
 * and `1` immediately under reduced motion. Callers draw the settled regime at
 * `blend` and the outgoing regime at `1 - blend` while `blend < 1`.
 *
 * `now` and `reduced` are injectable so tests own the clock.
 */
export function createAnchorBlend() {
  let anchoredPrev = false;
  let flipAt = -Infinity;
  return function anchorBlend(
    now = performance.now(),
    reduced = prefersReducedMotion(),
  ) {
    const anchored = isWorldAnchored();
    if (anchored !== anchoredPrev) {
      anchoredPrev = anchored;
      flipAt = now;
    }
    const since = now - flipAt;
    const blend =
      reduced || since >= ANCHOR.LINK_BLEND_MS
        ? 1
        : since / ANCHOR.LINK_BLEND_MS;
    return { anchored, blend };
  };
}
