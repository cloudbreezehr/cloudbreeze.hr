// ── Upside-Down Particle System ──
// The canvas itself is CSS-flipped via `.flips-with-page` while the
// upside-down theme is active.  Coordinates here stay in plain canvas-
// pixel space (top-left origin, +y = down in the buffer); CSS handles
// the visual inversion.  In flipped presentation, canvas-data y=0
// appears at the visual bottom of the screen, and increasing canvas-
// data y moves toward the visual top.  So a particle that spawns at
// low y and drifts toward high y reads to the user as rising from the
// floor toward the ceiling.

import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { drawHaloParticle } from "../canvas-utils.js";
import { defineConstants } from "../dev/registry.js";
import { scaled, chance, step } from "../motion.js";

// Warm-toned palette matching the upside-down theme's dominant red/
// orange identity.  Kept as module-level tuples (the snowflake
// pattern) since this file is the only place these specks render.
const DUST_RGB = [220, 130, 90];
const DUST_GLOW_RGB = [255, 170, 120];

// Debris colors — slightly desaturated paper/leaf tones in the same
// warm family.  Each spawn picks one at random so the field doesn't
// read as a single-color confetti.
const DEBRIS_RGBS = [
  [200, 130, 90], // burnt sienna
  [180, 110, 80], // muted rust
  [170, 90, 70], // dried-leaf red
  [220, 160, 110], // sun-faded ochre
];

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

// ── Scroll-direction debris ──
// Irregular paper/leaf scraps kicked up by scroll motion: spawn rate
// climbs with |scrollVelocity|, scraps inherit a velocity impulse in
// the wind direction, then friction kills them.  Pure ballistic +
// friction → step() integrates them; rotation is a separate angular
// delta wrapped in scaled().  Spawn rolls a chance() gate whose
// probability scales with |scrollVelocity| (clamped to SPAWN_PROB_MAX),
// so reduced motion suppresses both spawn and any in-flight rotation.
export const DEBRIS = defineConstants(
  "particles.upsideDownDebris",
  {
    POOL: {
      value: 60,
      min: 10,
      max: 200,
      step: 1,
      description: "Total debris slots",
    },
    SPAWN_PER_PX: {
      value: 0.04,
      min: 0,
      max: 0.5,
      step: 0.005,
      description:
        "Per-frame spawn probability per unit |scrollVelocity| (clamped)",
    },
    SPAWN_THRESHOLD: {
      value: 0.5,
      min: 0,
      max: 5,
      step: 0.05,
      description: "Minimum |scrollVelocity| required for any debris to spawn",
    },
    SPAWN_PROB_MAX: {
      value: 0.6,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Cap on per-frame spawn probability regardless of velocity",
    },
    WIND_VY_MUL: {
      value: -0.6,
      min: -3,
      max: 3,
      step: 0.05,
      description:
        "Initial vy as multiple of scrollVelocity (negative so positive scroll pushes scraps toward visual top in flipped view)",
    },
    SCATTER_VX: {
      value: 1.2,
      min: 0,
      max: 5,
      step: 0.1,
      description: "Lateral random-scatter component on spawn velocity",
    },
    SCATTER_VY: {
      value: 0.4,
      min: 0,
      max: 5,
      step: 0.1,
      description: "Vertical random-scatter component on spawn velocity",
    },
    FRICTION: {
      value: 0.965,
      min: 0.5,
      max: 1,
      step: 0.005,
      description: "Per-frame velocity damping",
    },
    LIFE_MIN: {
      value: 100,
      min: 10,
      max: 400,
      step: 1,
      description: "Min lifetime (frames)",
    },
    LIFE_RANGE: {
      value: 80,
      min: 0,
      max: 400,
      step: 1,
      description: "Lifetime variation",
    },
    SIZE_MIN: {
      value: 4,
      min: 1,
      max: 16,
      step: 0.5,
      description: "Min scrap radius (px)",
    },
    SIZE_RANGE: {
      value: 5,
      min: 0,
      max: 16,
      step: 0.5,
      description: "Scrap radius variation",
    },
    VERT_COUNT_MIN: {
      value: 3,
      min: 3,
      max: 8,
      step: 1,
      description: "Min polygon vertex count",
    },
    VERT_COUNT_RANGE: {
      value: 3,
      min: 0,
      max: 6,
      step: 1,
      description: "Vertex count variation",
    },
    VERT_JITTER_FRAC: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.05,
      description:
        "Random radius jitter on each vertex as fraction of base size",
    },
    ROT_SPEED_MIN: {
      value: 0.02,
      min: 0,
      max: 0.3,
      step: 0.005,
      description: "Min angular spin (radians/frame)",
    },
    ROT_SPEED_RANGE: {
      value: 0.08,
      min: 0,
      max: 0.3,
      step: 0.005,
      description: "Spin variation",
    },
    ALPHA_PEAK: {
      value: 0.85,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Peak scrap opacity",
    },
    FADE_HOLD: {
      value: 0.5,
      min: 0,
      max: 0.95,
      step: 0.05,
      description: "Lifetime fraction at full alpha before fading begins",
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

export class Debris {
  constructor() {
    this.active = false;
  }
  spawn(scrollVelocity) {
    // Spawn anywhere across the canvas — the scroll-wind reads as
    // turbulent rather than emanating from a single edge, so debris
    // catching it can come from any height.
    this.x = Math.random() * _canvas.width;
    this.y = Math.random() * _canvas.height;
    // Wind impulse — vy follows -scrollVelocity (matches the existing
    // ScrollMote's atmosphere pattern: positive scroll → negative vy).
    // Positive vx scatter is uncorrelated with scroll direction so the
    // debris field reads as turbulent rather than uniformly directional.
    this.vx = (Math.random() - 0.5) * 2 * DEBRIS.SCATTER_VX;
    this.vy =
      scrollVelocity * DEBRIS.WIND_VY_MUL +
      (Math.random() - 0.5) * 2 * DEBRIS.SCATTER_VY;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed =
      (Math.random() < 0.5 ? -1 : 1) *
      (DEBRIS.ROT_SPEED_MIN + Math.random() * DEBRIS.ROT_SPEED_RANGE);
    this.size = DEBRIS.SIZE_MIN + Math.random() * DEBRIS.SIZE_RANGE;
    this.life = 0;
    this.maxLife = DEBRIS.LIFE_MIN + Math.random() * DEBRIS.LIFE_RANGE;
    this.color = DEBRIS_RGBS[Math.floor(Math.random() * DEBRIS_RGBS.length)];
    // Generate an irregular polygon — vertex count + per-vertex radius
    // jitter on top of the base size.  Stored as { cos, sin, r } tuples
    // so draw doesn't recompute trig per frame.
    const vertCount =
      DEBRIS.VERT_COUNT_MIN +
      Math.floor(Math.random() * DEBRIS.VERT_COUNT_RANGE);
    this.verts = [];
    for (let i = 0; i < vertCount; i++) {
      const a = (i / vertCount) * Math.PI * 2;
      const jitter = 1 + (Math.random() - 0.5) * 2 * DEBRIS.VERT_JITTER_FRAC;
      this.verts.push({
        cos: Math.cos(a),
        sin: Math.sin(a),
        r: this.size * jitter,
      });
    }
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.life++;
    if (this.life > this.maxLife) {
      this.active = false;
      return;
    }
    step(this, 1, DEBRIS.FRICTION);
    this.rotation += scaled(this.rotSpeed);
  }
  draw() {
    if (!this.active) return;
    const t = this.life / this.maxLife;
    const alpha =
      t < DEBRIS.FADE_HOLD
        ? DEBRIS.ALPHA_PEAK
        : DEBRIS.ALPHA_PEAK *
          (1 - (t - DEBRIS.FADE_HOLD) / (1 - DEBRIS.FADE_HOLD));
    const c = this.color;
    _ctx.save();
    _ctx.translate(this.x, this.y);
    _ctx.rotate(this.rotation);
    _ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    _ctx.beginPath();
    for (let i = 0; i < this.verts.length; i++) {
      const v = this.verts[i];
      const px = v.cos * v.r;
      const py = v.sin * v.r;
      if (i === 0) _ctx.moveTo(px, py);
      else _ctx.lineTo(px, py);
    }
    _ctx.closePath();
    _ctx.fill();
    _ctx.restore();
  }
}

// ── Factory ──

export function createUpsideDown(canvasEl, ctxEl) {
  _canvas = canvasEl;
  _ctx = ctxEl;

  const dust = Array.from({ length: DUST.POOL }, () => new Dust());
  const debris = Array.from({ length: DEBRIS.POOL }, () => new Debris());

  return {
    draw(forces, scrollVelocity = 0) {
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

      // Debris — spawn rate climbs with |scrollVelocity|, capped so a
      // frantic scroll doesn't flood the field.  chance() folds in the
      // motion budget so reduced-motion users see no new spawns.
      const absSv = Math.abs(scrollVelocity);
      if (absSv >= DEBRIS.SPAWN_THRESHOLD) {
        const p = Math.min(DEBRIS.SPAWN_PROB_MAX, absSv * DEBRIS.SPAWN_PER_PX);
        if (chance(p)) {
          const slot = debris.find((d) => !d.active);
          if (slot) slot.spawn(scrollVelocity);
        }
      }
      for (const d of debris) {
        d.update();
        d.draw();
      }
    },

    cleanup() {
      for (const d of dust) d.active = false;
      for (const d of debris) d.active = false;
    },
  };
}
