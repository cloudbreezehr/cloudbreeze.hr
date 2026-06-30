import { Z_PAPER_INK } from "../layers.js";
import { defineConstants } from "../dev/registry.js";
import { reducedDuration, scaled, prefersReducedMotion } from "../motion.js";
import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";

// ── Ink SVG filter id — shared by splats and strokes ──
const INK_FILTER_ID = "paper-ink-wobble";

// ── Static sketch elements ──
const SKETCH = defineConstants(
  "particles.paper",
  {
    DOT_COUNT: {
      value: 40,
      min: 0,
      max: 120,
      step: 1,
      description: "Ink-dot stars",
    },
    DOT_RADIUS_MIN: {
      value: 0.7,
      min: 0.3,
      max: 3,
      step: 0.1,
      description: "Min ink-dot radius (px)",
    },
    DOT_RADIUS_RANGE: {
      value: 0.9,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Ink-dot radius variation",
    },
    DOT_SKY_FRACTION: {
      value: 0.6,
      min: 0.1,
      max: 0.95,
      step: 0.05,
      description: "Fraction of viewport height used for ink dots (from top)",
    },
    ASTERISK_CHANCE: {
      value: 0.1,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Fraction of dots drawn as three-stroke asterisks",
    },
    ASTERISK_ARM: {
      value: 3,
      min: 1,
      max: 10,
      step: 0.5,
      description: "Asterisk arm half-length (px)",
    },
    ASTERISK_DIAG_RATIO: {
      value: 0.7,
      min: 0.3,
      max: 1,
      step: 0.05,
      description: "Asterisk diagonal arms as fraction of main arm length",
    },
    ASTERISK_WIDTH: {
      value: 1,
      min: 0.3,
      max: 3,
      step: 0.1,
      description: "Asterisk stroke width",
    },
    DOT_ALPHA: {
      value: 0.85,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Ink-dot opacity",
    },
    HORIZON_POINTS: {
      value: 60,
      min: 10,
      max: 200,
      step: 2,
      description: "Wobble samples across the horizon line",
    },
    HORIZON_Y_FRAC: {
      value: 0.72,
      min: 0.4,
      max: 0.95,
      step: 0.01,
      description: "Horizon baseline as fraction of canvas height",
    },
    HORIZON_WOBBLE: {
      value: 3,
      min: 0,
      max: 20,
      step: 0.5,
      description: "Horizon max vertical wobble (px)",
    },
    HORIZON_WIDTH: {
      value: 1.6,
      min: 0.5,
      max: 5,
      step: 0.1,
      description: "Horizon stroke width",
    },
    HORIZON_ALPHA: {
      value: 0.9,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Horizon stroke opacity",
    },
  },
  { theme: "paper" },
);

// ── Ink-dot interaction forces ──
// The sketch dots rest on the page but smudge away from clicks/drags and a
// gravity well via the shared forces, then a spring reels each back home —
// gentler than the bold pop-art halftone so the graphite just nudges.
const INK = defineConstants(
  "particles.paperInk",
  {
    REPEL_RADIUS: {
      value: 120,
      min: 30,
      max: 400,
      step: 10,
      description: "Click smudge radius (px)",
    },
    REPEL_DAMPEN: {
      value: 0.7,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Click smudge strength",
    },
    ATTRACT_RADIUS: {
      value: 130,
      min: 30,
      max: 400,
      step: 10,
      description: "Drag attraction radius (px)",
    },
    ATTRACT_STRENGTH: {
      value: 0.08,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Drag attraction force",
    },
    ATTRACT_TANGENT: {
      value: 0.5,
      min: 0,
      max: 2,
      step: 0.05,
      description: "Tangential orbit factor under drag",
    },
    SPRING: {
      value: 0.08,
      min: 0.01,
      max: 0.4,
      step: 0.01,
      description: "Pull back toward the dot's resting spot",
    },
    FRICTION: {
      value: 0.86,
      min: 0.5,
      max: 0.99,
      step: 0.01,
      description: "Per-frame velocity damping",
    },
  },
  { theme: "paper" },
);

// ── Pencil flicks (shooting-star replacement) ──
const FLICK = defineConstants(
  "particles.paperFlick",
  {
    ALPHA_PEAK: {
      value: 0.9,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Flick peak stroke opacity",
    },
    FADE_AT: {
      value: 0.5,
      min: 0.1,
      max: 0.95,
      step: 0.05,
      description: "Lifetime fraction where fade-out begins",
    },
    MAX_ACTIVE: {
      value: 3,
      min: 1,
      max: 8,
      step: 1,
      description: "Max simultaneous pencil flicks",
    },
    INTERVAL_MIN: {
      value: 4000,
      min: 1000,
      max: 20000,
      step: 250,
      description: "Min ms between pencil flicks",
    },
    INTERVAL_RANGE: {
      value: 4000,
      min: 0,
      max: 20000,
      step: 250,
      description: "Pencil-flick interval variation",
    },
    LIFE_MS: {
      value: 600,
      min: 150,
      max: 2000,
      step: 25,
      description: "Pencil-flick total lifetime (ms)",
    },
    DRAW_MS: {
      value: 220,
      min: 80,
      max: 800,
      step: 10,
      description: "Draw-on phase before fading (ms)",
    },
    LEN_MIN: {
      value: 22,
      min: 5,
      max: 80,
      step: 1,
      description: "Min flick length (px)",
    },
    LEN_RANGE: {
      value: 20,
      min: 0,
      max: 80,
      step: 1,
      description: "Flick length variation",
    },
    ANGLE_MIN: {
      value: -0.9,
      min: -1.5,
      max: 1.5,
      step: 0.05,
      description: "Flick angle range start (radians, negative = up-right)",
    },
    ANGLE_RANGE: {
      value: 0.5,
      min: 0,
      max: 3,
      step: 0.05,
      description: "Flick angle range width (radians)",
    },
    WIDTH: {
      value: 1.2,
      min: 0.3,
      max: 4,
      step: 0.1,
      description: "Flick stroke width",
    },
  },
  { theme: "paper" },
);

// ── Ink splats (DOM pool) ──
const SPLAT = defineConstants(
  "particles.paperSplat",
  {
    MAX: {
      value: 30,
      min: 5,
      max: 80,
      step: 1,
      description: "Max simultaneous ink splats",
    },
    SIZE_MIN: {
      value: 8,
      min: 2,
      max: 30,
      step: 1,
      description: "Min splat diameter (px)",
    },
    SIZE_RANGE: {
      value: 8,
      min: 0,
      max: 40,
      step: 1,
      description: "Splat diameter variation",
    },
    LIFE_MS: {
      value: 1200,
      min: 200,
      max: 4000,
      step: 50,
      description: "Splat lifetime (ms)",
    },
    START_ALPHA: {
      value: 0.8,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Splat starting opacity",
    },
  },
  { theme: "paper" },
);

// ── Drag strokes (DOM pool) ──
const STROKE = defineConstants(
  "particles.paperStroke",
  {
    MAX: {
      value: 10,
      min: 2,
      max: 30,
      step: 1,
      description: "Max simultaneous ink strokes",
    },
    FADE_MS: {
      value: 3000,
      min: 500,
      max: 8000,
      step: 100,
      description: "Stroke fade duration (ms)",
    },
    DISPLACE_MS: {
      value: 150,
      min: 50,
      max: 1000,
      step: 25,
      description: "Forced fade when evicting an over-cap stroke (ms)",
    },
    WIDTH: {
      value: 1.6,
      min: 0.5,
      max: 5,
      step: 0.1,
      description: "Stroke width (px)",
    },
    WOBBLE_AMP: {
      value: 0.7,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Perpendicular wobble amplitude (px)",
    },
    WOBBLE_FREQ: {
      value: 0.18,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Wobble angular frequency per-sample",
    },
    MIN_SAMPLE_DIST: {
      value: 2,
      min: 0,
      max: 20,
      step: 0.5,
      description: "Min px between successive sampled points",
    },
  },
  { theme: "paper" },
);

// ── Pencil shavings ──
// Tiny graphite specks that fall when the cursor crosses a hovered text
// element's proximity threshold.  Gravity is part of the integration so
// step() doesn't fit — but per-frame motion math still goes through
// scaled() (and stochastic spawn through chance() at the call site).
const SHAVING = defineConstants(
  "particles.paperShaving",
  {
    POOL: {
      value: 96,
      min: 16,
      max: 256,
      step: 8,
      description: "Total shaving slots",
    },
    COUNT_MIN: {
      value: 2,
      min: 1,
      max: 10,
      step: 1,
      description: "Min shavings per crossing",
    },
    COUNT_RANGE: {
      value: 3,
      min: 0,
      max: 10,
      step: 1,
      description: "Shaving count variation",
    },
    SPEED_MIN: {
      value: 0.6,
      min: 0,
      max: 4,
      step: 0.1,
      description: "Min sideways scatter speed (px/frame)",
    },
    SPEED_RANGE: {
      value: 1.2,
      min: 0,
      max: 4,
      step: 0.1,
      description: "Sideways scatter variation",
    },
    VY_INITIAL: {
      value: -0.4,
      min: -3,
      max: 1,
      step: 0.1,
      description: "Initial vertical velocity (negative = a slight pop up)",
    },
    GRAVITY: {
      value: 0.06,
      min: 0,
      max: 0.5,
      step: 0.005,
      description: "Per-frame gravity acceleration",
    },
    LIFE_MIN: {
      value: 60,
      min: 10,
      max: 240,
      step: 1,
      description: "Min lifetime (frames)",
    },
    LIFE_RANGE: {
      value: 30,
      min: 0,
      max: 240,
      step: 1,
      description: "Lifetime variation",
    },
    LEN_MIN: {
      value: 1.4,
      min: 0.5,
      max: 6,
      step: 0.1,
      description: "Min shaving length (px)",
    },
    LEN_RANGE: {
      value: 1.6,
      min: 0,
      max: 6,
      step: 0.1,
      description: "Shaving length variation",
    },
    WIDTH_FRAC: {
      value: 0.3,
      min: 0.05,
      max: 1,
      step: 0.05,
      description: "Shaving half-width as fraction of length",
    },
    VY_SCATTER_FRAC: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.05,
      description:
        "Vertical-component scale on the random scatter at spawn (lower = flatter outward fan)",
    },
    ROT_SPEED_MIN: {
      value: 0.02,
      min: 0,
      max: 0.3,
      step: 0.005,
      description: "Min angular spin (radians/frame)",
    },
    ROT_SPEED_RANGE: {
      value: 0.05,
      min: 0,
      max: 0.3,
      step: 0.005,
      description: "Spin variation",
    },
    ALPHA_PEAK: {
      value: 0.7,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Peak shaving opacity",
    },
    FADE_HOLD: {
      value: 0.5,
      min: 0,
      max: 0.95,
      step: 0.05,
      description: "Lifetime fraction at full alpha before fading begins",
    },
  },
  { theme: "paper" },
);

const SVG_NS = "http://www.w3.org/2000/svg";

// ── Ink-filter singleton — one <defs> for the whole page ──
function ensureInkFilter() {
  if (document.getElementById(INK_FILTER_ID)) return;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText =
    "position:absolute;width:0;height:0;pointer-events:none;overflow:hidden";
  const defs = document.createElementNS(SVG_NS, "defs");
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", INK_FILTER_ID);
  filter.setAttribute("x", "-20%");
  filter.setAttribute("y", "-20%");
  filter.setAttribute("width", "140%");
  filter.setAttribute("height", "140%");
  const turb = document.createElementNS(SVG_NS, "feTurbulence");
  turb.setAttribute("type", "fractalNoise");
  turb.setAttribute("baseFrequency", "0.9");
  turb.setAttribute("numOctaves", "2");
  turb.setAttribute("result", "noise");
  const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
  disp.setAttribute("in", "SourceGraphic");
  disp.setAttribute("in2", "noise");
  disp.setAttribute("scale", "1.6");
  filter.appendChild(turb);
  filter.appendChild(disp);
  defs.appendChild(filter);
  svg.appendChild(defs);
  document.body.appendChild(svg);
}

// ── Ink-dot particle ──
// A resting sketch dot (or asterisk) that springs away from the pointer and
// settles back home. Drawn batched by the factory, so it has no draw() of its
// own — only home/position/velocity and the per-frame force integration.
export class InkDot {
  constructor(x, y, r, asterisk) {
    this.hx = x;
    this.hy = y;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = r;
    this.asterisk = asterisk;
  }

  update(forces) {
    if (!forces) return;
    applyRepulsion(forces, this, INK.REPEL_RADIUS, INK.REPEL_DAMPEN);
    applyAttraction(
      forces,
      this,
      INK.ATTRACT_RADIUS,
      INK.ATTRACT_STRENGTH,
      INK.ATTRACT_TANGENT,
    );
    applyWellForce(forces, this);
    // Spring back toward home — this plus the scatter above is the whole motion
    // budget, so both go through scaled() for reduced motion.
    this.vx += (this.hx - this.x) * INK.SPRING;
    this.vy += (this.hy - this.y) * INK.SPRING;
    this.x += scaled(this.vx);
    this.y += scaled(this.vy);
    // Friction is damping, not motion — it stays outside scaled() so coasting
    // velocity bleeds off even when the budget is zero.
    this.vx *= INK.FRICTION;
    this.vy *= INK.FRICTION;
  }
}

// ── Pencil-flick particle ──
class Flick {
  constructor() {
    this.active = false;
  }
  spawn(cw, ch, now) {
    const angle = FLICK.ANGLE_MIN + Math.random() * FLICK.ANGLE_RANGE;
    const len = FLICK.LEN_MIN + Math.random() * FLICK.LEN_RANGE;
    this.x0 = Math.random() * cw;
    this.y0 = Math.random() * ch * SKETCH.DOT_SKY_FRACTION;
    this.dx = Math.cos(angle) * len;
    this.dy = Math.sin(angle) * len;
    this.start = now;
    this.active = true;
  }
  draw(ctx, now, rgb) {
    if (!this.active) return;
    const t = (now - this.start) / FLICK.LIFE_MS;
    if (t >= 1) {
      this.active = false;
      return;
    }
    const drawT = Math.min(1, (now - this.start) / FLICK.DRAW_MS);
    const alpha =
      t < FLICK.FADE_AT
        ? FLICK.ALPHA_PEAK
        : FLICK.ALPHA_PEAK * (1 - (t - FLICK.FADE_AT) / (1 - FLICK.FADE_AT));
    const x1 = this.x0 + this.dx * drawT;
    const y1 = this.y0 + this.dy * drawT;
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
    ctx.lineWidth = FLICK.WIDTH;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(this.x0, this.y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

// ── Pencil shaving particle ──
// Slim graphite sliver that falls under gravity when the cursor crosses
// a hovered text element's proximity threshold.  Pure ballistic + gravity
// + friction-free motion — gravity rules out step() (which only handles
// the vx/vy + friction shape), so vx/vy and the gravity impulse all run
// through scaled() instead.

export class Shaving {
  constructor() {
    this.active = false;
  }
  spawn(x, y, inkRgb) {
    this.x = x;
    this.y = y;
    // Sideways scatter — full radial in the horizontal plane, then a
    // small upward kick to look "popped off" before gravity takes over.
    const angle = Math.random() * Math.PI * 2;
    const speed = SHAVING.SPEED_MIN + Math.random() * SHAVING.SPEED_RANGE;
    this.vx = Math.cos(angle) * speed;
    this.vy =
      Math.sin(angle) * speed * SHAVING.VY_SCATTER_FRAC + SHAVING.VY_INITIAL;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed =
      (Math.random() < 0.5 ? -1 : 1) *
      (SHAVING.ROT_SPEED_MIN + Math.random() * SHAVING.ROT_SPEED_RANGE);
    this.len = SHAVING.LEN_MIN + Math.random() * SHAVING.LEN_RANGE;
    this.life = 0;
    this.maxLife = SHAVING.LIFE_MIN + Math.random() * SHAVING.LIFE_RANGE;
    this.color = inkRgb;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.life++;
    if (this.life > this.maxLife) {
      this.active = false;
      return;
    }
    // Gravity is a force, applied as a velocity delta each frame.  Wrap
    // it in scaled() so reduced-motion users see frozen shavings rather
    // than ones that accumulate downward velocity invisibly.
    this.vy += scaled(SHAVING.GRAVITY);
    this.x += scaled(this.vx);
    this.y += scaled(this.vy);
    this.rotation += scaled(this.rotSpeed);
  }
  draw(ctx) {
    if (!this.active) return;
    const t = this.life / this.maxLife;
    const alpha =
      t < SHAVING.FADE_HOLD
        ? SHAVING.ALPHA_PEAK
        : SHAVING.ALPHA_PEAK *
          (1 - (t - SHAVING.FADE_HOLD) / (1 - SHAVING.FADE_HOLD));
    const halfW = this.len * SHAVING.WIDTH_FRAC;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${this.color[0]},${this.color[1]},${this.color[2]})`;
    ctx.beginPath();
    ctx.moveTo(this.len / 2, 0);
    ctx.lineTo(0, halfW);
    ctx.lineTo(-this.len / 2, 0);
    ctx.lineTo(0, -halfW);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// ── Factory ──
export function createPaper(canvasEl, ctxEl) {
  ensureInkFilter();

  // ── Static sketch geometry — regenerated on resize ──
  let dots = [];
  let horizon = [];
  let lastW = 0;
  let lastH = 0;

  function regenerate() {
    const w = canvasEl.width;
    const h = canvasEl.height;
    dots = [];
    for (let i = 0; i < SKETCH.DOT_COUNT; i++) {
      dots.push(
        new InkDot(
          Math.random() * w,
          Math.random() * h * SKETCH.DOT_SKY_FRACTION,
          SKETCH.DOT_RADIUS_MIN + Math.random() * SKETCH.DOT_RADIUS_RANGE,
          Math.random() < SKETCH.ASTERISK_CHANCE,
        ),
      );
    }
    horizon = [];
    const baseY = h * SKETCH.HORIZON_Y_FRAC;
    for (let i = 0; i < SKETCH.HORIZON_POINTS; i++) {
      const t = i / (SKETCH.HORIZON_POINTS - 1);
      horizon.push({
        x: t * w,
        y: baseY + (Math.random() - 0.5) * 2 * SKETCH.HORIZON_WOBBLE,
      });
    }
    lastW = w;
    lastH = h;
  }

  regenerate();

  // Pools
  const flicks = Array.from({ length: FLICK.MAX_ACTIVE }, () => new Flick());
  let nextFlickTime =
    performance.now() +
    FLICK.INTERVAL_MIN +
    Math.random() * FLICK.INTERVAL_RANGE;

  // Splats — DOM nodes tracked in an array, evicted FIFO when at cap
  const splats = [];
  // Strokes — one record per active stroke
  const strokes = [];
  // Shavings — graphite slivers from cursor crossings on hover targets
  const shavings = Array.from({ length: SHAVING.POOL }, () => new Shaving());
  // Shared SVG root for strokes and splats
  const inkRoot = document.createElementNS(SVG_NS, "svg");
  inkRoot.setAttribute("aria-hidden", "true");
  inkRoot.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:${Z_PAPER_INK}`;
  document.body.appendChild(inkRoot);

  function syncInkRootSize() {
    inkRoot.setAttribute(
      "viewBox",
      `0 0 ${window.innerWidth} ${window.innerHeight}`,
    );
  }
  syncInkRootSize();
  window.addEventListener("resize", syncInkRootSize);

  // Palette ink color — cached from the most recent draw() so that
  // click/stroke handlers (called outside the render loop) can read it
  // without every caller having to thread pal through.
  let lastInkRgb = [26, 21, 18];
  function rgbFromPal(pal) {
    if (pal && pal.inkColor) lastInkRgb = pal.inkColor;
    return lastInkRgb;
  }

  function drawDots(ctx, rgb) {
    const alpha = SKETCH.DOT_ALPHA;
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
    ctx.lineWidth = SKETCH.ASTERISK_WIDTH;
    ctx.lineCap = "round";
    // Circles in one pass
    ctx.beginPath();
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      if (d.asterisk) continue;
      ctx.moveTo(d.x + d.r, d.y);
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    }
    ctx.fill();
    // Asterisks — batched strokes
    ctx.beginPath();
    const arm = SKETCH.ASTERISK_ARM;
    const diag = arm * SKETCH.ASTERISK_DIAG_RATIO;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      if (!d.asterisk) continue;
      ctx.moveTo(d.x - arm, d.y);
      ctx.lineTo(d.x + arm, d.y);
      ctx.moveTo(d.x, d.y - arm);
      ctx.lineTo(d.x, d.y + arm);
      ctx.moveTo(d.x - diag, d.y - diag);
      ctx.lineTo(d.x + diag, d.y + diag);
    }
    ctx.stroke();
  }

  function drawHorizon(ctx, rgb) {
    ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${SKETCH.HORIZON_ALPHA})`;
    ctx.lineWidth = SKETCH.HORIZON_WIDTH;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < horizon.length; i++) {
      const p = horizon[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  function updateFlicks(ctx, now, rgb, reducedMotion) {
    // Suspend new flick spawns under reduced motion; in-flight flicks
    // fade out naturally on their own below.
    if (!reducedMotion && now >= nextFlickTime) {
      const slot = flicks.find((f) => !f.active);
      if (slot) slot.spawn(canvasEl.width, canvasEl.height, now);
      nextFlickTime =
        now + (FLICK.INTERVAL_MIN + Math.random() * FLICK.INTERVAL_RANGE);
    }
    // In-flight flicks fade out naturally on their own; let them finish.
    for (const f of flicks) f.draw(ctx, now, rgb);
  }

  function cleanupEvicted() {
    while (splats.length > SPLAT.MAX) {
      const s = splats.shift();
      if (s && s.parentNode) s.parentNode.removeChild(s);
    }
    while (strokes.length > STROKE.MAX) {
      const s = strokes.shift();
      if (!s) break;
      // Force quick fade instead of instant removal
      const anim = s.el.animate(
        [{ opacity: s.el.style.opacity || "1" }, { opacity: 0 }],
        { duration: STROKE.DISPLACE_MS, fill: "forwards" },
      );
      anim.onfinish = () => {
        if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
      };
    }
  }

  return {
    draw(pal, forces, reducedMotion = false) {
      // Regenerate resting geometry if canvas resized
      if (canvasEl.width !== lastW || canvasEl.height !== lastH) regenerate();
      const rgb = rgbFromPal(pal);
      // Smudge the dots away from the pointer; each springs back home. The
      // scaled() inside update() freezes them under reduced motion.
      for (const d of dots) d.update(forces);
      ctxEl.save();
      drawDots(ctxEl, rgb);
      drawHorizon(ctxEl, rgb);
      updateFlicks(ctxEl, performance.now(), rgb, reducedMotion);
      // Shavings — pure ballistic + gravity, integrated by scaled().
      // Drawn in the same canvas pass as the static sketch; the ink
      // color of shavings matches the current palette's pen.
      for (const s of shavings) {
        s.update();
        s.draw(ctxEl);
      }
      ctxEl.restore();
    },

    spawnShaving(cx, cy) {
      // Discrete burst — gated on the OS preference rather than dampened.
      if (prefersReducedMotion()) return;
      const rgb = lastInkRgb;
      const count =
        SHAVING.COUNT_MIN + Math.floor(Math.random() * SHAVING.COUNT_RANGE);
      for (let i = 0; i < count; i++) {
        const s = shavings.find((s) => !s.active);
        if (!s) break;
        s.spawn(cx, cy, rgb);
      }
    },

    clickBurst(cx, cy) {
      const rgb = lastInkRgb;
      const size = SPLAT.SIZE_MIN + Math.random() * SPLAT.SIZE_RANGE;
      const el = document.createElementNS(SVG_NS, "circle");
      el.setAttribute("cx", String(cx));
      el.setAttribute("cy", String(cy));
      el.setAttribute("r", String(size / 2));
      el.setAttribute("fill", `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
      el.setAttribute("filter", `url(#${INK_FILTER_ID})`);
      el.style.opacity = String(SPLAT.START_ALPHA);
      inkRoot.appendChild(el);
      splats.push(el);
      cleanupEvicted();

      const anim = el.animate(
        [
          { opacity: SPLAT.START_ALPHA, transform: "scale(1)" },
          { opacity: 0, transform: "scale(1.25)" },
        ],
        {
          duration: reducedDuration(SPLAT.LIFE_MS),
          easing: "ease-out",
          fill: "forwards",
        },
      );
      anim.onfinish = () => {
        if (el.parentNode) el.parentNode.removeChild(el);
        const idx = splats.indexOf(el);
        if (idx !== -1) splats.splice(idx, 1);
      };
    },

    startStroke(x, y) {
      const rgb = lastInkRgb;
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
      path.setAttribute("stroke-width", String(STROKE.WIDTH));
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("filter", `url(#${INK_FILTER_ID})`);
      path.setAttribute("d", `M ${x.toFixed(1)} ${y.toFixed(1)}`);
      inkRoot.appendChild(path);
      const stroke = {
        el: path,
        d: `M ${x.toFixed(1)} ${y.toFixed(1)}`,
        lastX: x,
        lastY: y,
        sampleCount: 0,
      };
      strokes.push(stroke);
      cleanupEvicted();
      return stroke;
    },

    extendStroke(x, y) {
      const stroke = strokes[strokes.length - 1];
      if (!stroke) return;
      const dx = x - stroke.lastX;
      const dy = y - stroke.lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < STROKE.MIN_SAMPLE_DIST) return;
      // Perpendicular sine wobble — "pen isn't perfectly steady".  Amp
      // dampens with motion budget so reduced motion produces a clean line.
      const nx = -dy / (dist || 1);
      const ny = dx / (dist || 1);
      stroke.sampleCount++;
      const w = scaled(
        Math.sin(stroke.sampleCount * STROKE.WOBBLE_FREQ) * STROKE.WOBBLE_AMP,
      );
      const wx = x + nx * w;
      const wy = y + ny * w;
      stroke.d += ` L ${wx.toFixed(1)} ${wy.toFixed(1)}`;
      stroke.el.setAttribute("d", stroke.d);
      stroke.lastX = x;
      stroke.lastY = y;
    },

    endStroke() {
      const stroke = strokes[strokes.length - 1];
      if (!stroke) return false;
      const hadContent = stroke.sampleCount > 0;
      const el = stroke.el;
      const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: reducedDuration(STROKE.FADE_MS),
        easing: "ease-out",
        fill: "forwards",
      });
      anim.onfinish = () => {
        if (el.parentNode) el.parentNode.removeChild(el);
        const idx = strokes.indexOf(stroke);
        if (idx !== -1) strokes.splice(idx, 1);
      };
      return hadContent;
    },

    cleanup() {
      for (const el of splats) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
      splats.length = 0;
      for (const s of strokes) {
        if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
      }
      strokes.length = 0;
      for (const f of flicks) f.active = false;
      for (const s of shavings) s.active = false;
    },
  };
}
