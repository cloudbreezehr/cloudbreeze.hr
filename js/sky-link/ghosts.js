// ── Cursor Ghosts ──
// Soft canvas presence for every linked window's pointer: a faint halo
// drifting where the neighbour's cursor is, brightening and widening while
// they charge a hold or a well. Opacity eases per frame, so a pointer that
// vanishes from the live list (idle, unlinked, gone quiet, pruned) fades
// out from its last known spot instead of popping. Liveness is the seam's
// to decide: a pointer present in `remotes` is live, full stop — the same
// list that drives its force, so the ghost and the force it represents
// appear and disappear together. This module also witnesses the moment a
// neighbour's drag reaches inside this viewport — the ghost-hand discovery.

import { drawHaloParticle } from "../canvas-utils.js";
import { defineConstants } from "../dev/registry.js";

const GHOST = defineConstants("skyLink.ghost", {
  RADIUS: {
    value: 16,
    min: 4,
    max: 60,
    step: 1,
    description: "Ghost halo radius at rest (px)",
  },
  OPACITY: {
    value: 0.28,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Ghost opacity at rest",
  },
  HOLD_OPACITY_BOOST: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Extra opacity at a remote pointer's full hold charge",
  },
  HOLD_RADIUS_BOOST: {
    value: 0.9,
    min: 0,
    max: 3,
    step: 0.05,
    description: "Extra radius (as a fraction of rest) at full hold charge",
  },
  EASE: {
    value: 0.12,
    min: 0.01,
    max: 1,
    step: 0.01,
    description: "Per-frame easing of ghost opacity toward its target",
  },
  GLOW_MID_STOP: {
    value: 0.35,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gradient midpoint stop position for the ghost halo",
  },
  GLOW_MID_ALPHA: {
    value: 0.45,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gradient midpoint opacity multiplier for the ghost halo",
  },
});

// Below this displayed opacity a ghost is invisible: skip the draw and
// forget the entry.
const MIN_VISIBLE = 0.01;

export function createCursorGhosts() {
  // id → { opacity, x, y, hold } — displayed state, eased toward the live
  // pointer each frame and kept after the pointer vanishes so the fade-out
  // has a position to render at.
  const ghosts = new Map();
  let handFired = false;

  return {
    /**
     * Draw one frame of ghosts. `remotes` is the seam's remote-pointer
     * list (local coordinates); `canvas` bounds the ghost-hand witness.
     * Returns the number of ghosts still visible — a gone pointer's ghost
     * eases out over several frames, so the caller keeps calling while this
     * is above zero even after `remotes` empties.
     */
    draw(ctx, pal, remotes, canvas) {
      for (const rp of remotes) {
        const target =
          GHOST.OPACITY + rp.holdStrength * GHOST.HOLD_OPACITY_BOOST;
        const g = ghosts.get(rp.id) || {
          opacity: 0,
          x: rp.x,
          y: rp.y,
          hold: 0,
        };
        g.opacity += (target - g.opacity) * GHOST.EASE;
        g.x = rp.x;
        g.y = rp.y;
        g.hold = rp.holdStrength;
        ghosts.set(rp.id, g);

        // A neighbour's captured drag physically inside this viewport is
        // the feature's flagship moment — celebrate it once per page load.
        if (
          !handFired &&
          rp.isDragging &&
          rp.x >= 0 &&
          rp.x <= canvas.width &&
          rp.y >= 0 &&
          rp.y <= canvas.height
        ) {
          handFired = true;
          window.dispatchEvent(
            new CustomEvent("achievement", {
              detail: { type: "sky-link-ghost-hand" },
            }),
          );
        }
      }

      // Ease out ghosts whose pointer is gone, then draw everything still
      // visible from one code path.
      for (const [id, g] of ghosts) {
        if (!remotes.some((rp) => rp.id === id)) {
          g.opacity += (0 - g.opacity) * GHOST.EASE;
        }
        if (g.opacity < MIN_VISIBLE) {
          ghosts.delete(id);
          continue;
        }
        const radius = GHOST.RADIUS * (1 + g.hold * GHOST.HOLD_RADIUS_BOOST);
        drawHaloParticle(ctx, g.x, g.y, radius, g.opacity, pal.cursorGhost, {
          midStop: GHOST.GLOW_MID_STOP,
          midAlpha: GHOST.GLOW_MID_ALPHA,
        });
      }
      return ghosts.size;
    },
  };
}
