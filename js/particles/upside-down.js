// ── Upside-Down Particle System ──
// The canvas itself is CSS-flipped via `.flips-with-page` while the
// upside-down theme is active.  Coordinates here stay in plain canvas-
// pixel space (top-left origin, +y = down in the buffer); CSS handles
// the visual inversion.  In flipped presentation, canvas-data y=0
// appears at the visual bottom of the screen, and increasing canvas-
// data y moves toward the visual top.  So a particle that spawns at
// low y and drifts toward high y reads to the user as rising from the
// floor toward the ceiling — the anti-gravity dust effect this module
// provides.

import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { drawHaloParticle } from "../canvas-utils.js";
import { defineConstants } from "../dev/registry.js";
import { scaled, chance } from "../motion.js";

// Warm-toned palette matching the upside-down theme's dominant red/
// orange identity.  Kept as module-level tuples (the snowflake
// pattern) since this file is the only place these specks render.
const DUST_RGB = [220, 130, 90];
const DUST_GLOW_RGB = [255, 170, 120];

// ── Anti-gravity dust ──
// Slow ambient drift "upward" (visually) — really increasing canvas-
// data y, since the canvas is CSS-flipped while the theme is active.
// Constant lift force + friction means step() doesn't fit (step only
// integrates, doesn't apply forces); per-frame motion math goes
// through scaled() instead, with chance() gating the stochastic spawn.
export const DUST = defineConstants(
  "particles.upsideDownDust",
  {
    POOL: {
      value: 80,
      min: 10,
      max: 200,
      step: 1,
      description: "Total dust slots",
    },
    SPAWN_PER_FRAME: {
      value: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Per-frame chance of spawning a new mote",
    },
    SPAWN_BAND_FRAC: {
      value: 0.05,
      min: 0,
      max: 0.5,
      step: 0.01,
      description:
        "Vertical band at canvas-data top (visual bottom) where new motes spawn, as fraction of canvas height",
    },
    LIFT_MIN: {
      value: 0.25,
      min: 0,
      max: 2,
      step: 0.05,
      description: "Min upward (canvas-data +y) lift per frame (px)",
    },
    LIFT_RANGE: {
      value: 0.45,
      min: 0,
      max: 2,
      step: 0.05,
      description: "Lift variation",
    },
    SWAY_AMP_MIN: {
      value: 0.1,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Min lateral sway amplitude (px)",
    },
    SWAY_AMP_RANGE: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Sway amplitude variation",
    },
    SWAY_SPEED_MIN: {
      value: 0.01,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Min sway oscillation speed (radians/frame)",
    },
    SWAY_SPEED_RANGE: {
      value: 0.025,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Sway speed variation",
    },
    FRICTION: {
      value: 0.94,
      min: 0.5,
      max: 1,
      step: 0.005,
      description: "Per-frame velocity damping (applied to vx/vy from forces)",
    },
    RADIUS_MIN: {
      value: 0.8,
      min: 0.3,
      max: 4,
      step: 0.1,
      description: "Min mote radius (px)",
    },
    RADIUS_RANGE: {
      value: 1.4,
      min: 0,
      max: 4,
      step: 0.1,
      description: "Mote radius variation",
    },
    GLOW_RADIUS: {
      value: 4,
      min: 1,
      max: 12,
      step: 0.5,
      description: "Halo radius multiplier",
    },
    OPACITY_MIN: {
      value: 0.25,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Min mote opacity",
    },
    OPACITY_RANGE: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Opacity variation",
    },
    FADE_OUT_FRAC: {
      value: 0.15,
      min: 0,
      max: 0.5,
      step: 0.01,
      description:
        "Fraction of canvas height (from top boundary) over which motes fade out",
    },
    CULL_MARGIN_PX: {
      value: 10,
      min: 0,
      max: 60,
      step: 1,
      description:
        "Pixels past canvas height before a mote is deactivated (avoids popping at the boundary)",
    },
    REPEL_RADIUS: {
      value: 140,
      min: 30,
      max: 400,
      step: 10,
      description: "Click repulsion radius",
    },
    REPEL_DAMPEN: {
      value: 0.6,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Click repulsion strength",
    },
    ATTRACT_RADIUS: {
      value: 160,
      min: 30,
      max: 400,
      step: 10,
      description: "Drag attraction radius",
    },
    ATTRACT_STRENGTH: {
      value: 0.08,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Drag attraction force",
    },
    ATTRACT_TANGENT: {
      value: 0.4,
      min: 0,
      max: 2,
      step: 0.05,
      description: "Tangential orbit factor",
    },
  },
  { theme: "upside-down" },
);

// ── Module-scoped canvas refs ──
let _canvas, _ctx;

export class Dust {
  constructor() {
    this.active = false;
  }
  spawn() {
    // Spawn at canvas-data top (visual bottom) within a small band so
    // motes appear to be lifting off the floor rather than materializing
    // at a single y line.
    this.x = Math.random() * _canvas.width;
    this.y = Math.random() * _canvas.height * DUST.SPAWN_BAND_FRAC;
    this.vx = 0;
    this.vy = 0;
    this.lift = DUST.LIFT_MIN + Math.random() * DUST.LIFT_RANGE;
    this.swayAmp = DUST.SWAY_AMP_MIN + Math.random() * DUST.SWAY_AMP_RANGE;
    this.swaySpeed =
      DUST.SWAY_SPEED_MIN + Math.random() * DUST.SWAY_SPEED_RANGE;
    this.swayPhase = Math.random() * Math.PI * 2;
    this.r = DUST.RADIUS_MIN + Math.random() * DUST.RADIUS_RANGE;
    this.opacity = DUST.OPACITY_MIN + Math.random() * DUST.OPACITY_RANGE;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    // Lift is a constant per-frame y velocity (canvas-data +y =
    // visually upward in the flipped view) that gives the dust its
    // anti-gravity drift.  scaled() folds in the motion budget so
    // reduced motion freezes the rise.
    this.swayPhase += scaled(this.swaySpeed);
    this.x += scaled(Math.sin(this.swayPhase) * this.swayAmp + this.vx);
    this.y += scaled(this.lift + this.vy);
    // Friction applies to interaction-driven velocity only — coasting
    // velocity bleeds off so impulses cause brief deflections rather
    // than sustained drift.
    this.vx *= DUST.FRICTION;
    this.vy *= DUST.FRICTION;
    // Cull when the mote drifts off the far side of the canvas (visual
    // top) — slot returns to the pool for re-spawn.
    if (this.y > _canvas.height + DUST.CULL_MARGIN_PX) this.active = false;
  }
  draw() {
    if (!this.active) return;
    // Fade out as the mote approaches the far boundary so it dissolves
    // into the canvas edge rather than popping off-screen.
    const cullY = _canvas.height;
    const fadeStart = cullY * (1 - DUST.FADE_OUT_FRAC);
    let alpha = this.opacity;
    if (this.y > fadeStart) {
      const t = (this.y - fadeStart) / (cullY - fadeStart);
      alpha *= Math.max(0, 1 - t);
    }
    if (alpha <= 0) return;
    drawHaloParticle(
      _ctx,
      this.x,
      this.y,
      this.r * DUST.GLOW_RADIUS,
      alpha,
      DUST_GLOW_RGB,
    );
    _ctx.fillStyle = `rgba(${DUST_RGB[0]},${DUST_RGB[1]},${DUST_RGB[2]},${alpha})`;
    _ctx.beginPath();
    _ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    _ctx.fill();
  }
}

// ── Factory ──

export function createUpsideDown(canvasEl, ctxEl) {
  _canvas = canvasEl;
  _ctx = ctxEl;

  const dust = Array.from({ length: DUST.POOL }, () => new Dust());

  return {
    draw(forces) {
      // Ambient spawn — motion budget folded into chance() so reduced-
      // motion users see a still field (existing motes age out).
      if (chance(DUST.SPAWN_PER_FRAME)) {
        const slot = dust.find((d) => !d.active);
        if (slot) slot.spawn();
      }
      for (const d of dust) {
        d.update();
        applyRepulsion(forces, d, DUST.REPEL_RADIUS, DUST.REPEL_DAMPEN);
        applyAttraction(
          forces,
          d,
          DUST.ATTRACT_RADIUS,
          DUST.ATTRACT_STRENGTH,
          DUST.ATTRACT_TANGENT,
        );
        applyWellForce(forces, d);
        d.draw();
      }
    },

    cleanup() {
      for (const d of dust) d.active = false;
    },
  };
}
