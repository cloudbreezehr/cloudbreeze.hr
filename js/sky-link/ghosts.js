// ── Cursor Ghosts ──
// Every linked window's pointer, redrawn here as the same cursor continuing
// across the seam: a bright core dot inside a ring, wrapped in a soft glow —
// the site's own cursor shape, not a separate blob. The OS hands the real
// pointer to only one window at a time, so as the mouse leaves the neighbour
// its ghost here takes over, handing off to this window's own cursor when the
// mouse arrives. Dot, ring and glow brighten and widen while the neighbour
// charges a hold or a well. Opacity eases per frame, so a pointer that
// vanishes from the live list (idle, unlinked, gone quiet, pruned) fades out
// from its last known spot instead of popping. Liveness is the seam's to
// decide: a pointer present in `remotes` is live, full stop — the same list
// that drives its force, so the ghost and the force it represents appear and
// disappear together. This module also witnesses the moment a neighbour's drag
// reaches inside this viewport — the ghost-hand discovery.

import { drawHaloParticle, rgbaStr } from "../canvas-utils.js";
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
  RING_RADIUS: {
    value: 12,
    min: 4,
    max: 40,
    step: 1,
    description: "Ghost cursor-ring radius at rest (px)",
  },
  RING_WIDTH: {
    value: 1.5,
    min: 0.5,
    max: 4,
    step: 0.1,
    description: "Ghost cursor-ring stroke width (px)",
  },
  RING_ALPHA: {
    value: 0.6,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Ghost ring opacity relative to the ghost's eased opacity",
  },
  DOT_RADIUS: {
    value: 3.5,
    min: 1,
    max: 12,
    step: 0.5,
    description: "Ghost cursor core-dot radius (px)",
  },
  DOT_ALPHA: {
    value: 1.4,
    min: 0.5,
    max: 3,
    step: 0.1,
    description:
      "Ghost core-dot opacity relative to the ghost's opacity (capped at 1)",
  },
});

// Below this displayed opacity a ghost is invisible: skip the draw and
// forget the entry.
const MIN_VISIBLE = 0.01;

export function createCursorGhosts() {
  // id → { opacity, x, y, charge } — displayed state, eased toward the live
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
        // Hold and well both swell the cursor; whichever is stronger drives it.
        const charge = Math.max(rp.holdStrength, rp.wellStrength);
        const target = GHOST.OPACITY + charge * GHOST.HOLD_OPACITY_BOOST;
        const g = ghosts.get(rp.id) || {
          opacity: 0,
          x: rp.x,
          y: rp.y,
          charge: 0,
        };
        g.opacity += (target - g.opacity) * GHOST.EASE;
        g.x = rp.x;
        g.y = rp.y;
        g.charge = charge;
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
        const swell = 1 + g.charge * GHOST.HOLD_RADIUS_BOOST;
        const color = pal.cursorGhost;
        // Soft outer glow — the cursor's presence, widening with charge.
        drawHaloParticle(
          ctx,
          g.x,
          g.y,
          GHOST.RADIUS * swell,
          g.opacity,
          color,
          {
            midStop: GHOST.GLOW_MID_STOP,
            midAlpha: GHOST.GLOW_MID_ALPHA,
          },
        );
        // The cursor itself continuing across the seam: a ring around a core.
        ctx.save();
        ctx.beginPath();
        ctx.arc(g.x, g.y, GHOST.RING_RADIUS * swell, 0, Math.PI * 2);
        ctx.strokeStyle = rgbaStr(color, g.opacity * GHOST.RING_ALPHA);
        ctx.lineWidth = GHOST.RING_WIDTH;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(g.x, g.y, GHOST.DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = rgbaStr(
          color,
          Math.min(1, g.opacity * GHOST.DOT_ALPHA),
        );
        ctx.fill();
        ctx.restore();
      }
      return ghosts.size;
    },
  };
}
