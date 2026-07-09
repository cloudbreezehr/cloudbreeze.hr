import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { drawHaloParticle, rgbaStr } from "../canvas-utils.js";
import { defineConstants } from "../dev/registry.js";
import { scaled, chance, step, prefersReducedMotion } from "../motion.js";

// ── Bubbles ──
const BUB = defineConstants(
  "particles.bubbles",
  {
    RADIUS_MIN: {
      value: 2,
      min: 0.5,
      max: 10,
      step: 0.5,
      description: "Minimum bubble radius",
    },
    RADIUS_RANGE: {
      value: 12,
      min: 0,
      max: 30,
      step: 1,
      description: "Radius variation",
    },
    RISE_MIN: {
      value: 0.4,
      min: 0,
      max: 3,
      step: 0.05,
      description: "Minimum rise speed",
    },
    RISE_RANGE: {
      value: 0.8,
      min: 0,
      max: 3,
      step: 0.05,
      description: "Rise speed variation (scales with size)",
    },
    WOBBLE_SPEED_MIN: {
      value: 0.015,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Minimum wobble speed",
    },
    WOBBLE_SPEED_RANGE: {
      value: 0.02,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Wobble speed variation",
    },
    WOBBLE_AMP_MIN: {
      value: 0.4,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Minimum wobble amplitude",
    },
    WOBBLE_AMP_RANGE: {
      value: 0.8,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Wobble amplitude variation",
    },
    OPACITY_MIN: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Minimum bubble opacity",
    },
    OPACITY_RANGE: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Opacity variation",
    },
    GROWTH_RATE: {
      value: 0.001,
      min: 0,
      max: 0.01,
      step: 0.001,
      description: "Radius growth per frame as bubble rises",
    },
    FRICTION: {
      value: 0.96,
      min: 0.8,
      max: 1,
      step: 0.005,
      description: "Velocity damping per frame",
    },
    REPEL_RADIUS: {
      value: 150,
      min: 30,
      max: 400,
      step: 10,
      description: "Click repulsion radius",
    },
    REPEL_DAMPEN: {
      value: 0.8,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Click repulsion strength",
    },
    ATTRACT_RADIUS: {
      value: 150,
      min: 30,
      max: 400,
      step: 10,
      description: "Drag attraction radius",
    },
    ATTRACT_STRENGTH: {
      value: 0.1,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Drag attraction force",
    },
    ATTRACT_TANGENT: {
      value: 0.6,
      min: 0,
      max: 2,
      step: 0.05,
      description: "Tangential orbit during attraction",
    },
    SCROLL_THRESHOLD: {
      value: 0.5,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Scroll velocity for lateral push",
    },
    SCROLL_VX: {
      value: 0.03,
      min: 0,
      max: 0.2,
      step: 0.005,
      description: "Lateral push per scroll unit",
    },
    AMBIENT_RATE: {
      value: 2.5,
      min: 0,
      max: 10,
      step: 0.5,
      description: "Bubbles spawned per second",
    },
    CLICK_BURST_MIN: {
      value: 8,
      min: 1,
      max: 30,
      step: 1,
      description: "Minimum click burst bubbles",
    },
    CLICK_BURST_RANGE: {
      value: 8,
      min: 0,
      max: 30,
      step: 1,
      description: "Burst count variation",
    },
    BURST_CONE_FRAC: {
      value: 0.6,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Click-burst spread as a fraction of π (upward cone)",
    },
    BURST_SPEED_MIN: {
      value: 1,
      min: 0,
      max: 10,
      step: 0.5,
      description: "Minimum click-burst bubble speed",
    },
    BURST_SPEED_RANGE: {
      value: 2.5,
      min: 0,
      max: 10,
      step: 0.5,
      description: "Click-burst bubble speed variation",
    },
    DRAG_RATE: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Chance per trail segment to spawn bubble",
    },
    DRAG_SCATTER: {
      value: 10,
      min: 0,
      max: 40,
      step: 1,
      description: "Drag-spawn bubble scatter around the pointer (px)",
    },
    DRAG_RADIUS_RANGE: {
      value: 4,
      min: 0,
      max: 20,
      step: 0.5,
      description: "Drag-spawn bubble radius variation",
    },
    SPECULAR_THRESHOLD: {
      value: 5,
      min: 1,
      max: 20,
      step: 1,
      description: "Radius for specular highlight",
    },
    LARGE_THRESHOLD: {
      value: 9,
      min: 1,
      max: 25,
      step: 1,
      description: "Radius for secondary highlight",
    },
    POP_FRAMES: {
      value: 8,
      min: 2,
      max: 20,
      step: 1,
      description: "Animation frames for pop effect",
    },
    POP_GROWTH: {
      value: 0.5,
      min: 0,
      max: 2,
      step: 0.05,
      description: "How much a popping bubble swells (fraction of base radius)",
    },
    // Alpha scalars are applied on top of `this.opacity` to layer ring,
    // fill, and highlights. Keeping them named makes the visual hierarchy
    // (rim brighter than fill, primary highlight brighter than secondary)
    // explicit instead of buried as literals next to colors.
    RING_ALPHA: {
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Outline ring alpha multiplier",
    },
    FILL_ALPHA: {
      value: 0.04,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Faint inner fill alpha multiplier",
    },
    HIGHLIGHT_PRIMARY_ALPHA: {
      value: 0.6,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Specular arc/dot highlight alpha multiplier",
    },
    HIGHLIGHT_SECONDARY_ALPHA: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Larger-bubble secondary highlight alpha multiplier",
    },
    HIGHLIGHT_DOT_ALPHA: {
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Small-bubble dot highlight alpha multiplier",
    },
    RING_WIDTH: {
      value: 0.6,
      min: 0.1,
      max: 3,
      step: 0.1,
      description: "Outline ring stroke width",
    },
    HIGHLIGHT_PRIMARY_WIDTH: {
      value: 0.8,
      min: 0.1,
      max: 3,
      step: 0.1,
      description: "Specular arc stroke width",
    },
    HIGHLIGHT_SECONDARY_WIDTH: {
      value: 0.5,
      min: 0.1,
      max: 3,
      step: 0.1,
      description: "Secondary highlight arc stroke width",
    },
    // Ratios of `r` for highlight geometry — keep as constants so the
    // bubble's optical "shape" can be tuned without rewriting render code.
    HIGHLIGHT_OFFSET_FRAC: {
      value: 0.25,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Specular offset toward top-left as fraction of radius",
    },
    HIGHLIGHT_SIZE_FRAC: {
      value: 0.6,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Specular arc radius as fraction of bubble radius",
    },
    DOT_OFFSET_FRAC: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Small-bubble dot offset as fraction of radius",
    },
    DOT_SIZE_FRAC: {
      value: 0.2,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Small-bubble dot radius as fraction of bubble radius",
    },
    SECONDARY_OFFSET_X_FRAC: {
      value: 0.15,
      min: -1,
      max: 1,
      step: 0.05,
      description: "Secondary highlight x offset as fraction of radius",
    },
    SECONDARY_OFFSET_Y_FRAC: {
      value: 0.2,
      min: -1,
      max: 1,
      step: 0.05,
      description: "Secondary highlight y offset as fraction of radius",
    },
    SECONDARY_SIZE_FRAC: {
      value: 0.25,
      min: 0,
      max: 1,
      step: 0.05,
      description:
        "Secondary highlight arc radius as fraction of bubble radius",
    },
  },
  { theme: "deep-sea" },
);

// ── Jellyfish ──
const JELLY = defineConstants(
  "particles.jellyfish",
  {
    BELL_MIN: {
      value: 8,
      min: 3,
      max: 30,
      step: 1,
      description: "Minimum bell radius",
    },
    BELL_RANGE: {
      value: 27,
      min: 0,
      max: 40,
      step: 1,
      description: "Bell radius variation",
    },
    TENTACLE_SMALL: {
      value: 3,
      min: 1,
      max: 8,
      step: 1,
      description: "Tentacle count for small jelly",
    },
    TENTACLE_MED: {
      value: 4,
      min: 1,
      max: 8,
      step: 1,
      description: "Tentacle count for medium jelly",
    },
    TENTACLE_LARGE: {
      value: 5,
      min: 1,
      max: 10,
      step: 1,
      description: "Tentacle count for large jelly",
    },
    TENTACLE_MED_THRESHOLD: {
      value: 15,
      min: 5,
      max: 30,
      step: 1,
      description: "Bell radius for medium tentacle count",
    },
    TENTACLE_LARGE_THRESHOLD: {
      value: 25,
      min: 10,
      max: 40,
      step: 1,
      description: "Bell radius for large tentacle count",
    },
    PULSE_SPEED_MIN: {
      value: 0.008,
      min: 0,
      max: 0.05,
      step: 0.001,
      description: "Minimum pulse speed",
    },
    PULSE_SPEED_RANGE: {
      value: 0.008,
      min: 0,
      max: 0.05,
      step: 0.001,
      description: "Pulse speed variation",
    },
    PULSE_STRENGTH: {
      value: 0.6,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Upward kick force on pulse peak",
    },
    PULSE_PEAK_THRESHOLD: {
      value: 0.95,
      min: 0.5,
      max: 0.99,
      step: 0.01,
      description: "Sine level that counts as a pulse peak (kick fires here)",
    },
    DRIFT_VX: {
      value: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Max horizontal drift speed",
    },
    DRIFT_VY: {
      value: 0.05,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Gentle downward drift",
    },
    DIRECTION_CHANGE: {
      value: 0.002,
      min: 0,
      max: 0.02,
      step: 0.001,
      description: "Per-frame chance to change direction",
    },
    GLOW_PULSE_SPEED: {
      value: 0.02,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Bioluminescent pulse speed",
    },
    GLOW_ALPHA_MIN: {
      value: 0.06,
      min: 0,
      max: 0.3,
      step: 0.01,
      description: "Minimum glow alpha",
    },
    GLOW_ALPHA_RANGE: {
      value: 0.08,
      min: 0,
      max: 0.3,
      step: 0.01,
      description: "Glow alpha variation",
    },
    FRICTION: {
      value: 0.985,
      min: 0.9,
      max: 1,
      step: 0.005,
      description: "Velocity damping per frame",
    },
    REPEL_RADIUS: {
      value: 180,
      min: 30,
      max: 500,
      step: 10,
      description: "Click repulsion radius",
    },
    REPEL_DAMPEN: {
      value: 0.3,
      min: 0,
      max: 2,
      step: 0.1,
      description: "Click repulsion strength",
    },
    ATTRACT_RADIUS: {
      value: 200,
      min: 30,
      max: 500,
      step: 10,
      description: "Drag attraction radius",
    },
    ATTRACT_STRENGTH: {
      value: 0.04,
      min: 0,
      max: 0.3,
      step: 0.01,
      description: "Drag attraction force",
    },
    TENTACLE_SEGMENTS: {
      value: 4,
      min: 1,
      max: 10,
      step: 1,
      description: "Segments per tentacle",
    },
    TENTACLE_SEG_LEN_RATIO: {
      value: 0.8,
      min: 0.2,
      max: 2,
      step: 0.1,
      description: "Tentacle length as ratio of bell",
    },
    TENTACLE_WAVE_AMP: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Tentacle wave amplitude",
    },
    TENTACLE_WAVE_SPEED: {
      value: 0.03,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Tentacle wave animation speed",
    },
    TENTACLE_PHASE_PER_INDEX: {
      value: 0.005,
      min: 0,
      max: 0.05,
      step: 0.001,
      description:
        "Per-tentacle wave-speed offset so adjacent tentacles drift out of phase",
    },
    TENTACLE_PHASE_PER_SEGMENT: {
      value: 1.2,
      min: 0,
      max: 5,
      step: 0.1,
      description: "Phase advance applied per segment along a tentacle",
    },
    // Bell geometry (radii expressed as multiples of bellR).
    BELL_HEIGHT_RATIO: {
      value: 0.8,
      min: 0.3,
      max: 2,
      step: 0.05,
      description: "Bell height as fraction of bell width (bellR)",
    },
    BELL_CONTROL_LIFT: {
      value: 2,
      min: 0.5,
      max: 4,
      step: 0.1,
      description: "Side control-point lift above bell, in units of bellH",
    },
    BELL_APEX_LIFT: {
      value: 1.5,
      min: 0.5,
      max: 4,
      step: 0.1,
      description: "Bell apex height above center, in units of bellH",
    },
    BELL_GLOW_OFFSET: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description:
        "Inner glow seed offset above bell center, in units of bellH",
    },
    // Glow halo and bell-fill alpha multipliers, layered relative to glowAlpha.
    GLOW_HALO_RADIUS_RATIO: {
      value: 2.5,
      min: 1,
      max: 5,
      step: 0.1,
      description: "Outer glow halo radius as multiple of bellR",
    },
    BELL_FILL_ALPHA_MUL: {
      value: 1.5,
      min: 0,
      max: 4,
      step: 0.1,
      description: "Bell fill alpha relative to glowAlpha",
    },
    BELL_STROKE_ALPHA_BASE: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Floor for bell stroke alpha (added to glowAlpha)",
    },
    BELL_STROKE_WIDTH: {
      value: 0.8,
      min: 0.1,
      max: 3,
      step: 0.1,
      description: "Bell stroke width",
    },
    TENTACLE_STROKE_ALPHA_BASE: {
      value: 0.15,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Floor for tentacle stroke alpha",
    },
    TENTACLE_STROKE_ALPHA_SCALE: {
      value: 0.5,
      min: 0,
      max: 2,
      step: 0.05,
      description: "How much glowAlpha contributes to tentacle stroke alpha",
    },
    TENTACLE_STROKE_WIDTH: {
      value: 0.5,
      min: 0.1,
      max: 3,
      step: 0.1,
      description: "Tentacle stroke width",
    },
    // Velocity-based trailing — anchors lag behind by a multiple of velocity.
    TRAIL_VX_MUL: {
      value: 8,
      min: 0,
      max: 30,
      step: 1,
      description: "Tentacle anchor lag per unit horizontal velocity",
    },
    TRAIL_VY_MUL: {
      value: 4,
      min: 0,
      max: 30,
      step: 1,
      description: "Tentacle anchor lag per unit vertical velocity",
    },
    TRAIL_BASE_FRAC: {
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description:
        "Initial trail anchor offset for a tentacle base, as fraction of TRAIL_VX_MUL",
    },
  },
  { theme: "deep-sea" },
);

const JELLY_COLORS = [
  [0, 255, 180], // teal
  [0, 200, 255], // cyan
  [100, 255, 200], // green
  [180, 150, 255], // soft purple
  [0, 230, 200], // cyan-green
];

// ── Plankton ──
// Bioluminescent specks scattered from a jellyfish bell while the user
// drags it.  Pure ballistic + friction → step() integrates them.  Spawn
// is gated on the jelly's velocity *gain* per frame so idle jellies don't
// trail plankton; only ones being meaningfully accelerated do.
const PLANKTON = defineConstants(
  "particles.deepSeaPlankton",
  {
    POOL: {
      value: 160,
      min: 32,
      max: 512,
      step: 8,
      description: "Total plankton slots (shared across all jellies)",
    },
    SPAWN_VEL_THRESHOLD: {
      value: 0.15,
      min: 0,
      max: 2,
      step: 0.05,
      description:
        "Minimum |Δvelocity| per frame on a jelly to trigger plankton spawn",
    },
    SPAWN_CHANCE: {
      value: 0.55,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Per-frame spawn probability when threshold is met",
    },
    COUNT_MIN: {
      value: 1,
      min: 0,
      max: 6,
      step: 1,
      description: "Min specks emitted per spawn event",
    },
    COUNT_RANGE: {
      value: 2,
      min: 0,
      max: 6,
      step: 1,
      description: "Speck count variation",
    },
    SPEED_MIN: {
      value: 0.4,
      min: 0,
      max: 4,
      step: 0.1,
      description: "Min spawn speed (px/frame)",
    },
    SPEED_RANGE: {
      value: 0.8,
      min: 0,
      max: 4,
      step: 0.1,
      description: "Spawn speed variation",
    },
    INHERIT_VEL: {
      value: 0.35,
      min: 0,
      max: 1,
      step: 0.05,
      description:
        "Fraction of jelly velocity carried into the plankton on spawn",
    },
    SPAWN_OFFSET: {
      value: 0.5,
      min: 0,
      max: 2,
      step: 0.05,
      description: "Spawn position offset below jelly bell (in units of bellR)",
    },
    LIFE_MIN: {
      value: 35,
      min: 5,
      max: 200,
      step: 1,
      description: "Min lifetime (frames)",
    },
    LIFE_RANGE: {
      value: 30,
      min: 0,
      max: 200,
      step: 1,
      description: "Lifetime variation",
    },
    FRICTION: {
      value: 0.94,
      min: 0.5,
      max: 1,
      step: 0.005,
      description: "Per-frame velocity damping",
    },
    RADIUS: {
      value: 1,
      min: 0.3,
      max: 4,
      step: 0.1,
      description: "Speck dot radius (px)",
    },
    GLOW_RADIUS: {
      value: 4,
      min: 1,
      max: 12,
      step: 0.5,
      description: "Halo radius multiplier",
    },
    ALPHA_PEAK: {
      value: 0.85,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Peak speck opacity",
    },
    FADE_HOLD: {
      value: 0.3,
      min: 0,
      max: 0.9,
      step: 0.05,
      description: "Lifetime fraction at full alpha before fading begins",
    },
  },
  { theme: "deep-sea" },
);

class Bubble {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.reset(true);
  }
  reset(init) {
    this.x = Math.random() * this.canvas.width;
    this.y = init
      ? Math.random() * this.canvas.height
      : this.canvas.height + 10;
    this.baseR = BUB.RADIUS_MIN + Math.random() * BUB.RADIUS_RANGE;
    this.r = this.baseR;
    this.riseSpeed =
      BUB.RISE_MIN +
      (this.baseR / (BUB.RADIUS_MIN + BUB.RADIUS_RANGE)) * BUB.RISE_RANGE;
    this.vx = 0;
    this.vy = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed =
      BUB.WOBBLE_SPEED_MIN + Math.random() * BUB.WOBBLE_SPEED_RANGE;
    this.wobbleAmp = BUB.WOBBLE_AMP_MIN + Math.random() * BUB.WOBBLE_AMP_RANGE;
    this.opacity = BUB.OPACITY_MIN + Math.random() * BUB.OPACITY_RANGE;
    this.popping = false;
    this.popFrame = 0;
    this.active = init;
  }
  update() {
    if (this.popping) {
      this.popFrame++;
      if (this.popFrame > BUB.POP_FRAMES) {
        this.reset(false);
        this.active = false;
        return;
      }
      this.r =
        this.baseR * (1 + (this.popFrame / BUB.POP_FRAMES) * BUB.POP_GROWTH);
      this.opacity =
        (BUB.OPACITY_MIN + BUB.OPACITY_RANGE) *
        (1 - this.popFrame / BUB.POP_FRAMES);
      return;
    }
    this.wobble += scaled(this.wobbleSpeed);
    this.r += scaled(BUB.GROWTH_RATE);
    this.x += scaled(Math.sin(this.wobble) * this.wobbleAmp + this.vx);
    this.y += scaled(-this.riseSpeed + this.vy);
    this.vx *= BUB.FRICTION;
    this.vy *= BUB.FRICTION;
    // Pop at top
    if (this.y < -this.r) {
      this.popping = true;
      this.popFrame = 0;
      this.y = this.r;
      return;
    }
    // Wrap horizontal
    if (this.x < -20) this.x += this.canvas.width + 40;
    if (this.x > this.canvas.width + 20) this.x -= this.canvas.width + 40;
  }
  draw(pal) {
    if (!this.active) return;
    const rim = pal.bubbleRim;
    const fill = pal.bubbleFill;
    const spec = pal.bubbleSpecular;
    this.ctx.save();
    this.ctx.globalAlpha = this.opacity;

    // Thin ring outline
    this.ctx.strokeStyle = rgbaStr(rim, BUB.RING_ALPHA);
    this.ctx.lineWidth = BUB.RING_WIDTH;
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    this.ctx.stroke();

    // Very faint fill
    this.ctx.fillStyle = rgbaStr(fill, BUB.FILL_ALPHA);
    this.ctx.fill();

    // Specular highlight — small arc near top-left
    if (this.r >= BUB.SPECULAR_THRESHOLD) {
      this.ctx.strokeStyle = rgbaStr(spec, BUB.HIGHLIGHT_PRIMARY_ALPHA);
      this.ctx.lineWidth = BUB.HIGHLIGHT_PRIMARY_WIDTH;
      this.ctx.beginPath();
      this.ctx.arc(
        this.x - this.r * BUB.HIGHLIGHT_OFFSET_FRAC,
        this.y - this.r * BUB.HIGHLIGHT_OFFSET_FRAC,
        this.r * BUB.HIGHLIGHT_SIZE_FRAC,
        -Math.PI * 0.7,
        -Math.PI * 0.3,
      );
      this.ctx.stroke();
    } else {
      // Small bubbles — just a dot highlight
      this.ctx.fillStyle = rgbaStr(spec, BUB.HIGHLIGHT_DOT_ALPHA);
      this.ctx.beginPath();
      this.ctx.arc(
        this.x - this.r * BUB.DOT_OFFSET_FRAC,
        this.y - this.r * BUB.DOT_OFFSET_FRAC,
        this.r * BUB.DOT_SIZE_FRAC,
        0,
        Math.PI * 2,
      );
      this.ctx.fill();
    }

    // Large bubbles get a secondary smaller highlight
    if (this.r >= BUB.LARGE_THRESHOLD) {
      this.ctx.strokeStyle = rgbaStr(spec, BUB.HIGHLIGHT_SECONDARY_ALPHA);
      this.ctx.lineWidth = BUB.HIGHLIGHT_SECONDARY_WIDTH;
      this.ctx.beginPath();
      this.ctx.arc(
        this.x + this.r * BUB.SECONDARY_OFFSET_X_FRAC,
        this.y + this.r * BUB.SECONDARY_OFFSET_Y_FRAC,
        this.r * BUB.SECONDARY_SIZE_FRAC,
        Math.PI * 0.2,
        Math.PI * 0.6,
      );
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}

// Off-screen wrap bounds, in bell radii: a jellyfish exits this far past an
// edge and re-enters one radius inside the opposite exit bound, so the wrap
// can't immediately re-trigger.
const WRAP_EXIT_BELLS = 3;
const WRAP_ENTRY_BELLS = 2;

class Jellyfish {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.reset(true);
  }
  reset(init) {
    this.bellR = JELLY.BELL_MIN + Math.random() * JELLY.BELL_RANGE;
    this.x = Math.random() * this.canvas.width;
    this.y = init
      ? Math.random() * this.canvas.height
      : this.canvas.height + this.bellR * 2;
    this.vx = (Math.random() - 0.5) * JELLY.DRIFT_VX;
    this.vy = 0;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed =
      JELLY.PULSE_SPEED_MIN + Math.random() * JELLY.PULSE_SPEED_RANGE;
    this.glowPhase = Math.random() * Math.PI * 2;
    this.color = JELLY_COLORS[Math.floor(Math.random() * JELLY_COLORS.length)];
    // Tentacle count based on size
    if (this.bellR >= JELLY.TENTACLE_LARGE_THRESHOLD) {
      this.tentacles = JELLY.TENTACLE_LARGE;
    } else if (this.bellR >= JELLY.TENTACLE_MED_THRESHOLD) {
      this.tentacles = JELLY.TENTACLE_MED;
    } else {
      this.tentacles = JELLY.TENTACLE_SMALL;
    }
    this.tentaclePhases = Array.from(
      { length: this.tentacles },
      () => Math.random() * Math.PI * 2,
    );
  }
  update() {
    this.pulse += scaled(this.pulseSpeed);
    this.glowPhase += scaled(JELLY.GLOW_PULSE_SPEED);

    // Pulsing swim — sharp upward kick on pulse peak, slow drift down otherwise
    const pulseVal = Math.sin(this.pulse);
    if (pulseVal > JELLY.PULSE_PEAK_THRESHOLD) {
      this.vy -= scaled(JELLY.PULSE_STRENGTH);
      if (!this._pulsedThisCycle) {
        this._pulsedThisCycle = true;
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "jellyfish-pulse" },
          }),
        );
      }
    } else {
      this._pulsedThisCycle = false;
    }
    this.vy += scaled(JELLY.DRIFT_VY); // gentle downward drift

    // Occasional direction change
    if (chance(JELLY.DIRECTION_CHANGE)) {
      this.vx = (Math.random() - 0.5) * JELLY.DRIFT_VX * 2;
    }

    this.vx *= JELLY.FRICTION;
    this.vy *= JELLY.FRICTION;
    this.x += scaled(this.vx);
    this.y += scaled(this.vy);

    // Wrap around edges
    const wrapExit = this.bellR * WRAP_EXIT_BELLS;
    const wrapEntry = this.bellR * WRAP_ENTRY_BELLS;
    const wrapSpanX = this.canvas.width + wrapExit * 2;
    if (this.y < -wrapExit) this.y = this.canvas.height + wrapEntry;
    if (this.y > this.canvas.height + wrapExit) this.y = -wrapEntry;
    if (this.x < -wrapExit) this.x += wrapSpanX;
    if (this.x > this.canvas.width + wrapExit) this.x -= wrapSpanX;

    // Animate tentacle phases
    for (let i = 0; i < this.tentacles; i++) {
      this.tentaclePhases[i] += scaled(
        JELLY.TENTACLE_WAVE_SPEED + i * JELLY.TENTACLE_PHASE_PER_INDEX,
      );
    }
  }
  draw() {
    const c = this.color;
    // sin spans [-1, 1], so half the range becomes the oscillation amplitude
    // around the midpoint (MIN + RANGE/2).
    const halfRange = JELLY.GLOW_ALPHA_RANGE / 2;
    const glowAlpha =
      JELLY.GLOW_ALPHA_MIN + halfRange + Math.sin(this.glowPhase) * halfRange;

    this.ctx.save();

    // Bioluminescent glow — radial gradient around the bell
    drawHaloParticle(
      this.ctx,
      this.x,
      this.y,
      this.bellR * JELLY.GLOW_HALO_RADIUS_RATIO,
      glowAlpha,
      c,
    );

    // Bell dome — parabolic arc using quadraticCurveTo
    const bellW = this.bellR;
    const bellH = this.bellR * JELLY.BELL_HEIGHT_RATIO;
    const controlLift = bellH * JELLY.BELL_CONTROL_LIFT;
    const apexLift = bellH * JELLY.BELL_APEX_LIFT;
    // Faint fill
    const bellGrad = this.ctx.createRadialGradient(
      this.x,
      this.y - bellH * JELLY.BELL_GLOW_OFFSET,
      0,
      this.x,
      this.y,
      this.bellR,
    );
    bellGrad.addColorStop(0, rgbaStr(c, glowAlpha * JELLY.BELL_FILL_ALPHA_MUL));
    bellGrad.addColorStop(1, "transparent");
    this.ctx.fillStyle = bellGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(this.x - bellW, this.y);
    this.ctx.quadraticCurveTo(
      this.x - bellW,
      this.y - controlLift,
      this.x,
      this.y - apexLift,
    );
    this.ctx.quadraticCurveTo(
      this.x + bellW,
      this.y - controlLift,
      this.x + bellW,
      this.y,
    );
    this.ctx.closePath();
    this.ctx.fill();

    // Bell stroke
    this.ctx.strokeStyle = rgbaStr(c, JELLY.BELL_STROKE_ALPHA_BASE + glowAlpha);
    this.ctx.lineWidth = JELLY.BELL_STROKE_WIDTH;
    this.ctx.beginPath();
    this.ctx.moveTo(this.x - bellW, this.y);
    this.ctx.quadraticCurveTo(
      this.x - bellW,
      this.y - controlLift,
      this.x,
      this.y - apexLift,
    );
    this.ctx.quadraticCurveTo(
      this.x + bellW,
      this.y - controlLift,
      this.x + bellW,
      this.y,
    );
    this.ctx.stroke();

    // Tentacles — wavy lines from bottom of bell
    const tentLen = this.bellR * JELLY.TENTACLE_SEG_LEN_RATIO;
    const spacing = (bellW * 2) / (this.tentacles + 1);
    // Velocity-based trailing — offset tentacle anchors by opposite of velocity
    const trailX = -this.vx * JELLY.TRAIL_VX_MUL;
    const trailY = -this.vy * JELLY.TRAIL_VY_MUL;
    const segs = JELLY.TENTACLE_SEGMENTS;
    const halfStep = 0.5 / segs;

    this.ctx.strokeStyle = rgbaStr(
      c,
      JELLY.TENTACLE_STROKE_ALPHA_BASE +
        glowAlpha * JELLY.TENTACLE_STROKE_ALPHA_SCALE,
    );
    this.ctx.lineWidth = JELLY.TENTACLE_STROKE_WIDTH;
    for (let i = 0; i < this.tentacles; i++) {
      const baseX = this.x - bellW + spacing * (i + 1);
      this.ctx.beginPath();
      this.ctx.moveTo(baseX, this.y);
      let tx = baseX + trailX * JELLY.TRAIL_BASE_FRAC;
      let ty = this.y;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const wave =
          Math.sin(
            this.tentaclePhases[i] + s * JELLY.TENTACLE_PHASE_PER_SEGMENT,
          ) *
          JELLY.TENTACLE_WAVE_AMP *
          this.bellR;
        tx = baseX + wave + trailX * t;
        ty = this.y + tentLen * t + trailY * t;
        const cpt = t - halfStep;
        const cpx =
          baseX +
          Math.sin(
            this.tentaclePhases[i] +
              (s - 0.5) * JELLY.TENTACLE_PHASE_PER_SEGMENT,
          ) *
            JELLY.TENTACLE_WAVE_AMP *
            this.bellR +
          trailX * cpt;
        const cpy = this.y + tentLen * cpt + trailY * cpt;
        this.ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      }
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}

// ── Phosphorescent speck ──
// Tiny bioluminescent grain shaken loose from a dragged jellyfish's
// bell.  Ballistic + friction is the entire integration → step() does
// the per-frame work.  Color is borrowed from the jelly that spawned
// it so the wake reads as that specific jelly's, not generic plankton.

export class Plankton {
  constructor() {
    this.active = false;
  }
  spawn(x, y, baseVx, baseVy, color) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = PLANKTON.SPEED_MIN + Math.random() * PLANKTON.SPEED_RANGE;
    this.vx = Math.cos(angle) * speed + baseVx * PLANKTON.INHERIT_VEL;
    this.vy = Math.sin(angle) * speed + baseVy * PLANKTON.INHERIT_VEL;
    this.life = 0;
    this.maxLife = PLANKTON.LIFE_MIN + Math.random() * PLANKTON.LIFE_RANGE;
    this.color = color;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.life++;
    if (this.life > this.maxLife) {
      this.active = false;
      return;
    }
    step(this, 1, PLANKTON.FRICTION);
  }
  draw(ctx) {
    if (!this.active) return;
    const t = this.life / this.maxLife;
    const alpha =
      t < PLANKTON.FADE_HOLD
        ? PLANKTON.ALPHA_PEAK
        : PLANKTON.ALPHA_PEAK *
          (1 - (t - PLANKTON.FADE_HOLD) / (1 - PLANKTON.FADE_HOLD));
    drawHaloParticle(
      ctx,
      this.x,
      this.y,
      PLANKTON.RADIUS * PLANKTON.GLOW_RADIUS,
      alpha,
      this.color,
    );
  }
}

// ── Factory ──

export function createDeepSea(canvasEl, ctxEl, bubbleCount, jellyCount) {
  const canvas = canvasEl;
  const ctx = ctxEl;

  const bubbles = Array.from(
    { length: bubbleCount },
    () => new Bubble(canvas, ctx),
  );
  const jellyfish = Array.from(
    { length: jellyCount },
    () => new Jellyfish(canvas, ctx),
  );
  const plankton = Array.from({ length: PLANKTON.POOL }, () => new Plankton());
  let bubbleSpawnAccum = 0;

  return {
    draw(forces, scrollVelocity, dt, pal) {
      // Ambient bubble spawning — accumulator dampens with motion so
      // no new spawns appear under reduced motion.
      bubbleSpawnAccum += scaled(BUB.AMBIENT_RATE * dt);
      while (bubbleSpawnAccum >= 1) {
        bubbleSpawnAccum--;
        const b = bubbles.find((b) => !b.active);
        if (b) {
          b.reset(false);
          b.active = true;
        }
      }

      bubbles.forEach((b) => {
        if (!b.active) return;
        b.update();
        applyRepulsion(forces, b, BUB.REPEL_RADIUS, BUB.REPEL_DAMPEN);
        applyAttraction(
          forces,
          b,
          BUB.ATTRACT_RADIUS,
          BUB.ATTRACT_STRENGTH,
          BUB.ATTRACT_TANGENT,
        );
        applyWellForce(forces, b);
        // Scroll pushes laterally
        if (Math.abs(scrollVelocity) > BUB.SCROLL_THRESHOLD) {
          b.vx += scrollVelocity * BUB.SCROLL_VX;
        }
        b.draw(pal);
      });

      // Plankton spawn is gated on the OS preference rather than
      // dampened — discrete bursts of light look jarring at low budget
      // and the wake reads fine without them.
      const plankActive = !prefersReducedMotion();
      jellyfish.forEach((j) => {
        j.update();
        applyRepulsion(forces, j, JELLY.REPEL_RADIUS, JELLY.REPEL_DAMPEN);
        // Snapshot before drag-driven forces (attraction + well) so the
        // dvMag below measures only their gain, not ambient drift.
        const vx0 = j.vx;
        const vy0 = j.vy;
        applyAttraction(
          forces,
          j,
          JELLY.ATTRACT_RADIUS,
          JELLY.ATTRACT_STRENGTH,
          0,
        );
        applyWellForce(forces, j);
        if (plankActive && forces.isDragging) {
          const dvx = j.vx - vx0;
          const dvy = j.vy - vy0;
          const dvMag = Math.sqrt(dvx * dvx + dvy * dvy);
          if (
            dvMag > PLANKTON.SPAWN_VEL_THRESHOLD &&
            Math.random() < PLANKTON.SPAWN_CHANCE
          ) {
            const count =
              PLANKTON.COUNT_MIN +
              Math.floor(Math.random() * PLANKTON.COUNT_RANGE);
            const sx = j.x;
            const sy = j.y + j.bellR * PLANKTON.SPAWN_OFFSET;
            for (let i = 0; i < count; i++) {
              const p = plankton.find((p) => !p.active);
              if (!p) break;
              p.spawn(sx, sy, j.vx, j.vy, j.color);
            }
          }
        }
        j.draw();
      });
      // Plankton — pure ballistic, friction-only, integrated by step().
      // Drawn after jellies so wakes layer over the bell that produced them.
      for (const p of plankton) {
        p.update();
        p.draw(ctx);
      }
    },

    clickBurst(cx, cy) {
      const burstCount =
        BUB.CLICK_BURST_MIN + Math.floor(Math.random() * BUB.CLICK_BURST_RANGE);
      for (let i = 0; i < burstCount; i++) {
        const b = bubbles.find((b) => !b.active);
        if (!b) break;
        b.reset(false);
        b.x = cx;
        b.y = cy;
        b.active = true;
        // Spread in upward cone
        const angle =
          -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * BUB.BURST_CONE_FRAC;
        const speed =
          BUB.BURST_SPEED_MIN + Math.random() * BUB.BURST_SPEED_RANGE;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
      }
    },

    dragBubble(x, y) {
      if (Math.random() >= BUB.DRAG_RATE) return;
      const b = bubbles.find((b) => !b.active);
      if (b) {
        b.reset(false);
        b.x = x + (Math.random() - 0.5) * BUB.DRAG_SCATTER;
        b.y = y + (Math.random() - 0.5) * BUB.DRAG_SCATTER;
        b.baseR = BUB.RADIUS_MIN + Math.random() * BUB.DRAG_RADIUS_RANGE;
        b.r = b.baseR;
        b.active = true;
      }
    },
  };
}
