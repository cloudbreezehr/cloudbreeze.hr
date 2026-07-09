import { drawHaloParticle, rgbaStr } from "../canvas-utils.js";
import { defineConstants } from "../dev/registry.js";
import {
  getSkyStars,
  getStarsFadeOpacity,
  starScreenInstances,
} from "../sky.js";
import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { scaled, prefersReducedMotion } from "../motion.js";

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

// ── Strum ──
// A formed constellation's chain is an instrument — a drag swept through a
// segment plucks that string. The cooldown keeps a wiggling pointer from
// machine-gunning one string; shimmers are the pluck's visible ripple.
const STRUM = defineConstants(
  "particles.constellation.strum",
  {
    COOLDOWN_MS: 260,
    SHIMMER_MS: 550,
    SHIMMER_MAX: 12,
    SHIMMER_RADIUS: 5,
    SHIMMER_OPACITY: 0.9,
    FLASH_OPACITY: 0.5,
  },
  { theme: "constellation" },
);

// Signed parallelogram area — which side of a→b the point c falls on.
function orient(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

// Proper segment crossing (shared endpoints and collinear grazes don't
// count — a strum is a sweep through the string, not a touch on it).
function segmentsCross(p, q, a, b) {
  const d1 = orient(p, q, a);
  const d2 = orient(p, q, b);
  const d3 = orient(a, b, p);
  const d4 = orient(a, b, q);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

// Where along a→b the swipe crossed, 0..1.
function crossingParam(p, q, a, b) {
  const d1 = orient(p, q, a);
  const d2 = orient(p, q, b);
  return d1 / (d1 - d2);
}

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

  // Live shimmer ripples and per-string pluck times; scroll progress from the
  // most recent frame so strum() projects strings exactly where they render.
  const shimmers = [];
  const lastStrumAt = new Map();
  let lastSp = 0;

  function setChain(state) {
    chainState = state || { chain: [], candidateId: null, isActive: false };
    // A dissolved or re-traced chain invalidates its strings.
    if (!chainState.isActive) {
      shimmers.length = 0;
      lastStrumAt.clear();
    }
  }

  // Invariant: same projection as the star renderer — any divergence
  // visually disconnects chain lines from their stars.  A star can be off
  // this window's slice of the linked sky (no instances); its chain
  // segments and halo simply don't render here.
  function starScreenPos(star, sp) {
    const inst = starScreenInstances(star, sp, canvas);
    return inst.length > 0 ? inst[0] : null;
  }

  // Resolve the chain into its valid on-screen segments this frame. One
  // place owns the wrap-skip rules so the renderer and the strum hit-test
  // agree on what a "string" is.
  function chainSegments(stars, sp) {
    const out = [];
    const wrapLimitY = canvas.height * CHAIN.WRAP_SKIP_RATIO;
    const wrapLimitX = canvas.width * CHAIN.WRAP_SKIP_RATIO;
    for (let i = 1; i < chainState.chain.length; i++) {
      const prev = stars[chainState.chain[i - 1].index];
      const cur = stars[chainState.chain[i].index];
      if (!prev || !cur) continue;
      const a = starScreenPos(prev, sp);
      const b = starScreenPos(cur, sp);
      if (!a || !b) continue;
      if (Math.abs(a.y - b.y) > wrapLimitY) continue;
      if (Math.abs(a.x - b.x) > wrapLimitX) continue;
      out.push({ seg: i, a, b });
    }
    return out;
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

    const segments = chainSegments(stars, sp);
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
    for (const { a, b } of segments) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();

    drawShimmers(segments, lineColor, glowColor, fade);

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
      const pos = starScreenPos(s, sp);
      if (!pos) continue;
      drawHaloParticle(
        ctx,
        pos.x,
        pos.y,
        s.r * CHAIN.HALO_RADIUS_MULT,
        CHAIN.HALO_OPACITY * fade,
        glowColor,
        haloOpts,
      );
    }
    ctx.restore();
  }

  // The pluck's ripple: a brief re-brightening of the plucked string with a
  // pair of glints running outward from the crossing point to both stars.
  function drawShimmers(segments, lineColor, glowColor, fade) {
    if (shimmers.length === 0) return;
    const byIndex = new Map(segments.map((s) => [s.seg, s]));
    const now = performance.now();
    const haloOpts = {
      midStop: CHAIN.GLOW_MID_STOP,
      midAlpha: CHAIN.GLOW_MID_ALPHA,
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = CHAIN.LINE_WIDTH;
    ctx.lineCap = "round";
    for (let k = shimmers.length - 1; k >= 0; k--) {
      const sh = shimmers[k];
      const t = (now - sh.start) / STRUM.SHIMMER_MS;
      if (t >= 1) {
        shimmers.splice(k, 1);
        continue;
      }
      // The string may have left the screen mid-ripple; let it expire quietly.
      const segment = byIndex.get(sh.seg);
      if (!segment) continue;
      const { a, b } = segment;
      const alpha = (1 - t) * fade;
      ctx.strokeStyle = rgbaStr(lineColor, STRUM.FLASH_OPACITY * alpha);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const crossX = a.x + (b.x - a.x) * sh.u;
      const crossY = a.y + (b.y - a.y) * sh.u;
      for (const end of [a, b]) {
        drawHaloParticle(
          ctx,
          crossX + (end.x - crossX) * t,
          crossY + (end.y - crossY) * t,
          STRUM.SHIMMER_RADIUS,
          STRUM.SHIMMER_OPACITY * alpha,
          glowColor,
          haloOpts,
        );
      }
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
      // Feed the raw scroll velocity; update()'s single scaled() applies the
      // motion budget once, as snow/rain/bubble do. (Adding the already-scaled
      // drawVelocity here would double-scale it once budgets aren't just 0/1.)
      d.vy += frame.scrollVelocity * DUST.SPAWN_VELOCITY_SCALE;
      d.draw(color);
    }
  }

  return {
    draw(frame) {
      lastSp = frame.sp;
      const pal = frame.palFor("constellation");
      drawChain(pal, frame.sp);
      drawDust(frame);
    },
    setChain,

    // Hit-test a pointer swipe (previous → current drag point, canvas
    // coords) against the formed chain's strings, at the projection of the
    // most recent frame. Each crossed string plucks at most once per
    // cooldown: its shimmer spawns here (a one-shot flash, skipped entirely
    // under reduced motion) and one entry per pluck is returned so the
    // caller can sound and reward it. Pitch rides how high the string hangs.
    strum(px, py, qx, qy) {
      if (!chainState.isActive || chainState.chain.length < 2) return [];
      if (getStarsFadeOpacity(lastSp) <= 0) return [];
      const stars = getSkyStars();
      if (!stars) return [];
      const now = performance.now();
      const p = { x: px, y: py };
      const q = { x: qx, y: qy };
      const plucks = [];
      for (const { seg, a, b } of chainSegments(stars, lastSp)) {
        if (!segmentsCross(p, q, a, b)) continue;
        const last = lastStrumAt.get(seg) ?? -Infinity;
        if (now - last < STRUM.COOLDOWN_MS) continue;
        lastStrumAt.set(seg, now);
        if (!prefersReducedMotion() && shimmers.length < STRUM.SHIMMER_MAX) {
          shimmers.push({ seg, u: crossingParam(p, q, a, b), start: now });
        }
        const midY = (a.y + b.y) / 2;
        plucks.push({
          pitch: Math.min(1, Math.max(0, 1 - midY / canvas.height)),
        });
      }
      return plucks;
    },
  };
}
