import { drawHaloParticle, rgbaStr } from "../canvas-utils.js";
import { defineConstants } from "../dev/registry.js";
import {
  getSkyStars,
  getStarsParallaxScale,
  getStarsFadeOpacity,
} from "../sky.js";
import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { scaled } from "../motion.js";

// ── Chain Drawing ──
const CHAIN = defineConstants(
  "particles.constellation.chain",
  {
    LINE_WIDTH: 1.4,
    LINE_OPACITY_BASE: 0.25,
    LINE_OPACITY_ACTIVE: 0.85,
    HALO_RADIUS_MULT: 8,
    HALO_OPACITY: 0.6,
    GLOW_MID_STOP: 0.4,
    GLOW_MID_ALPHA: 0.5,
    // Stars wrap vertically via `% canvas.height` once parallax shift
    // exceeds their raw y.  A segment whose endpoints sit on opposite
    // sides of that wrap shouldn't render — the line would span the
    // viewport.  Half the canvas height is a safe threshold so long as
    // PLANTED_SCALE * max-normalized-offset stays under half the
    // minimum supported viewport height; if PLANTED_SCALE grows past
    // ~250 (currently 70), revisit this constant or derive it from the
    // planted footprint instead.
    WRAP_SKIP_RATIO: 0.5,
  },
  { theme: "constellation" },
);

// ── Cosmic Dust ──
const DUST = defineConstants(
  "particles.constellation.dust",
  {
    COUNT: 30,
    RADIUS_MIN: 0.4,
    RADIUS_RANGE: 1.0,
    OPACITY_MIN: 0.15,
    OPACITY_RANGE: 0.35,
    DRIFT_MIN: 0.05,
    DRIFT_RANGE: 0.18,
    SWAY_SPEED_MIN: 0.003,
    SWAY_SPEED_RANGE: 0.01,
    SWAY_AMP: 0.4,
    FRICTION: 0.94,
    REPEL_RADIUS: 90,
    REPEL_DAMPEN: 0.7,
    ATTRACT_RADIUS: 160,
    ATTRACT_FORCE: 0.04,
    ATTRACT_TANGENT: 0.6,
    GLOW_RADIUS_MULT: 4,
    GLOW_MID_STOP: 0.35,
    GLOW_MID_ALPHA: 0.4,
    SPAWN_VELOCITY_SCALE: 0.02,
  },
  { theme: "constellation" },
);

class Dust {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.reset(true);
  }
  reset(init) {
    this.x = Math.random() * this.canvas.width;
    this.y = init
      ? Math.random() * this.canvas.height
      : this.canvas.height + Math.random() * 20;
    this.r = DUST.RADIUS_MIN + Math.random() * DUST.RADIUS_RANGE;
    this.opacity = DUST.OPACITY_MIN + Math.random() * DUST.OPACITY_RANGE;
    this.driftSpeed = DUST.DRIFT_MIN + Math.random() * DUST.DRIFT_RANGE;
    this.sway = Math.random() * Math.PI * 2;
    this.swaySpeed =
      DUST.SWAY_SPEED_MIN + Math.random() * DUST.SWAY_SPEED_RANGE;
    this.vx = 0;
    this.vy = 0;
  }
  update() {
    this.sway += scaled(this.swaySpeed);
    this.x += scaled(Math.sin(this.sway) * DUST.SWAY_AMP + this.vx);
    this.y -= scaled(this.driftSpeed + this.vy);
    this.vx *= DUST.FRICTION;
    this.vy *= DUST.FRICTION;
    if (this.y < -10) this.reset(false);
    if (this.x < -20) this.x += this.canvas.width + 40;
    if (this.x > this.canvas.width + 20) this.x -= this.canvas.width + 40;
  }
  draw(color) {
    drawHaloParticle(
      this.ctx,
      this.x,
      this.y,
      this.r * DUST.GLOW_RADIUS_MULT,
      this.opacity,
      color,
      { midStop: DUST.GLOW_MID_STOP, midAlpha: DUST.GLOW_MID_ALPHA },
    );
  }
}

export function createConstellation(canvasEl) {
  const canvas = canvasEl;
  const ctx = canvasEl.getContext("2d");

  const dust = Array.from({ length: DUST.COUNT }, () => new Dust(canvas, ctx));

  // Indices, not pixel positions, so the chain re-anchors automatically
  // as stars shift on scroll parallax or canvas resize.
  let chainState = { chain: [], candidateId: null, isActive: false };

  function setChain(state) {
    chainState = state || { chain: [], candidateId: null, isActive: false };
  }

  // Invariant: same parallax projection used by the star renderer —
  // any divergence visually disconnects chain lines from their stars.
  function starScreenPos(star, sp, canvasH, canvasW) {
    const shift = star.depth * sp * canvasH * getStarsParallaxScale();
    const sx = star.x % canvasW;
    const py = (((star.y - shift) % canvasH) + canvasH) % canvasH;
    return { sx, py };
  }

  function drawChain(pal, sp) {
    if (chainState.chain.length === 0) return;
    const stars = getSkyStars();
    if (!stars) return;
    const fade = getStarsFadeOpacity(sp);
    if (fade <= 0) return;
    const lineColor = pal.constellationLine;
    const glowColor = pal.constellationGlow;
    if (!lineColor || !glowColor) return;

    const w = canvas.width;
    const h = canvas.height;
    const wrapLimitY = h * CHAIN.WRAP_SKIP_RATIO;
    const wrapLimitX = w * CHAIN.WRAP_SKIP_RATIO;
    const lineOpacity =
      (chainState.isActive
        ? CHAIN.LINE_OPACITY_ACTIVE
        : CHAIN.LINE_OPACITY_BASE) * fade;

    // Lines first (under halos)
    ctx.save();
    ctx.strokeStyle = rgbaStr(lineColor, lineOpacity);
    ctx.lineWidth = CHAIN.LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 1; i < chainState.chain.length; i++) {
      const prev = stars[chainState.chain[i - 1].index];
      const cur = stars[chainState.chain[i].index];
      if (!prev || !cur) continue;
      const a = starScreenPos(prev, sp, h, w);
      const b = starScreenPos(cur, sp, h, w);
      if (Math.abs(a.py - b.py) > wrapLimitY) continue;
      if (Math.abs(a.sx - b.sx) > wrapLimitX) continue;
      ctx.moveTo(a.sx, a.py);
      ctx.lineTo(b.sx, b.py);
    }
    ctx.stroke();
    ctx.restore();

    // Halos
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const haloOpts = {
      midStop: CHAIN.GLOW_MID_STOP,
      midAlpha: CHAIN.GLOW_MID_ALPHA,
    };
    for (const c of chainState.chain) {
      const s = stars[c.index];
      if (!s) continue;
      const { sx, py } = starScreenPos(s, sp, h, w);
      drawHaloParticle(
        ctx,
        sx,
        py,
        s.r * CHAIN.HALO_RADIUS_MULT,
        CHAIN.HALO_OPACITY * fade,
        glowColor,
        haloOpts,
      );
    }
    ctx.restore();
  }

  function drawDust(frame) {
    if (!chainState.isActive) return;
    const pal = frame.palFor("constellation");
    const color = pal.cosmicDust;
    if (!color) return;
    for (const d of dust) {
      d.update();
      applyRepulsion(frame.forces, d, DUST.REPEL_RADIUS, DUST.REPEL_DAMPEN);
      applyAttraction(
        frame.forces,
        d,
        DUST.ATTRACT_RADIUS,
        DUST.ATTRACT_FORCE,
        DUST.ATTRACT_TANGENT,
      );
      applyWellForce(frame.forces, d);
      // drawVelocity is already motion-scaled by the orchestrator; the
      // dust would compound the scale if wrapped again.
      d.vy += frame.drawVelocity * DUST.SPAWN_VELOCITY_SCALE;
      d.draw(color);
    }
  }

  return {
    draw(frame) {
      const pal = frame.palFor("constellation");
      drawChain(pal, frame.sp);
      drawDust(frame);
    },
    setChain,
  };
}
