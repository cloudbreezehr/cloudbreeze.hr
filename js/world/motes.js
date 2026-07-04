// ── World-Anchored Motes ──
// The lively, force-responsive dust of the shared sky. Solo, the atmosphere's
// scroll-reactive motes handle this layer (unchanged). Linked, this deterministic
// field takes over so the dust is continuous across the seam and present at any
// scroll depth — the thing a neighbour's cursor and well actually push.
//
// Determinism without state streaming: every window seeds the same home field
// from the daily key, drives a shared ambient drift off the world clock, and
// springs each mote toward that deterministic target. Pointer forces (local and
// every linked peer, folded in identically by the shared force helpers) perturb
// the field; the spring heals the perturbation back to the shared target, so the
// dust only diverges transiently right under an actively-moving cursor — exactly
// where a one-frame difference is invisible. No per-mote messaging, no leader.

import { drawHaloParticle } from "../canvas-utils.js";
import { scaled, prefersReducedMotion } from "../motion.js";
import {
  applyRepulsion,
  applyAttraction,
  applyHoverDrift,
  applyWellForce,
  HOLD,
} from "../interactions.js";
import { WORLD_W, WORLD_H, floorMod } from "./space.js";
import { worldTickTime } from "./clock.js";
import { hashString, hashInts, mulberry32 } from "../daily/seed.js";
import { skySeedKey } from "../daily/random.js";
import { defineConstants } from "../dev/registry.js";

export const WMOTE = defineConstants("world.motes", {
  SPRING: {
    value: 0.01,
    min: 0,
    max: 0.2,
    step: 0.005,
    description: "Pull back toward the drifting home target per frame",
  },
  FRICTION: {
    value: 0.9,
    min: 0.7,
    max: 1,
    step: 0.01,
    description: "Velocity damping per frame",
  },
  DRIFT_AMP: {
    value: 18,
    min: 0,
    max: 120,
    step: 2,
    description: "How far the ambient wander reaches from home (px)",
  },
  DRIFT_SPEED: {
    value: 0.008,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Ambient drift angular rate per world tick",
  },
  DRIFT_FREQ_VAR: {
    value: 0.6,
    min: 0,
    max: 2,
    step: 0.05,
    description: "Per-mote drift-frequency spread, so the field decorrelates",
  },
  RADIUS_MIN: {
    value: 0.8,
    min: 0.1,
    max: 5,
    step: 0.1,
    description: "Minimum mote radius (px)",
  },
  RADIUS_RANGE: {
    value: 1.6,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Radius variation",
  },
  GLOW_RADIUS: {
    value: 4,
    min: 1,
    max: 15,
    step: 0.5,
    description: "Glow halo radius multiplier",
  },
  GRAD_MID: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gradient midpoint position",
  },
  GRAD_MID_OPACITY: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gradient midpoint opacity multiplier",
  },
  OPACITY_FLOOR: {
    value: 0.1,
    min: 0,
    max: 1,
    step: 0.01,
    description:
      "Ambient rest opacity — present at any scroll depth while linked",
  },
  OPACITY_MAX: {
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Opacity cap while a mote is being pushed",
  },
  OPACITY_EASE: {
    value: 0.02,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Per-frame easing back toward the ambient floor",
  },
  OPACITY_FORCE_GAIN: {
    value: 0.06,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Opacity boost per frame while a force acts on the mote",
  },
  DRAW_THRESHOLD: {
    value: 0.005,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Minimum displayed opacity to bother drawing",
  },
  REPEL_RADIUS: {
    value: 200,
    min: 50,
    max: 500,
    step: 10,
    description: "Click / blast repulsion radius (local and mirrored)",
  },
  REPEL_DAMP: {
    value: 1,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Repulsion strength relative to the click impulse",
  },
  HOVER_RADIUS: {
    value: 140,
    min: 30,
    max: 400,
    step: 5,
    description: "Hover-drift influence radius",
  },
  HOVER_STRENGTH: {
    value: 0.025,
    min: 0,
    max: 0.2,
    step: 0.005,
    description: "Soft pull toward a hovering cursor",
  },
});

// Separates the mote field's seeded stream from the star arrangement's, so the
// two layers don't correlate their positions on a given day.
const MOTE_STREAM_SALT = 0x6d07e5;

// Off-viewport margin still tiled, so a mote's halo doesn't pop at a slice edge.
const DRAW_MARGIN = 32;

// Every on-screen instance of a world point, tiling the sky tile across the
// viewport (a viewport wider than the tile sees the field repeat).
function tiledInstances(wx, wy, canvas, origin) {
  const startX = floorMod(wx - origin.x + DRAW_MARGIN, WORLD_W) - DRAW_MARGIN;
  const startY = floorMod(wy - origin.y + DRAW_MARGIN, WORLD_H) - DRAW_MARGIN;
  const out = [];
  for (let x = startX; x < canvas.width + DRAW_MARGIN; x += WORLD_W) {
    for (let y = startY; y < canvas.height + DRAW_MARGIN; y += WORLD_H) {
      out.push({ x, y });
    }
  }
  return out;
}

export class WorldMote {
  constructor(rng) {
    this.homeX = rng() * WORLD_W;
    this.homeY = rng() * WORLD_H;
    // Independent X/Y drift frequency and phase → each mote traces its own
    // little wander rather than the whole field swaying in lockstep.
    this.fx = 1 + rng() * WMOTE.DRIFT_FREQ_VAR;
    this.fy = 1 + rng() * WMOTE.DRIFT_FREQ_VAR;
    this.px = rng() * Math.PI * 2;
    this.py = rng() * Math.PI * 2;
    this.r = WMOTE.RADIUS_MIN + rng() * WMOTE.RADIUS_RANGE;
    // Live world position starts at rest on the home; velocity integrates the
    // spring + pointer forces.
    this.wx = this.homeX;
    this.wy = this.homeY;
    this.vx = 0;
    this.vy = 0;
    this.opacity = 0;
  }

  update(t, canvas, origin, forces, attract) {
    // Static dust under reduced motion: no drift, no spring, no integration, so
    // position is invariant across update(); opacity snaps to its rest floor.
    if (prefersReducedMotion()) {
      this.opacity = WMOTE.OPACITY_FLOOR;
      return;
    }

    // Deterministic target — `t` is the shared world clock (sampled once for the
    // whole field), so every window agrees on where this mote wants to be and
    // the field aligns across the seam at rest.
    const tx =
      this.homeX +
      Math.sin(t * WMOTE.DRIFT_SPEED * this.fx + this.px) * WMOTE.DRIFT_AMP;
    const ty =
      this.homeY +
      Math.sin(t * WMOTE.DRIFT_SPEED * this.fy + this.py) * WMOTE.DRIFT_AMP;

    // Spring toward the target (force accumulation → motion-scaled).
    this.vx += scaled((tx - this.wx) * WMOTE.SPRING);
    this.vy += scaled((ty - this.wy) * WMOTE.SPRING);

    // Pointer forces from every source — local pointer and each linked peer,
    // folded in identically by the shared helpers. Sampled at each on-screen
    // tile instance; velocity is translation-invariant, so the local-space
    // delta adds straight onto the world-space velocity.
    let forced = false;
    for (const inst of tiledInstances(this.wx, this.wy, canvas, origin)) {
      const probe = { x: inst.x, y: inst.y, vx: 0, vy: 0 };
      applyRepulsion(forces, probe, WMOTE.REPEL_RADIUS, WMOTE.REPEL_DAMP);
      applyAttraction(
        forces,
        probe,
        attract.radius,
        attract.force,
        HOLD.ATTRACT_TANGENT_FACTOR,
      );
      applyHoverDrift(forces, probe, WMOTE.HOVER_RADIUS, WMOTE.HOVER_STRENGTH);
      applyWellForce(forces, probe);
      if (probe.vx !== 0 || probe.vy !== 0) {
        forced = true;
        this.vx += probe.vx;
        this.vy += probe.vy;
      }
    }

    // Damping (not motion — bleeds off coasting velocity even at zero budget).
    this.vx *= WMOTE.FRICTION;
    this.vy *= WMOTE.FRICTION;

    // Integrate (motion-scaled).
    this.wx += scaled(this.vx);
    this.wy += scaled(this.vy);

    // Opacity: always ease back toward the ambient floor, brighten under force.
    this.opacity += (WMOTE.OPACITY_FLOOR - this.opacity) * WMOTE.OPACITY_EASE;
    if (forced) {
      this.opacity = Math.min(
        WMOTE.OPACITY_MAX,
        this.opacity + WMOTE.OPACITY_FORCE_GAIN,
      );
    }
  }

  draw(ctx, canvas, pal, origin, weight, haloOpts) {
    const op = this.opacity * weight;
    if (op < WMOTE.DRAW_THRESHOLD) return;
    for (const inst of tiledInstances(this.wx, this.wy, canvas, origin)) {
      drawHaloParticle(
        ctx,
        inst.x,
        inst.y,
        this.r * WMOTE.GLOW_RADIUS,
        op,
        pal.moteColor,
        haloOpts,
      );
    }
  }
}

/**
 * A field of world-anchored motes, seeded from the daily key so every linked
 * window computes the same dust. `draw` folds the shared `forces` (local +
 * remote pointers) into each mote and paints this window's slice at `weight`
 * (the regime crossfade opacity).
 */
export function createWorldMotes(count) {
  const rng = mulberry32(hashInts(hashString(skySeedKey()), MOTE_STREAM_SALT));
  const motes = Array.from({ length: count }, () => new WorldMote(rng));

  return {
    draw(ctx, canvas, pal, forces, origin, weight) {
      // Sample the world clock once so every mote in the field reads the same
      // tick — the drift target only aligns across windows if the whole field
      // shares one instant, not a per-mote Date.now() that can straddle a ms.
      const t = worldTickTime();
      // Attract radius/force ride the local hold charge (as the solo motes do),
      // shared across local and remote drags by the attraction helper.
      const attract = {
        radius:
          HOLD.ATTRACT_RADIUS_BASE +
          forces.holdStrength * HOLD.ATTRACT_RADIUS_HOLD,
        force:
          HOLD.ATTRACT_FORCE_BASE +
          forces.holdStrength * HOLD.ATTRACT_FORCE_HOLD,
      };
      // One halo opts object per frame — moteGlow is palette-derived, so it
      // rebuilds per frame but not per mote.
      const haloOpts = {
        midStop: WMOTE.GRAD_MID,
        midAlpha: WMOTE.GRAD_MID_OPACITY,
        midColor: pal.moteGlow,
      };
      for (const m of motes) {
        m.update(t, canvas, origin, forces, attract);
        m.draw(ctx, canvas, pal, origin, weight, haloOpts);
      }
    },
  };
}
