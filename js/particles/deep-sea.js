import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { defineConstants } from "../dev/registry.js";

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
    DRAG_RATE: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Chance per trail segment to spawn bubble",
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
  { mode: "deep-sea" },
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
  },
  { mode: "deep-sea" },
);

const JELLY_COLORS = [
  [0, 255, 180], // teal
  [0, 200, 255], // cyan
  [100, 255, 200], // green
  [180, 150, 255], // soft purple
  [0, 230, 200], // cyan-green
];

// ── Module-scoped canvas refs ──
let _canvas, _ctx;

class Bubble {
  constructor() {
    this.reset(true);
  }
  reset(init) {
    this.x = Math.random() * _canvas.width;
    this.y = init ? Math.random() * _canvas.height : _canvas.height + 10;
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
      this.r = this.baseR * (1 + (this.popFrame / BUB.POP_FRAMES) * 0.5);
      this.opacity =
        (BUB.OPACITY_MIN + BUB.OPACITY_RANGE) *
        (1 - this.popFrame / BUB.POP_FRAMES);
      return;
    }
    this.wobble += this.wobbleSpeed;
    this.r += BUB.GROWTH_RATE;
    this.x += Math.sin(this.wobble) * this.wobbleAmp + this.vx;
    this.y += -this.riseSpeed + this.vy;
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
    if (this.x < -20) this.x += _canvas.width + 40;
    if (this.x > _canvas.width + 20) this.x -= _canvas.width + 40;
  }
  draw(pal) {
    if (!this.active) return;
    const rim = pal.bubbleRim;
    const fill = pal.bubbleFill;
    const spec = pal.bubbleSpecular;
    _ctx.save();
    _ctx.globalAlpha = this.opacity;

    // Thin ring outline
    _ctx.strokeStyle = `rgba(${rim[0]},${rim[1]},${rim[2]},${BUB.RING_ALPHA})`;
    _ctx.lineWidth = BUB.RING_WIDTH;
    _ctx.beginPath();
    _ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    _ctx.stroke();

    // Very faint fill
    _ctx.fillStyle = `rgba(${fill[0]},${fill[1]},${fill[2]},${BUB.FILL_ALPHA})`;
    _ctx.fill();

    // Specular highlight — small arc near top-left
    if (this.r >= BUB.SPECULAR_THRESHOLD) {
      _ctx.strokeStyle = `rgba(${spec[0]},${spec[1]},${spec[2]},${BUB.HIGHLIGHT_PRIMARY_ALPHA})`;
      _ctx.lineWidth = BUB.HIGHLIGHT_PRIMARY_WIDTH;
      _ctx.beginPath();
      _ctx.arc(
        this.x - this.r * BUB.HIGHLIGHT_OFFSET_FRAC,
        this.y - this.r * BUB.HIGHLIGHT_OFFSET_FRAC,
        this.r * BUB.HIGHLIGHT_SIZE_FRAC,
        -Math.PI * 0.7,
        -Math.PI * 0.3,
      );
      _ctx.stroke();
    } else {
      // Small bubbles — just a dot highlight
      _ctx.fillStyle = `rgba(${spec[0]},${spec[1]},${spec[2]},${BUB.HIGHLIGHT_DOT_ALPHA})`;
      _ctx.beginPath();
      _ctx.arc(
        this.x - this.r * BUB.DOT_OFFSET_FRAC,
        this.y - this.r * BUB.DOT_OFFSET_FRAC,
        this.r * BUB.DOT_SIZE_FRAC,
        0,
        Math.PI * 2,
      );
      _ctx.fill();
    }

    // Large bubbles get a secondary smaller highlight
    if (this.r >= BUB.LARGE_THRESHOLD) {
      _ctx.strokeStyle = `rgba(${spec[0]},${spec[1]},${spec[2]},${BUB.HIGHLIGHT_SECONDARY_ALPHA})`;
      _ctx.lineWidth = BUB.HIGHLIGHT_SECONDARY_WIDTH;
      _ctx.beginPath();
      _ctx.arc(
        this.x + this.r * BUB.SECONDARY_OFFSET_X_FRAC,
        this.y + this.r * BUB.SECONDARY_OFFSET_Y_FRAC,
        this.r * BUB.SECONDARY_SIZE_FRAC,
        Math.PI * 0.2,
        Math.PI * 0.6,
      );
      _ctx.stroke();
    }

    _ctx.restore();
  }
}

class Jellyfish {
  constructor() {
    this.reset(true);
  }
  reset(init) {
    this.bellR = JELLY.BELL_MIN + Math.random() * JELLY.BELL_RANGE;
    this.x = Math.random() * _canvas.width;
    this.y = init
      ? Math.random() * _canvas.height
      : _canvas.height + this.bellR * 2;
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
    this.pulse += this.pulseSpeed;
    this.glowPhase += JELLY.GLOW_PULSE_SPEED;

    // Pulsing swim — sharp upward kick on pulse peak, slow drift down otherwise
    const pulseVal = Math.sin(this.pulse);
    if (pulseVal > 0.95) {
      this.vy -= JELLY.PULSE_STRENGTH;
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
    this.vy += JELLY.DRIFT_VY; // gentle downward drift

    // Occasional direction change
    if (Math.random() < JELLY.DIRECTION_CHANGE) {
      this.vx = (Math.random() - 0.5) * JELLY.DRIFT_VX * 2;
    }

    this.vx *= JELLY.FRICTION;
    this.vy *= JELLY.FRICTION;
    this.x += this.vx;
    this.y += this.vy;

    // Wrap around edges
    if (this.y < -this.bellR * 3) this.y = _canvas.height + this.bellR * 2;
    if (this.y > _canvas.height + this.bellR * 3) this.y = -this.bellR * 2;
    if (this.x < -this.bellR * 3) this.x += _canvas.width + this.bellR * 6;
    if (this.x > _canvas.width + this.bellR * 3)
      this.x -= _canvas.width + this.bellR * 6;

    // Animate tentacle phases
    for (let i = 0; i < this.tentacles; i++) {
      this.tentaclePhases[i] += JELLY.TENTACLE_WAVE_SPEED + i * 0.005;
    }
  }
  draw() {
    const c = this.color;
    const glowAlpha =
      JELLY.GLOW_ALPHA_MIN +
      Math.sin(this.glowPhase) * 0.5 * JELLY.GLOW_ALPHA_RANGE +
      JELLY.GLOW_ALPHA_RANGE * 0.5;

    _ctx.save();

    // Bioluminescent glow — radial gradient around the bell
    const grad = _ctx.createRadialGradient(
      this.x,
      this.y,
      0,
      this.x,
      this.y,
      this.bellR * 2.5,
    );
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha})`);
    grad.addColorStop(1, "transparent");
    _ctx.fillStyle = grad;
    _ctx.beginPath();
    _ctx.arc(this.x, this.y, this.bellR * 2.5, 0, Math.PI * 2);
    _ctx.fill();

    // Bell dome — parabolic arc using quadraticCurveTo
    const bellW = this.bellR;
    const bellH = this.bellR * 0.8;
    // Faint fill
    const bellGrad = _ctx.createRadialGradient(
      this.x,
      this.y - bellH * 0.3,
      0,
      this.x,
      this.y,
      this.bellR,
    );
    bellGrad.addColorStop(
      0,
      `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha * 1.5})`,
    );
    bellGrad.addColorStop(1, "transparent");
    _ctx.fillStyle = bellGrad;
    _ctx.beginPath();
    _ctx.moveTo(this.x - bellW, this.y);
    _ctx.quadraticCurveTo(
      this.x - bellW,
      this.y - bellH * 2,
      this.x,
      this.y - bellH * 1.5,
    );
    _ctx.quadraticCurveTo(
      this.x + bellW,
      this.y - bellH * 2,
      this.x + bellW,
      this.y,
    );
    _ctx.closePath();
    _ctx.fill();

    // Bell stroke
    _ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.3 + glowAlpha})`;
    _ctx.lineWidth = 0.8;
    _ctx.beginPath();
    _ctx.moveTo(this.x - bellW, this.y);
    _ctx.quadraticCurveTo(
      this.x - bellW,
      this.y - bellH * 2,
      this.x,
      this.y - bellH * 1.5,
    );
    _ctx.quadraticCurveTo(
      this.x + bellW,
      this.y - bellH * 2,
      this.x + bellW,
      this.y,
    );
    _ctx.stroke();

    // Tentacles — wavy lines from bottom of bell
    const tentLen = this.bellR * JELLY.TENTACLE_SEG_LEN_RATIO;
    const spacing = (bellW * 2) / (this.tentacles + 1);
    // Velocity-based trailing — offset tentacle anchors by opposite of velocity
    const trailX = -this.vx * 8;
    const trailY = -this.vy * 4;

    _ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.15 + glowAlpha * 0.5})`;
    _ctx.lineWidth = 0.5;
    for (let i = 0; i < this.tentacles; i++) {
      const baseX = this.x - bellW + spacing * (i + 1);
      _ctx.beginPath();
      _ctx.moveTo(baseX, this.y);
      let tx = baseX + trailX * 0.5;
      let ty = this.y;
      for (let s = 1; s <= JELLY.TENTACLE_SEGMENTS; s++) {
        const t = s / JELLY.TENTACLE_SEGMENTS;
        const wave =
          Math.sin(this.tentaclePhases[i] + s * 1.2) *
          JELLY.TENTACLE_WAVE_AMP *
          this.bellR;
        tx = baseX + wave + trailX * t;
        ty = this.y + tentLen * t + trailY * t;
        const cpx =
          baseX +
          Math.sin(this.tentaclePhases[i] + (s - 0.5) * 1.2) *
            JELLY.TENTACLE_WAVE_AMP *
            this.bellR +
          trailX * (t - 0.5 / JELLY.TENTACLE_SEGMENTS);
        const cpy =
          this.y +
          tentLen * (t - 0.5 / JELLY.TENTACLE_SEGMENTS) +
          trailY * (t - 0.5 / JELLY.TENTACLE_SEGMENTS);
        _ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      }
      _ctx.stroke();
    }

    _ctx.restore();
  }
}

// ── Factory ──

export function createDeepSea(canvasEl, ctxEl, bubbleCount, jellyCount) {
  _canvas = canvasEl;
  _ctx = ctxEl;

  const bubbles = Array.from({ length: bubbleCount }, () => new Bubble());
  const jellyfish = Array.from({ length: jellyCount }, () => new Jellyfish());
  let bubbleSpawnAccum = 0;

  return {
    draw(forces, scrollVelocity, dt, pal) {
      // Ambient bubble spawning
      bubbleSpawnAccum += BUB.AMBIENT_RATE * dt;
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

      jellyfish.forEach((j) => {
        j.update();
        applyRepulsion(forces, j, JELLY.REPEL_RADIUS, JELLY.REPEL_DAMPEN);
        applyAttraction(
          forces,
          j,
          JELLY.ATTRACT_RADIUS,
          JELLY.ATTRACT_STRENGTH,
          0,
        );
        applyWellForce(forces, j);
        j.draw();
      });
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
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
        const speed = 1 + Math.random() * 2.5;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
      }
    },

    dragBubble(x, y) {
      if (Math.random() >= BUB.DRAG_RATE) return;
      const b = bubbles.find((b) => !b.active);
      if (b) {
        b.reset(false);
        b.x = x + (Math.random() - 0.5) * 10;
        b.y = y + (Math.random() - 0.5) * 10;
        b.baseR = BUB.RADIUS_MIN + Math.random() * 4;
        b.r = b.baseR;
        b.active = true;
      }
    },
  };
}
