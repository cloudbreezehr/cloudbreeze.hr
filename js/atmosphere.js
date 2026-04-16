import { scrollFade } from "./canvas-utils.js";
import { applyWellForce, HOLD } from "./interactions.js";
import { defineConstants } from "./dev/registry.js";

// ── Streaks ──
const STREAK = defineConstants("atmosphere.streaks", {
  LEN_MIN: {
    value: 40,
    min: 5,
    max: 300,
    step: 5,
    description: "Minimum streak length in pixels",
  },
  LEN_RANGE: {
    value: 100,
    min: 0,
    max: 300,
    step: 5,
    description: "Streak length variation",
  },
  SPEED_MIN: {
    value: 0.3,
    min: 0,
    max: 3,
    step: 0.05,
    description: "Minimum fall speed in px/frame",
  },
  SPEED_RANGE: {
    value: 0.5,
    min: 0,
    max: 3,
    step: 0.05,
    description: "Fall speed variation",
  },
  OPACITY_MIN: {
    value: 0.02,
    min: 0,
    max: 0.2,
    step: 0.005,
    description: "Minimum opacity",
  },
  OPACITY_RANGE: {
    value: 0.05,
    min: 0,
    max: 0.2,
    step: 0.005,
    description: "Opacity variation",
  },
  WIDTH_MIN: {
    value: 0.5,
    min: 0.1,
    max: 5,
    step: 0.1,
    description: "Minimum line width",
  },
  WIDTH_RANGE: {
    value: 1,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Width variation",
  },
  ANGLE_MIN: {
    value: -0.1,
    min: -1,
    max: 1,
    step: 0.01,
    description: "Minimum horizontal drift angle",
  },
  ANGLE_RANGE: {
    value: 0.2,
    min: 0,
    max: 2,
    step: 0.01,
    description: "Drift angle variation",
  },
});

// ── Clouds ──
const CLOUD = defineConstants("atmosphere.clouds", {
  X_SPREAD: {
    value: 1.4,
    min: 0.5,
    max: 3,
    step: 0.1,
    description: "Horizontal spawn spread multiplier",
  },
  X_OFFSET: {
    value: 0.2,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Horizontal offset from left edge",
  },
  Y_DEPTH: {
    value: 3,
    min: 1,
    max: 10,
    step: 0.5,
    description: "Vertical distribution depth",
  },
  Y_OFFSET: {
    value: 0.5,
    min: 0,
    max: 2,
    step: 0.1,
    description: "Vertical offset upward",
  },
  DRIFT_MAX: {
    value: 0.12,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Maximum horizontal drift speed",
  },
  SCALE_MIN: {
    value: 0.5,
    min: 0.1,
    max: 2,
    step: 0.1,
    description: "Minimum cloud scale",
  },
  SCALE_RANGE: {
    value: 0.8,
    min: 0,
    max: 2,
    step: 0.1,
    description: "Scale variation",
  },
  BLOB_COUNT_MIN: {
    value: 4,
    min: 1,
    max: 12,
    step: 1,
    description: "Minimum blobs per cloud",
  },
  BLOB_COUNT_RANGE: {
    value: 3,
    min: 0,
    max: 8,
    step: 1,
    description: "Blob count variation",
  },
  BLOB_SPACING: {
    value: 30,
    min: 5,
    max: 80,
    step: 5,
    description: "Horizontal spacing between blobs",
  },
  BLOB_JITTER_X: {
    value: 25,
    min: 0,
    max: 60,
    step: 5,
    description: "Blob horizontal position jitter",
  },
  BLOB_JITTER_Y: {
    value: 40,
    min: 0,
    max: 80,
    step: 5,
    description: "Blob vertical position jitter",
  },
  BLOB_Y_BIAS: {
    value: 0.65,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Blob vertical bias (0.5 = centered)",
  },
  BLOB_RADIUS_MIN: {
    value: 30,
    min: 5,
    max: 80,
    step: 5,
    description: "Minimum blob radius",
  },
  BLOB_RADIUS_RANGE: {
    value: 40,
    min: 0,
    max: 80,
    step: 5,
    description: "Blob radius variation",
  },
  WRAP_MARGIN: {
    value: 250,
    min: 50,
    max: 500,
    step: 10,
    description: "Offscreen margin before wrapping",
  },
  CULL_MARGIN: {
    value: 150,
    min: 50,
    max: 400,
    step: 10,
    description: "Offscreen margin for draw culling",
  },
  OPACITY_BASE: {
    value: 0.08,
    min: 0,
    max: 0.3,
    step: 0.01,
    description: "Base cloud opacity",
  },
  OPACITY_DEPTH: {
    value: 0.04,
    min: 0,
    max: 0.2,
    step: 0.01,
    description: "Extra opacity per scale unit",
  },
  GRAD_INNER: {
    value: 0.08,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Inner gradient stop radius ratio",
  },
  GRAD_MID: {
    value: 0.55,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Mid gradient stop position",
  },
  GRAD_MID_OPACITY: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Mid gradient opacity multiplier",
  },
  Y_PIVOT: {
    value: 0.38,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll pivot point for cloud Y offset",
  },
  Y_SCALE: {
    value: 4,
    min: 1,
    max: 10,
    step: 0.5,
    description: "Cloud Y offset scroll multiplier",
  },
  FADE_IN_START: {
    value: 0.12,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where clouds start appearing",
  },
  FADE_IN_END: {
    value: 0.22,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where clouds are fully visible",
  },
  FADE_OUT_START: {
    value: 0.65,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where clouds start fading",
  },
  FADE_OUT_END: {
    value: 0.82,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where clouds fully disappear",
  },
  PUSH_FORCE: {
    value: 0.8,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Click repulsion force on clouds",
  },
  PUSH_RADIUS: {
    value: 300,
    min: 50,
    max: 600,
    step: 10,
    description: "Click repulsion radius",
  },
  PULL_FORCE: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Drag pull force on clouds",
  },
  PULL_RADIUS: {
    value: 300,
    min: 50,
    max: 600,
    step: 10,
    description: "Drag pull radius",
  },
  BLUR_VEL_THRESHOLD: {
    value: 1,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Scroll velocity to begin vertical stretch",
  },
  BLUR_MAX_STRETCH: {
    value: 1.3,
    min: 1,
    max: 2,
    step: 0.05,
    description: "Maximum vertical stretch factor at peak velocity",
  },
  BLUR_VEL_SCALE: {
    value: 0.03,
    min: 0,
    max: 0.2,
    step: 0.005,
    description: "Stretch growth per velocity unit above threshold",
  },
  BLUR_OPACITY_MUL: {
    value: 0.85,
    min: 0.5,
    max: 1,
    step: 0.05,
    description: "Opacity multiplier at maximum stretch",
  },
});

// ── Breeze Wisps ──
const WISP = defineConstants("atmosphere.wisps", {
  LEN_MIN: {
    value: 100,
    min: 20,
    max: 500,
    step: 10,
    description: "Minimum wisp length",
  },
  LEN_RANGE: {
    value: 200,
    min: 0,
    max: 500,
    step: 10,
    description: "Length variation",
  },
  SPEED_MIN: {
    value: 0.3,
    min: 0,
    max: 3,
    step: 0.05,
    description: "Minimum horizontal speed",
  },
  SPEED_RANGE: {
    value: 0.5,
    min: 0,
    max: 3,
    step: 0.05,
    description: "Speed variation",
  },
  AMP_MIN: {
    value: 8,
    min: 0,
    max: 50,
    step: 1,
    description: "Minimum vertical wave amplitude",
  },
  AMP_RANGE: {
    value: 16,
    min: 0,
    max: 50,
    step: 1,
    description: "Amplitude variation",
  },
  OPACITY_MIN: {
    value: 0.04,
    min: 0,
    max: 0.3,
    step: 0.005,
    description: "Minimum wisp opacity",
  },
  OPACITY_RANGE: {
    value: 0.08,
    min: 0,
    max: 0.3,
    step: 0.005,
    description: "Opacity variation",
  },
  WIDTH_MIN: {
    value: 0.8,
    min: 0.1,
    max: 5,
    step: 0.1,
    description: "Minimum stroke width",
  },
  WIDTH_RANGE: {
    value: 1.5,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Width variation",
  },
  PHASE_SPEED: {
    value: 0.01,
    min: 0,
    max: 0.1,
    step: 0.001,
    description: "Wave phase increment per frame",
  },
  FALLBACK_COLOR: [180, 215, 245],
  Y_PIVOT: {
    value: 0.45,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll pivot for Y offset",
  },
  Y_SCALE: {
    value: 2.5,
    min: 0.5,
    max: 10,
    step: 0.5,
    description: "Y offset scroll multiplier",
  },
  FADE_IN_START: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where wisps appear",
  },
  FADE_IN_END: {
    value: 0.25,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where wisps are fully visible",
  },
  FADE_OUT_START: {
    value: 0.7,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where wisps start fading",
  },
  FADE_OUT_END: {
    value: 0.85,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where wisps disappear",
  },
});

// ── Scroll Motes ──
const MOTE = defineConstants("atmosphere.motes", {
  RADIUS_MIN: {
    value: 0.8,
    min: 0.1,
    max: 5,
    step: 0.1,
    description: "Minimum mote radius",
  },
  RADIUS_RANGE: {
    value: 1.5,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Radius variation",
  },
  SCROLL_THRESHOLD: {
    value: 0.3,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Minimum scroll velocity to activate",
  },
  VY_FACTOR: {
    value: 0.06,
    min: 0,
    max: 0.5,
    step: 0.005,
    description: "Vertical velocity from scroll",
  },
  VX_FACTOR: {
    value: 0.04,
    min: 0,
    max: 0.5,
    step: 0.005,
    description: "Horizontal scatter from scroll",
  },
  OPACITY_MAX: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Maximum mote opacity",
  },
  OPACITY_GAIN: {
    value: 0.008,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Opacity gain per scroll unit",
  },
  GRAVITY: {
    value: 0.015,
    min: 0,
    max: 0.1,
    step: 0.005,
    description: "Downward acceleration",
  },
  FRICTION: {
    value: 0.975,
    min: 0.9,
    max: 1,
    step: 0.005,
    description: "Velocity damping per frame",
  },
  OPACITY_DECAY: {
    value: 0.98,
    min: 0.9,
    max: 1,
    step: 0.005,
    description: "Opacity decay per frame",
  },
  BOUNDS: {
    value: 30,
    min: 5,
    max: 100,
    step: 5,
    description: "Offscreen margin for respawn",
  },
  DRAW_THRESHOLD: {
    value: 0.005,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Min opacity to draw",
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
});

// ── Horizon ──
const HORIZON = defineConstants("atmosphere.horizon", {
  Y_BASE: {
    value: 0.75,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Base glow Y position as fraction of height",
  },
  Y_SHIFT: {
    value: 0.25,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll-driven Y shift",
  },
  INTENSITY_BASE: {
    value: 0.12,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Base glow intensity",
  },
  INTENSITY_SCROLL: {
    value: 0.1,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Scroll-driven intensity boost",
  },
  INTENSITY_FALLOFF: {
    value: 0.15,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Intensity falloff past pivot",
  },
  RADIUS_BASE: {
    value: 0.7,
    min: 0.1,
    max: 2,
    step: 0.05,
    description: "Base glow radius as fraction of width",
  },
  RADIUS_SCROLL: {
    value: 0.2,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Scroll-driven radius expansion",
  },
});

// ── Gusts ──
const GUST = defineConstants("atmosphere.gusts", {
  SCROLL_THRESHOLD: {
    value: 1.5,
    min: 0.5,
    max: 5,
    step: 0.1,
    description: "Minimum scroll velocity for gusts",
  },
  SPAWN_MAX: {
    value: 2,
    min: 1,
    max: 10,
    step: 1,
    description: "Max gusts spawned per frame",
  },
  SPAWN_DIVISOR: {
    value: 4,
    min: 1,
    max: 20,
    step: 1,
    description: "Scroll velocity divisor for spawn count",
  },
  LEN_MIN: {
    value: 25,
    min: 5,
    max: 100,
    step: 5,
    description: "Minimum gust length",
  },
  LEN_RANGE: {
    value: 45,
    min: 0,
    max: 100,
    step: 5,
    description: "Length variation",
  },
  OPACITY_MIN: {
    value: 0.05,
    min: 0,
    max: 0.3,
    step: 0.005,
    description: "Minimum gust opacity",
  },
  OPACITY_RANGE: {
    value: 0.08,
    min: 0,
    max: 0.3,
    step: 0.005,
    description: "Opacity variation",
  },
  WIDTH_MIN: {
    value: 0.4,
    min: 0.1,
    max: 3,
    step: 0.1,
    description: "Minimum gust width",
  },
  WIDTH_RANGE: {
    value: 0.6,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Width variation",
  },
  LIFE_MIN: {
    value: 18,
    min: 5,
    max: 60,
    step: 1,
    description: "Minimum lifetime in frames",
  },
  LIFE_RANGE: {
    value: 14,
    min: 0,
    max: 60,
    step: 1,
    description: "Lifetime variation",
  },
});

// ── Mote Impulse ──
const MOTE_IMP = defineConstants("atmosphere.moteImpulse", {
  REPEL_RADIUS: {
    value: 200,
    min: 50,
    max: 500,
    step: 10,
    description: "Click repulsion radius for motes",
  },
  REPEL_SCALE: {
    value: 20,
    min: 1,
    max: 80,
    step: 1,
    description: "Click repulsion strength scaler",
  },
  OPACITY_GAIN: {
    value: 0.1,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Opacity boost from click impulse",
  },
});

// ── Module-scoped canvas refs ──
let _canvas, _ctx;

// ── Streak scroll parameters ──
function getStreakParams(sp) {
  if (sp < 0.2) return { opMul: 1.0, speedMul: 1.0 };
  if (sp < 0.5) return { opMul: 1.3, speedMul: 1.2 };
  if (sp < 0.75) return { opMul: 0.8, speedMul: 1.5 };
  return { opMul: 0.3, speedMul: 0.5 };
}

// ── Particle Classes ──

class Cloud {
  constructor(i, total) {
    this.x =
      Math.random() * _canvas.width * CLOUD.X_SPREAD -
      _canvas.width * CLOUD.X_OFFSET;
    this.baseY =
      (i / total) * _canvas.height * CLOUD.Y_DEPTH -
      _canvas.height * CLOUD.Y_OFFSET;
    this.speedX = (Math.random() - 0.5) * CLOUD.DRIFT_MAX;
    this.scale = CLOUD.SCALE_MIN + Math.random() * CLOUD.SCALE_RANGE;
    const count =
      CLOUD.BLOB_COUNT_MIN + Math.floor(Math.random() * CLOUD.BLOB_COUNT_RANGE);
    this.blobs = [];
    for (let j = 0; j < count; j++) {
      this.blobs.push({
        ox:
          (j - count / 2) * CLOUD.BLOB_SPACING * this.scale +
          (Math.random() - 0.5) * CLOUD.BLOB_JITTER_X * this.scale,
        oy:
          (Math.random() - CLOUD.BLOB_Y_BIAS) *
          CLOUD.BLOB_JITTER_Y *
          this.scale,
        r:
          (CLOUD.BLOB_RADIUS_MIN + Math.random() * CLOUD.BLOB_RADIUS_RANGE) *
          this.scale,
      });
    }
  }
  update() {
    this.x += this.speedX;
    const m = CLOUD.WRAP_MARGIN * this.scale;
    if (this.x < -m) this.x += _canvas.width + m * 2;
    if (this.x > _canvas.width + m) this.x -= _canvas.width + m * 2;
  }
  draw(yOffset, vis, pal, stretch) {
    if (vis <= 0) return;
    const y = this.baseY + yOffset;
    if (y < -CLOUD.CULL_MARGIN || y > _canvas.height + CLOUD.CULL_MARGIN)
      return;
    const cw = pal.cloudWhite;
    const cm = pal.cloudMid;
    const hasStretch = stretch > 1;
    const opFade = hasStretch
      ? 1 -
        ((stretch - 1) / (CLOUD.BLUR_MAX_STRETCH - 1)) *
          (1 - CLOUD.BLUR_OPACITY_MUL)
      : 1;
    if (hasStretch) {
      _ctx.save();
      _ctx.translate(this.x, y);
      _ctx.scale(1, stretch);
      _ctx.translate(-this.x, -y);
    }
    this.blobs.forEach((b) => {
      const bx = this.x + b.ox;
      const by = y + b.oy;
      const op =
        (CLOUD.OPACITY_BASE + CLOUD.OPACITY_DEPTH * this.scale) * vis * opFade;
      const grad = _ctx.createRadialGradient(
        bx,
        by,
        b.r * CLOUD.GRAD_INNER,
        bx,
        by,
        b.r,
      );
      grad.addColorStop(0, `rgba(${cw[0]},${cw[1]},${cw[2]},${op})`);
      grad.addColorStop(
        CLOUD.GRAD_MID,
        `rgba(${cm[0]},${cm[1]},${cm[2]},${op * CLOUD.GRAD_MID_OPACITY})`,
      );
      grad.addColorStop(1, "transparent");
      _ctx.fillStyle = grad;
      _ctx.beginPath();
      _ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      _ctx.fill();
    });
    if (hasStretch) {
      _ctx.restore();
    }
  }
}

class Streak {
  constructor() {
    this.reset(true);
  }
  reset(init) {
    this.x = Math.random() * _canvas.width;
    this.y = init ? Math.random() * _canvas.height : -10;
    this.len = STREAK.LEN_MIN + Math.random() * STREAK.LEN_RANGE;
    this.speed = STREAK.SPEED_MIN + Math.random() * STREAK.SPEED_RANGE;
    this.opacity = STREAK.OPACITY_MIN + Math.random() * STREAK.OPACITY_RANGE;
    this.width = STREAK.WIDTH_MIN + Math.random() * STREAK.WIDTH_RANGE;
    this.angle = STREAK.ANGLE_MIN + Math.random() * STREAK.ANGLE_RANGE;
  }
  update(sp) {
    this.y += this.speed * sp.speedMul;
    this.x += this.angle;
    if (this.y > _canvas.height + this.len) this.reset(false);
  }
  draw(sp, pal) {
    _ctx.save();
    _ctx.globalAlpha = this.opacity * sp.opMul;
    _ctx.strokeStyle = `rgba(${pal.streakColor},1)`;
    _ctx.lineWidth = this.width;
    _ctx.beginPath();
    _ctx.moveTo(this.x, this.y - this.len);
    _ctx.lineTo(this.x + this.angle * this.len, this.y);
    _ctx.stroke();
    _ctx.restore();
  }
}

class BreezeWisp {
  constructor() {
    this.reset(true);
  }
  reset(init) {
    this.x = init ? Math.random() * _canvas.width : -300;
    this.y = Math.random() * _canvas.height;
    this.len = WISP.LEN_MIN + Math.random() * WISP.LEN_RANGE;
    this.speed = WISP.SPEED_MIN + Math.random() * WISP.SPEED_RANGE;
    this.waveAmp = WISP.AMP_MIN + Math.random() * WISP.AMP_RANGE;
    this.opacity = WISP.OPACITY_MIN + Math.random() * WISP.OPACITY_RANGE;
    this.width = WISP.WIDTH_MIN + Math.random() * WISP.WIDTH_RANGE;
    this.phase = Math.random() * Math.PI * 2;
  }
  update() {
    this.x += this.speed;
    this.phase += WISP.PHASE_SPEED;
    if (this.x > _canvas.width + this.len) this.reset(false);
  }
  draw(vis, pal, yOffset) {
    if (vis <= 0) return;
    const wc = pal ? pal.wispColor : WISP.FALLBACK_COLOR;
    const dy = this.y + (yOffset || 0);
    if (dy < -50 || dy > _canvas.height + 50) return;
    _ctx.save();
    _ctx.globalAlpha = this.opacity * vis;
    _ctx.strokeStyle = `rgba(${wc[0]},${wc[1]},${wc[2]},1)`;
    _ctx.lineWidth = this.width;
    _ctx.beginPath();
    const sx = this.x - this.len;
    const sy = dy + Math.sin(this.phase) * this.waveAmp;
    const cy = dy + Math.sin(this.phase + 1) * this.waveAmp;
    const ey = dy + Math.sin(this.phase + 2) * this.waveAmp;
    _ctx.moveTo(sx, sy);
    _ctx.quadraticCurveTo(this.x - this.len * 0.5, cy, this.x, ey);
    _ctx.stroke();
    _ctx.restore();
  }
}

class ScrollMote {
  constructor() {
    this.x = Math.random() * _canvas.width;
    this.y = Math.random() * _canvas.height;
    this.vx = 0;
    this.vy = 0;
    this.r = MOTE.RADIUS_MIN + Math.random() * MOTE.RADIUS_RANGE;
    this.opacity = 0;
  }
  update(sv) {
    const absSv = Math.abs(sv);
    if (absSv > MOTE.SCROLL_THRESHOLD) {
      this.vy -= sv * MOTE.VY_FACTOR;
      this.vx += (Math.random() - 0.5) * absSv * MOTE.VX_FACTOR;
      this.opacity = Math.min(
        MOTE.OPACITY_MAX,
        this.opacity + absSv * MOTE.OPACITY_GAIN,
      );
    }
    this.vy += MOTE.GRAVITY;
    this.vx *= MOTE.FRICTION;
    this.vy *= MOTE.FRICTION;
    this.x += this.vx;
    this.y += this.vy;
    this.opacity *= MOTE.OPACITY_DECAY;
    if (
      this.y < -MOTE.BOUNDS ||
      this.y > _canvas.height + MOTE.BOUNDS ||
      this.x < -MOTE.BOUNDS ||
      this.x > _canvas.width + MOTE.BOUNDS
    ) {
      this.x = Math.random() * _canvas.width;
      this.y = Math.random() * _canvas.height;
      this.vx = 0;
      this.vy = 0;
    }
  }
  draw(pal) {
    if (this.opacity < MOTE.DRAW_THRESHOLD) return;
    const c = pal.moteColor;
    const g = pal.moteGlow;
    const grad = _ctx.createRadialGradient(
      this.x,
      this.y,
      0,
      this.x,
      this.y,
      this.r * MOTE.GLOW_RADIUS,
    );
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${this.opacity})`);
    grad.addColorStop(
      MOTE.GRAD_MID,
      `rgba(${g[0]},${g[1]},${g[2]},${this.opacity * MOTE.GRAD_MID_OPACITY})`,
    );
    grad.addColorStop(1, "transparent");
    _ctx.fillStyle = grad;
    _ctx.beginPath();
    _ctx.arc(this.x, this.y, this.r * MOTE.GLOW_RADIUS, 0, Math.PI * 2);
    _ctx.fill();
  }
}

// ── Factory ──

export function createAtmosphere(canvasEl, ctxEl, opts) {
  _canvas = canvasEl;
  _ctx = ctxEl;

  const clouds = opts.clouds
    ? Array.from(
        { length: opts.cloudCount },
        (_, i) => new Cloud(i, opts.cloudCount),
      )
    : [];
  const streaks = opts.streaks
    ? Array.from({ length: opts.streakCount }, () => new Streak())
    : [];
  const wisps = opts.wisps
    ? Array.from({ length: opts.wispCount }, () => new BreezeWisp())
    : [];
  const motes = opts.motes
    ? Array.from({ length: opts.moteCount }, () => new ScrollMote())
    : [];
  const gusts = opts.gusts
    ? Array.from({ length: opts.gustCount }, () => ({
        active: false,
        x: 0,
        y: 0,
        len: 0,
        angle: 0,
        opacity: 0,
        life: 0,
        maxLife: 0,
        width: 0,
      }))
    : [];

  return {
    draw(sp, scrollVelocity, pal, forces, blocky) {
      // Streaks — evolve with scroll
      if (opts.streaks) {
        const streakP = getStreakParams(sp);
        streaks.forEach((s) => {
          s.update(streakP);
          s.draw(streakP, pal);
        });
      }

      // Cloud layer — clouds live at a fixed altitude, viewport scrolls past them
      if (opts.clouds) {
        const cloudYOffset =
          -(sp - CLOUD.Y_PIVOT) * _canvas.height * CLOUD.Y_SCALE;
        const cloudVis = scrollFade(
          sp,
          CLOUD.FADE_IN_START,
          CLOUD.FADE_IN_END,
          CLOUD.FADE_OUT_START,
          CLOUD.FADE_OUT_END,
        );
        // Scroll velocity stretch — clouds smear vertically during fast scroll
        const absVel = Math.abs(scrollVelocity);
        const cloudStretch =
          absVel > CLOUD.BLUR_VEL_THRESHOLD
            ? Math.min(
                CLOUD.BLUR_MAX_STRETCH,
                1 + (absVel - CLOUD.BLUR_VEL_THRESHOLD) * CLOUD.BLUR_VEL_SCALE,
              )
            : 1;
        clouds.forEach((c) => {
          c.update();
          // Click gently pushes nearby clouds sideways
          if (forces.clickImpulse.strength > 0.1) {
            const cy = c.baseY + cloudYOffset;
            const dx = c.x - forces.clickImpulse.x;
            const dy = cy - forces.clickImpulse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CLOUD.PUSH_RADIUS && dist > 1) {
              c.x +=
                (dx / dist) * forces.clickImpulse.strength * CLOUD.PUSH_FORCE;
            }
          }
          // Drag gently pulls nearby clouds
          if (forces.isDragging) {
            const cy = c.baseY + cloudYOffset;
            const dx = forces.dragPos.x - c.x;
            const dy = forces.dragPos.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CLOUD.PULL_RADIUS && dist > 1) {
              c.x += (dx / dist) * CLOUD.PULL_FORCE;
            }
          }
          c.draw(cloudYOffset, cloudVis, pal, cloudStretch);
        });
      }

      // Breeze wisps — horizontal wind, also scroll with atmosphere
      if (opts.wisps) {
        const wispYOffset =
          -(sp - WISP.Y_PIVOT) * _canvas.height * WISP.Y_SCALE;
        const wispVis = scrollFade(
          sp,
          WISP.FADE_IN_START,
          WISP.FADE_IN_END,
          WISP.FADE_OUT_START,
          WISP.FADE_OUT_END,
        );
        wisps.forEach((w) => {
          w.update();
          w.draw(wispVis, pal, wispYOffset);
        });
      }

      // Horizon glow — shifts with descent (skipped in blocky mode)
      if (opts.horizon && !blocky) {
        const glowY = _canvas.height * (HORIZON.Y_BASE - sp * HORIZON.Y_SHIFT);
        const glowIntensity =
          HORIZON.INTENSITY_BASE +
          sp * HORIZON.INTENSITY_SCROLL -
          Math.max(0, sp - HORIZON.Y_BASE) * HORIZON.INTENSITY_FALLOFF;
        const hc = pal.horizonColor;
        const hg = _ctx.createRadialGradient(
          _canvas.width / 2,
          glowY,
          0,
          _canvas.width / 2,
          glowY,
          _canvas.width * (HORIZON.RADIUS_BASE + sp * HORIZON.RADIUS_SCROLL),
        );
        hg.addColorStop(
          0,
          `rgba(${hc[0]},${hc[1]},${hc[2]},${glowIntensity.toFixed(3)})`,
        );
        hg.addColorStop(1, "transparent");
        _ctx.fillStyle = hg;
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
      }

      // Edge breeze — wind lines from screen edges during scroll
      if (opts.gusts) {
        const absSv = Math.abs(scrollVelocity);
        if (absSv > GUST.SCROLL_THRESHOLD) {
          const spawnCount = Math.min(
            GUST.SPAWN_MAX,
            Math.floor(absSv / GUST.SPAWN_DIVISOR),
          );
          for (let i = 0; i < spawnCount; i++) {
            const g = gusts.find((g) => !g.active);
            if (!g) break;
            const side = Math.random();
            if (side < 0.35) {
              g.x = Math.random() * 50;
              g.y = Math.random() * _canvas.height;
            } else if (side < 0.7) {
              g.x = _canvas.width - Math.random() * 50;
              g.y = Math.random() * _canvas.height;
            } else if (side < 0.85) {
              g.x = Math.random() * _canvas.width;
              g.y = Math.random() * 30;
            } else {
              g.x = Math.random() * _canvas.width;
              g.y = _canvas.height - Math.random() * 30;
            }
            const dir = scrollVelocity > 0 ? -Math.PI / 2 : Math.PI / 2;
            g.angle = dir + (Math.random() - 0.5) * 0.7;
            g.len = GUST.LEN_MIN + Math.random() * GUST.LEN_RANGE;
            g.opacity = GUST.OPACITY_MIN + Math.random() * GUST.OPACITY_RANGE;
            g.width = GUST.WIDTH_MIN + Math.random() * GUST.WIDTH_RANGE;
            g.life = 0;
            g.maxLife = GUST.LIFE_MIN + Math.random() * GUST.LIFE_RANGE;
            g.active = true;
          }
        }
        const gc = pal.gustColor;
        gusts.forEach((g) => {
          if (!g.active) return;
          g.life++;
          if (g.life > g.maxLife) {
            g.active = false;
            return;
          }
          const p = g.life / g.maxLife;
          const op = g.opacity * (p < 0.2 ? p / 0.2 : (1 - p) / 0.8);
          const progress = 0.4 + p * 0.6;
          _ctx.save();
          _ctx.globalAlpha = op;
          _ctx.strokeStyle = `rgba(${gc},1)`;
          _ctx.lineWidth = g.width;
          _ctx.beginPath();
          _ctx.moveTo(g.x, g.y);
          _ctx.lineTo(
            g.x + Math.cos(g.angle) * g.len * progress,
            g.y + Math.sin(g.angle) * g.len * progress,
          );
          _ctx.stroke();
          _ctx.restore();
        });
      }

      // Scroll-reactive particles — blown by scroll, settle with gravity
      if (opts.motes) {
        const attractRadius =
          HOLD.ATTRACT_RADIUS_BASE +
          forces.holdStrength * HOLD.ATTRACT_RADIUS_HOLD;
        const attractForce =
          HOLD.ATTRACT_FORCE_BASE +
          forces.holdStrength * HOLD.ATTRACT_FORCE_HOLD;
        motes.forEach((m) => {
          m.update(scrollVelocity);
          if (forces.clickImpulse.strength > 0.05) {
            const dx = m.x - forces.clickImpulse.x;
            const dy = m.y - forces.clickImpulse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const repelR =
              MOTE_IMP.REPEL_RADIUS +
              forces.clickImpulse.strength * MOTE_IMP.REPEL_SCALE;
            if (dist < repelR && dist > 1) {
              const f = forces.clickImpulse.strength * (1 - dist / repelR);
              m.vx += (dx / dist) * f;
              m.vy += (dy / dist) * f;
              m.opacity = Math.min(0.5, m.opacity + f * MOTE_IMP.OPACITY_GAIN);
            }
          }
          if (forces.isDragging) {
            const dx = forces.dragPos.x - m.x;
            const dy = forces.dragPos.y - m.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < attractRadius && dist > 5) {
              const f = attractForce * (1 - dist / attractRadius);
              const nx = dx / dist;
              const ny = dy / dist;
              m.vx +=
                nx * f +
                -ny * f * forces.holdStrength * HOLD.ATTRACT_TANGENT_FACTOR;
              m.vy +=
                ny * f +
                nx * f * forces.holdStrength * HOLD.ATTRACT_TANGENT_FACTOR;
              m.opacity = Math.min(
                0.5,
                m.opacity + 0.005 + forces.holdStrength * 0.01,
              );
            }
          }
          applyWellForce(forces, m);
          m.draw(pal);
        });
      }
    },
  };
}
