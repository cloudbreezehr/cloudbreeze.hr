import { lerpColor, multiLerp, toRgba, resolvePalette } from './colors.js';

// ── Stars ──
const STAR_RADIUS_MIN = 0.3;
const STAR_RADIUS_RANGE = 1;
const STAR_OPACITY_MIN = 0.1;
const STAR_OPACITY_RANGE = 0.4;
const STAR_TWINKLE_SPEED_MIN = 0.008;
const STAR_TWINKLE_SPEED_RANGE = 0.03;
const STAR_DEPTH_MIN = 0.1;
const STAR_DEPTH_RANGE = 0.9;
const STAR_FLASH_CHANCE = 0.0003;
const STAR_FLASH_MIN = 0.6;
const STAR_FLASH_RANGE = 0.4;
const STAR_FLASH_DECAY = 0.92;
const STAR_FLASH_THRESHOLD = 0.01;
const STAR_TWINKLE_BASE = 0.7;
const STAR_TWINKLE_RANGE = 0.3;
const STAR_PARALLAX_SCALE = 0.4;
const STAR_FADE_START = 0.2;
const STAR_FADE_END = 0.5;
const STAR_TIME_STEP = 0.008;
const STAR_GLOW_THRESHOLD = 0.8;
const STAR_GLOW_RADIUS = 2.5;
const STAR_GLOW_MID = 0.35;
const STAR_GLOW_MID_ALPHA = 0.4;

// ── Shooting Stars ──
const SHOOTING_POOL_SIZE = 3;
const SHOOTING_SPAWN_CHANCE = 0.003;
const SHOOTING_X_SPREAD = 0.8;
const SHOOTING_X_OFFSET = 0.1;
const SHOOTING_Y_MAX = 0.4;
const SHOOTING_ANGLE_MIN = 0.15;
const SHOOTING_ANGLE_RANGE = 0.2;
const SHOOTING_SPEED_MIN = 6;
const SHOOTING_SPEED_RANGE = 8;
const SHOOTING_LEN_MIN = 40;
const SHOOTING_LEN_RANGE = 60;
const SHOOTING_OPACITY_MIN = 0.3;
const SHOOTING_OPACITY_RANGE = 0.4;
const SHOOTING_LIFE_MIN = 20;
const SHOOTING_LIFE_RANGE = 20;
const SHOOTING_LINE_WIDTH = 1.2;
const SHOOTING_OUTER_WIDTH = 6;
const SHOOTING_CORE_WIDTH = 0.5;

// ── Trail Glow (shared by shooting stars + meteors) ──
const TRAIL_OUTER_ALPHA = 0.25;
const TRAIL_OUTER_BLUR = 14;
const TRAIL_CORE_ALPHA = 0.9;
const TRAIL_CORE_BLUR = 4;

// ── Streaks ──
const STREAK_LEN_MIN = 40;
const STREAK_LEN_RANGE = 100;
const STREAK_SPEED_MIN = 0.3;
const STREAK_SPEED_RANGE = 0.5;
const STREAK_OPACITY_MIN = 0.02;
const STREAK_OPACITY_RANGE = 0.05;
const STREAK_WIDTH_MIN = 0.5;
const STREAK_WIDTH_RANGE = 1;
const STREAK_ANGLE_MIN = -0.1;
const STREAK_ANGLE_RANGE = 0.2;

// ── Clouds ──
const CLOUD_X_SPREAD = 1.4;
const CLOUD_X_OFFSET = 0.2;
const CLOUD_Y_DEPTH = 3;
const CLOUD_Y_OFFSET = 0.5;
const CLOUD_DRIFT_MAX = 0.12;
const CLOUD_SCALE_MIN = 0.5;
const CLOUD_SCALE_RANGE = 0.8;
const CLOUD_BLOB_COUNT_MIN = 4;
const CLOUD_BLOB_COUNT_RANGE = 3;
const CLOUD_BLOB_SPACING = 30;
const CLOUD_BLOB_JITTER_X = 25;
const CLOUD_BLOB_JITTER_Y = 40;
const CLOUD_BLOB_Y_BIAS = 0.65;
const CLOUD_BLOB_RADIUS_MIN = 30;
const CLOUD_BLOB_RADIUS_RANGE = 40;
const CLOUD_WRAP_MARGIN = 250;
const CLOUD_CULL_MARGIN = 150;
const CLOUD_OPACITY_BASE = 0.08;
const CLOUD_OPACITY_DEPTH = 0.04;
const CLOUD_GRAD_INNER = 0.08;
const CLOUD_GRAD_MID = 0.55;
const CLOUD_GRAD_MID_OPACITY = 0.4;
const CLOUD_Y_PIVOT = 0.38;
const CLOUD_Y_SCALE = 4;
const CLOUD_FADE_IN_START = 0.12;
const CLOUD_FADE_IN_END = 0.22;
const CLOUD_FADE_OUT_START = 0.65;
const CLOUD_FADE_OUT_END = 0.82;
const CLOUD_PUSH_FORCE = 0.8;
const CLOUD_PUSH_RADIUS = 300;
const CLOUD_PULL_FORCE = 0.15;
const CLOUD_PULL_RADIUS = 300;

// ── Breeze Wisps ──
const WISP_LEN_MIN = 100;
const WISP_LEN_RANGE = 200;
const WISP_SPEED_MIN = 0.3;
const WISP_SPEED_RANGE = 0.5;
const WISP_AMP_MIN = 8;
const WISP_AMP_RANGE = 16;
const WISP_OPACITY_MIN = 0.04;
const WISP_OPACITY_RANGE = 0.08;
const WISP_WIDTH_MIN = 0.8;
const WISP_WIDTH_RANGE = 1.5;
const WISP_PHASE_SPEED = 0.01;
const WISP_FALLBACK_COLOR = [180, 215, 245];
const WISP_Y_PIVOT = 0.45;
const WISP_Y_SCALE = 2.5;
const WISP_FADE_IN_START = 0.15;
const WISP_FADE_IN_END = 0.25;
const WISP_FADE_OUT_START = 0.70;
const WISP_FADE_OUT_END = 0.85;

// ── Scroll Motes ──
const MOTE_RADIUS_MIN = 0.8;
const MOTE_RADIUS_RANGE = 1.5;
const MOTE_SCROLL_THRESHOLD = 0.3;
const MOTE_VY_FACTOR = 0.06;
const MOTE_VX_FACTOR = 0.04;
const MOTE_OPACITY_MAX = 0.4;
const MOTE_OPACITY_GAIN = 0.008;
const MOTE_GRAVITY = 0.015;
const MOTE_FRICTION = 0.975;
const MOTE_OPACITY_DECAY = 0.98;
const MOTE_BOUNDS = 30;
const MOTE_DRAW_THRESHOLD = 0.005;
const MOTE_GLOW_RADIUS = 4;
const MOTE_GRAD_MID = 0.3;
const MOTE_GRAD_MID_OPACITY = 0.4;

// ── Horizon ──
const HORIZON_Y_BASE = 0.75;
const HORIZON_Y_SHIFT = 0.25;
const HORIZON_INTENSITY_BASE = 0.12;
const HORIZON_INTENSITY_SCROLL = 0.10;
const HORIZON_INTENSITY_FALLOFF = 0.15;
const HORIZON_RADIUS_BASE = 0.7;
const HORIZON_RADIUS_SCROLL = 0.2;

// ── Gusts ──
const GUST_SCROLL_THRESHOLD = 1.5;
const GUST_SPAWN_MAX = 2;
const GUST_SPAWN_DIVISOR = 4;
const GUST_LEN_MIN = 25;
const GUST_LEN_RANGE = 45;
const GUST_OPACITY_MIN = 0.05;
const GUST_OPACITY_RANGE = 0.08;
const GUST_WIDTH_MIN = 0.4;
const GUST_WIDTH_RANGE = 0.6;
const GUST_LIFE_MIN = 18;
const GUST_LIFE_RANGE = 14;

// ── Click Particles ──
const CLICK_COUNT_MIN = 6;
const CLICK_COUNT_RANGE = 5;
const CLICK_SPEED_MIN = 1.5;
const CLICK_SPEED_RANGE = 3;
const CLICK_RADIUS_MIN = 1;
const CLICK_RADIUS_RANGE = 2;
const CLICK_OPACITY_MIN = 0.3;
const CLICK_OPACITY_RANGE = 0.4;
const CLICK_LIFE_MIN = 40;
const CLICK_LIFE_RANGE = 30;
const CLICK_GRAVITY = 0.02;
const CLICK_FRICTION = 0.97;
const CLICK_GLOW_RADIUS = 3;
const CLICK_DRAW_THRESHOLD = 0.005;
const CLICK_BREEZE_FREQ = 0.08;
const CLICK_BREEZE_AMP = 0.3;

// ── Click Fury ──
const FURY_MAX = 60;
const FURY_PER_CLICK = 1;
const FURY_IDLE_GRACE = 0.4;
const FURY_DECAY_BASE = 4;
const FURY_DECAY_ACCEL = 32;

// ── Lightning (Tier 1) ──
const FURY_TIER1 = 25;
const LIGHTNING_MAX_BOLTS = 6;
const LIGHTNING_STEPS_MIN = 14;
const LIGHTNING_STEPS_RANGE = 8;
const LIGHTNING_JITTER_X = 90;
const LIGHTNING_JITTER_Y = 30;
const LIGHTNING_BRANCH_CHANCE = 0.35;
const LIGHTNING_BRANCH_ANGLE = 0.9;
const LIGHTNING_BRANCH_LEN_MIN = 40;
const LIGHTNING_BRANCH_LEN_RANGE = 80;
const LIGHTNING_BRANCH_STEPS_MIN = 5;
const LIGHTNING_BRANCH_STEPS_RANGE = 4;
const LIGHTNING_BRANCH_JITTER_X = 40;
const LIGHTNING_BRANCH_JITTER_Y = 20;
const LIGHTNING_LIFE_MIN = 14;
const LIGHTNING_LIFE_RANGE = 10;
const LIGHTNING_FLASH_ALPHA = 0.08;
const LIGHTNING_START_SPREAD = 200;
const LIGHTNING_START_Y = 0.2;
const LIGHTNING_OPACITY = 0.95;
const LIGHTNING_OUTER_WIDTH = 12;
const LIGHTNING_OUTER_ALPHA = 0.15;
const LIGHTNING_MID_WIDTH = 5;
const LIGHTNING_MID_ALPHA = 0.5;
const LIGHTNING_CORE_WIDTH = 1.5;
const LIGHTNING_CORE_ALPHA = 1.0;
const LIGHTNING_FLICKER_COUNT_MIN = 1;
const LIGHTNING_FLICKER_COUNT_RANGE = 2;
const LIGHTNING_FLICKER_ALPHA = 0.6;
const LIGHTNING_GLOW_BLUR = 20;
const LIGHTNING_MICRO_JITTER = 1.5;

// ── Aurora (Tier 2) ──
const FURY_TIER2 = 40;
const AURORA_RAMP = 10;
const AURORA_EASE = 0.02;
const AURORA_ALPHA = 0.15;
const AURORA_WAVE_COUNT = 4;
const AURORA_Y_MIN = 0.05;
const AURORA_Y_RANGE = 0.2;
const AURORA_SPEED_MIN = 0.005;
const AURORA_SPEED_RANGE = 0.008;
const AURORA_AMP_MIN = 15;
const AURORA_AMP_RANGE = 25;
const AURORA_WIDTH_MIN = 40;
const AURORA_WIDTH_RANGE = 60;
const AURORA_STEP = 24;
const AURORA_WAVE_FREQ = 6;
const AURORA_HARMONIC_PHASE = 1.3;
const AURORA_HARMONIC_FREQ = 3;
const AURORA_HARMONIC_AMP = 0.5;
const AURORA_BAND_MAIN_RATIO = 0.6;
const AURORA_BAND_HARMONIC_RATIO = 0.3;
const AURORA_BAND_OFFSET = 0.4;
const AURORA_HUE_SHIFT_MID = 20;
const AURORA_HUE_SHIFT_EDGE = 40;

// ── Meteors (Tier 3) ──
const FURY_TIER3 = 55;
const METEOR_POOL_SIZE = 20;
const METEOR_SPEED_MIN = 8;
const METEOR_SPEED_RANGE = 12;
const METEOR_LEN_MIN = 50;
const METEOR_LEN_RANGE = 80;
const METEOR_OPACITY_MIN = 0.4;
const METEOR_OPACITY_RANGE = 0.4;
const METEOR_LIFE_MIN = 18;
const METEOR_LIFE_RANGE = 18;
const METEOR_BURST_MIN = 2;
const METEOR_BURST_RANGE = 3;
const METEOR_LINE_WIDTH = 1.8;
const METEOR_OUTER_WIDTH = 10;
const METEOR_CORE_WIDTH = 0.8;

// ── Orbit Particles ──
const ORBIT_MAX = 60;
const ORBIT_SPAWN_FACTOR = 0.35;
const ORBIT_DIST_MIN = 20;
const ORBIT_DIST_RANGE = 60;
const ORBIT_DIST_HOLD = 40;
const ORBIT_RADIUS_MIN = 0.8;
const ORBIT_RADIUS_RANGE = 1.8;
const ORBIT_OPACITY_MIN = 0.15;
const ORBIT_OPACITY_HOLD = 0.3;
const ORBIT_PULL_BASE = 0.08;
const ORBIT_PULL_HOLD = 0.2;
const ORBIT_TANGENT_BASE = 0.06;
const ORBIT_TANGENT_HOLD = 0.18;
const ORBIT_FRICTION = 0.94;
const ORBIT_OPACITY_EASE = 0.06;
const ORBIT_GLOW_RADIUS = 4;
const ORBIT_DRAW_THRESHOLD = 0.005;

// ── Hold & Attract ──
const HOLD_RAMP_MS = 3000;
const ATTRACT_RADIUS_BASE = 250;
const ATTRACT_RADIUS_HOLD = 200;
const ATTRACT_FORCE_BASE = 0.12;
const ATTRACT_FORCE_HOLD = 0.4;
const ATTRACT_TANGENT_FACTOR = 0.6;
const BLAST_BASE = 3;
const BLAST_PER_SEC = 4;
const BLAST_MAX = 15;
const EXTRA_BURST_PER_SEC = 5;
const EXTRA_BURST_MAX = 20;
const EXTRA_BURST_LIFE_MIN = 50;
const EXTRA_BURST_LIFE_RANGE = 40;

// ── Drag Trail ──
const TRAIL_SPACING = 8;
const TRAIL_WIDTH_MIN = 1;
const TRAIL_WIDTH_RANGE = 1.5;
const TRAIL_OPACITY_MIN = 0.15;
const TRAIL_OPACITY_RANGE = 0.1;
const TRAIL_LIFE_MIN = 25;
const TRAIL_LIFE_RANGE = 15;
const TRAIL_CURVE_JITTER = 6;

// ── Impulse & Scroll ──
const IMPULSE_DECAY = 0.88;
const IMPULSE_REPEL_RADIUS = 200;
const IMPULSE_REPEL_SCALE = 20;
const IMPULSE_MOTE_OPACITY_GAIN = 0.1;
const SCROLL_VEL_GAIN = 0.3;
const SCROLL_VEL_DECAY = 0.92;

// ── Snowflakes (Frozen mode) ──
const SNOW_COUNT = 40;
const SNOW_RADIUS_MIN = 1.5;
const SNOW_RADIUS_RANGE = 3;
const SNOW_FALL_MIN = 0.3;
const SNOW_FALL_RANGE = 0.5;
const SNOW_SWAY_SPEED_MIN = 0.008;
const SNOW_SWAY_SPEED_RANGE = 0.012;
const SNOW_SWAY_AMP_MIN = 0.3;
const SNOW_SWAY_AMP_RANGE = 0.5;
const SNOW_OPACITY_MIN = 0.2;
const SNOW_OPACITY_RANGE = 0.5;
const SNOW_GLOW_RADIUS = 3;
const SNOW_GLOW_OPACITY = 0.25;
const SNOW_FRICTION = 0.96;
const SNOW_REPEL_RADIUS = 150;
const SNOW_ATTRACT_RADIUS = 150;
const SNOW_ATTRACT_TANGENT = 0.6;
const SNOW_SCROLL_THRESHOLD = 0.5;
const SNOW_SCROLL_VY = 0.03;
const SNOW_SCROLL_VX = 0.02;

// ── Snow Globe Shake ──
const SHAKE_REVERSAL_WINDOW = 500;  // ms — direction changes within this window count
const SHAKE_REVERSALS_NEEDED = 3;   // rapid reversals to trigger a shake
const SHAKE_MIN_DELTA = 3;          // minimum scroll delta to count as directional
const SHAKE_TURBULENCE = 4;         // velocity burst per snowflake on shake
const SHAKE_DECAY = 0.97;           // turbulence multiplier decays per frame
const SHAKE_OPACITY_BOOST = 0.15;   // temporary opacity increase during turbulence

// ── Sub-mode registry ──
// Body class names for each easter-egg mode. Used for active mode detection
// and palette resolution. Adding a new mode: push its body class here.
const SUBMODES = ['deep-sea', 'frozen', 'upside-down'];

// ── Bubbles (Deep Sea mode) ──
const BUBBLE_COUNT = 30;
const BUBBLE_AMBIENT_RATE = 2.5;     // bubbles per second from bottom
const BUBBLE_RADIUS_MIN = 2;
const BUBBLE_RADIUS_RANGE = 12;
const BUBBLE_RISE_MIN = 0.4;
const BUBBLE_RISE_RANGE = 0.8;
const BUBBLE_WOBBLE_SPEED_MIN = 0.015;
const BUBBLE_WOBBLE_SPEED_RANGE = 0.02;
const BUBBLE_WOBBLE_AMP_MIN = 0.4;
const BUBBLE_WOBBLE_AMP_RANGE = 0.8;
const BUBBLE_OPACITY_MIN = 0.3;
const BUBBLE_OPACITY_RANGE = 0.4;
const BUBBLE_GROWTH_RATE = 0.001;    // radius growth per frame
const BUBBLE_FRICTION = 0.96;
const BUBBLE_REPEL_RADIUS = 150;
const BUBBLE_ATTRACT_RADIUS = 150;
const BUBBLE_ATTRACT_TANGENT = 0.6;
const BUBBLE_SCROLL_THRESHOLD = 0.5;
const BUBBLE_SCROLL_VX = 0.03;
const BUBBLE_CLICK_BURST_MIN = 8;
const BUBBLE_CLICK_BURST_RANGE = 8;
const BUBBLE_DRAG_RATE = 0.3;       // bubbles per trail segment
const BUBBLE_SPECULAR_THRESHOLD = 5; // radius threshold for full specular arc
const BUBBLE_LARGE_THRESHOLD = 9;    // radius threshold for secondary highlight
const BUBBLE_POP_FRAMES = 8;         // frames for pop animation

// ── Jellyfish (Deep Sea mode) ──
const JELLY_COUNT = 8;
const JELLY_BELL_MIN = 8;
const JELLY_BELL_RANGE = 27;        // 8-35px bell radius
const JELLY_TENTACLE_SMALL = 3;
const JELLY_TENTACLE_MED = 4;
const JELLY_TENTACLE_LARGE = 5;
const JELLY_TENTACLE_MED_THRESHOLD = 15;
const JELLY_TENTACLE_LARGE_THRESHOLD = 25;
const JELLY_PULSE_SPEED_MIN = 0.008;
const JELLY_PULSE_SPEED_RANGE = 0.008;
const JELLY_PULSE_STRENGTH = 0.6;   // upward impulse per pulse
const JELLY_DRIFT_VX = 0.15;
const JELLY_DRIFT_VY = 0.05;        // slow downward drift between pulses
const JELLY_DIRECTION_CHANGE = 0.002;// chance per frame to change horizontal direction
const JELLY_GLOW_PULSE_SPEED = 0.02;
const JELLY_GLOW_ALPHA_MIN = 0.06;
const JELLY_GLOW_ALPHA_RANGE = 0.08;
const JELLY_FRICTION = 0.985;
const JELLY_REPEL_RADIUS = 180;
const JELLY_REPEL_DAMPEN = 0.3;     // high friction so they don't rocket away
const JELLY_ATTRACT_RADIUS = 200;
const JELLY_ATTRACT_STRENGTH = 0.04;// weak — they drift lazily
const JELLY_TENTACLE_SEGMENTS = 4;
const JELLY_TENTACLE_SEG_LEN_RATIO = 0.8; // tentacle length relative to bell
const JELLY_TENTACLE_WAVE_AMP = 0.3;
const JELLY_TENTACLE_WAVE_SPEED = 0.03;
const JELLY_COLORS = [
  [0, 255, 180],   // teal
  [0, 200, 255],   // cyan
  [100, 255, 200], // green
  [180, 150, 255], // soft purple
  [0, 230, 200],   // cyan-green
];

let canvas, ctx;

// Multi-layer trail rendering for shooting stars and meteors.
// Three passes: wide outer glow → gradient color trail → thin bright core.
function drawGlowTrail(headX, headY, tailX, tailY, colors, opacity, outerWidth, trailWidth, coreWidth) {
  const head = colors[2];

  // Layer 1: Wide outer glow (additive, blurred)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = opacity * TRAIL_OUTER_ALPHA;
  ctx.strokeStyle = `rgb(${head[0]},${head[1]},${head[2]})`;
  ctx.lineWidth = outerWidth;
  ctx.shadowColor = `rgba(${head[0]},${head[1]},${head[2]},0.6)`;
  ctx.shadowBlur = TRAIL_OUTER_BLUR;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(headX, headY);
  ctx.stroke();

  // Layer 2: Color gradient trail
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
  grad.addColorStop(0, `rgba(${colors[0]},0)`);
  grad.addColorStop(0.7, `rgba(${colors[1]},${opacity * 0.3})`);
  grad.addColorStop(1, `rgba(${colors[2]},${opacity})`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = trailWidth;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(headX, headY);
  ctx.stroke();

  // Layer 3: Bright white-hot core
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = opacity * TRAIL_CORE_ALPHA;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = coreWidth;
  ctx.shadowColor = `rgba(${head[0]},${head[1]},${head[2]},1)`;
  ctx.shadowBlur = TRAIL_CORE_BLUR;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(headX, headY);
  ctx.stroke();

  ctx.restore();
}

function getStreakParams(sp) {
  if (sp < 0.2) return { opMul: 1.0, speedMul: 1.0 };
  if (sp < 0.5) return { opMul: 1.3, speedMul: 1.2 };
  if (sp < 0.75) return { opMul: 0.8, speedMul: 1.5 };
  return { opMul: 0.3, speedMul: 0.5 };
}

class Cloud {
  constructor(i, total) {
    this.x = Math.random() * canvas.width * CLOUD_X_SPREAD - canvas.width * CLOUD_X_OFFSET;
    this.baseY = (i / total) * canvas.height * CLOUD_Y_DEPTH - canvas.height * CLOUD_Y_OFFSET;
    this.speedX = (Math.random() - 0.5) * CLOUD_DRIFT_MAX;
    this.scale = CLOUD_SCALE_MIN + Math.random() * CLOUD_SCALE_RANGE;
    const count = CLOUD_BLOB_COUNT_MIN + Math.floor(Math.random() * CLOUD_BLOB_COUNT_RANGE);
    this.blobs = [];
    for (let j = 0; j < count; j++) {
      this.blobs.push({
        ox: (j - count / 2) * CLOUD_BLOB_SPACING * this.scale + (Math.random() - 0.5) * CLOUD_BLOB_JITTER_X * this.scale,
        oy: (Math.random() - CLOUD_BLOB_Y_BIAS) * CLOUD_BLOB_JITTER_Y * this.scale,
        r: (CLOUD_BLOB_RADIUS_MIN + Math.random() * CLOUD_BLOB_RADIUS_RANGE) * this.scale,
      });
    }
  }
  update() {
    this.x += this.speedX;
    const m = CLOUD_WRAP_MARGIN * this.scale;
    if (this.x < -m) this.x += canvas.width + m * 2;
    if (this.x > canvas.width + m) this.x -= canvas.width + m * 2;
  }
  draw(yOffset, vis, pal) {
    if (vis <= 0) return;
    const y = this.baseY + yOffset;
    if (y < -CLOUD_CULL_MARGIN || y > canvas.height + CLOUD_CULL_MARGIN) return;
    const cw = pal.cloudWhite;
    const cm = pal.cloudMid;
    this.blobs.forEach(b => {
      const bx = this.x + b.ox;
      const by = y + b.oy;
      const op = (CLOUD_OPACITY_BASE + CLOUD_OPACITY_DEPTH * this.scale) * vis;
      const grad = ctx.createRadialGradient(bx, by, b.r * CLOUD_GRAD_INNER, bx, by, b.r);
      grad.addColorStop(0, `rgba(${cw[0]},${cw[1]},${cw[2]},${op})`);
      grad.addColorStop(CLOUD_GRAD_MID, `rgba(${cm[0]},${cm[1]},${cm[2]},${op * CLOUD_GRAD_MID_OPACITY})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

class Streak {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : -10;
    this.len = STREAK_LEN_MIN + Math.random() * STREAK_LEN_RANGE;
    this.speed = STREAK_SPEED_MIN + Math.random() * STREAK_SPEED_RANGE;
    this.opacity = STREAK_OPACITY_MIN + Math.random() * STREAK_OPACITY_RANGE;
    this.width = STREAK_WIDTH_MIN + Math.random() * STREAK_WIDTH_RANGE;
    this.angle = STREAK_ANGLE_MIN + Math.random() * STREAK_ANGLE_RANGE;
  }
  update(sp) {
    this.y += this.speed * sp.speedMul;
    this.x += this.angle;
    if (this.y > canvas.height + this.len) this.reset(false);
  }
  draw(sp, pal) {
    ctx.save();
    ctx.globalAlpha = this.opacity * sp.opMul;
    ctx.strokeStyle = `rgba(${pal.streakColor},1)`;
    ctx.lineWidth = this.width;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.len);
    ctx.lineTo(this.x + this.angle * this.len, this.y);
    ctx.stroke();
    ctx.restore();
  }
}

class BreezeWisp {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = init ? Math.random() * canvas.width : -300;
    this.y = Math.random() * canvas.height;
    this.len = WISP_LEN_MIN + Math.random() * WISP_LEN_RANGE;
    this.speed = WISP_SPEED_MIN + Math.random() * WISP_SPEED_RANGE;
    this.waveAmp = WISP_AMP_MIN + Math.random() * WISP_AMP_RANGE;
    this.opacity = WISP_OPACITY_MIN + Math.random() * WISP_OPACITY_RANGE;
    this.width = WISP_WIDTH_MIN + Math.random() * WISP_WIDTH_RANGE;
    this.phase = Math.random() * Math.PI * 2;
  }
  update() {
    this.x += this.speed;
    this.phase += WISP_PHASE_SPEED;
    if (this.x > canvas.width + this.len) this.reset(false);
  }
  draw(vis, pal, yOffset) {
    if (vis <= 0) return;
    const wc = pal ? pal.wispColor : WISP_FALLBACK_COLOR;
    const dy = this.y + (yOffset || 0);
    if (dy < -50 || dy > canvas.height + 50) return;
    ctx.save();
    ctx.globalAlpha = this.opacity * vis;
    ctx.strokeStyle = `rgba(${wc[0]},${wc[1]},${wc[2]},1)`;
    ctx.lineWidth = this.width;
    ctx.beginPath();
    const sx = this.x - this.len;
    const sy = dy + Math.sin(this.phase) * this.waveAmp;
    const cy = dy + Math.sin(this.phase + 1) * this.waveAmp;
    const ey = dy + Math.sin(this.phase + 2) * this.waveAmp;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(this.x - this.len * 0.5, cy, this.x, ey);
    ctx.stroke();
    ctx.restore();
  }
}

class ScrollMote {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = 0;
    this.vy = 0;
    this.r = MOTE_RADIUS_MIN + Math.random() * MOTE_RADIUS_RANGE;
    this.opacity = 0;
  }
  update(sv) {
    const absSv = Math.abs(sv);
    if (absSv > MOTE_SCROLL_THRESHOLD) {
      this.vy -= sv * MOTE_VY_FACTOR;
      this.vx += (Math.random() - 0.5) * absSv * MOTE_VX_FACTOR;
      this.opacity = Math.min(MOTE_OPACITY_MAX, this.opacity + absSv * MOTE_OPACITY_GAIN);
    }
    this.vy += MOTE_GRAVITY;
    this.vx *= MOTE_FRICTION;
    this.vy *= MOTE_FRICTION;
    this.x += this.vx;
    this.y += this.vy;
    this.opacity *= MOTE_OPACITY_DECAY;
    if (this.y < -MOTE_BOUNDS || this.y > canvas.height + MOTE_BOUNDS ||
        this.x < -MOTE_BOUNDS || this.x > canvas.width + MOTE_BOUNDS) {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = 0;
      this.vy = 0;
    }
  }
  draw(pal) {
    if (this.opacity < MOTE_DRAW_THRESHOLD) return;
    const c = pal.moteColor;
    const g = pal.moteGlow;
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * MOTE_GLOW_RADIUS);
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${this.opacity})`);
    grad.addColorStop(MOTE_GRAD_MID, `rgba(${g[0]},${g[1]},${g[2]},${this.opacity * MOTE_GRAD_MID_OPACITY})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * MOTE_GLOW_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}

const SNOW_CRYSTAL_THRESHOLD = 3;  // flakes with r >= this get crystalline arms
const SNOW_BRANCH_RATIO = 0.35;    // branch length relative to arm
const SNOW_BRANCH_ANGLE = Math.PI / 4;

class Snowflake {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : -10;
    this.r = SNOW_RADIUS_MIN + Math.random() * SNOW_RADIUS_RANGE;
    this.fallSpeed = SNOW_FALL_MIN + Math.random() * SNOW_FALL_RANGE;
    this.vx = 0;
    this.vy = 0;
    this.sway = Math.random() * Math.PI * 2;
    this.swaySpeed = SNOW_SWAY_SPEED_MIN + Math.random() * SNOW_SWAY_SPEED_RANGE;
    this.swayAmp = SNOW_SWAY_AMP_MIN + Math.random() * SNOW_SWAY_AMP_RANGE;
    this.opacity = SNOW_OPACITY_MIN + Math.random() * SNOW_OPACITY_RANGE;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.01;
  }
  update() {
    this.sway += this.swaySpeed;
    this.rotation += this.rotSpeed;
    this.x += Math.sin(this.sway) * this.swayAmp + this.vx;
    this.y += this.fallSpeed + this.vy;
    this.vx *= SNOW_FRICTION;
    this.vy *= SNOW_FRICTION;
    if (this.y > canvas.height + 10) this.reset(false);
    if (this.x < -20) this.x += canvas.width + 40;
    if (this.x > canvas.width + 20) this.x -= canvas.width + 40;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    if (this.r >= SNOW_CRYSTAL_THRESHOLD) {
      // Crystalline snowflake — 6 arms with branches, slow rotation
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.strokeStyle = 'rgba(220,240,255,1)';
      ctx.lineWidth = 0.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const arm = this.r;
      const branch = arm * SNOW_BRANCH_RATIO;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const ax = Math.cos(a) * arm;
        const ay = Math.sin(a) * arm;
        ctx.moveTo(0, 0);
        ctx.lineTo(ax, ay);
        // Two branches at 2/3 along the arm
        const mx = Math.cos(a) * arm * 0.6;
        const my = Math.sin(a) * arm * 0.6;
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a + SNOW_BRANCH_ANGLE) * branch, my + Math.sin(a + SNOW_BRANCH_ANGLE) * branch);
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a - SNOW_BRANCH_ANGLE) * branch, my + Math.sin(a - SNOW_BRANCH_ANGLE) * branch);
      }
      ctx.stroke();
      // Subtle glow for larger crystalline flakes
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * SNOW_GLOW_RADIUS);
      grad.addColorStop(0, `rgba(200,230,255,${SNOW_GLOW_OPACITY})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, this.r * SNOW_GLOW_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Small flakes — simple glowing dots
      ctx.fillStyle = 'rgba(220,240,255,1)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Bubble {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : canvas.height + 10;
    this.baseR = BUBBLE_RADIUS_MIN + Math.random() * BUBBLE_RADIUS_RANGE;
    this.r = this.baseR;
    this.riseSpeed = BUBBLE_RISE_MIN + (this.baseR / (BUBBLE_RADIUS_MIN + BUBBLE_RADIUS_RANGE)) * BUBBLE_RISE_RANGE;
    this.vx = 0;
    this.vy = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = BUBBLE_WOBBLE_SPEED_MIN + Math.random() * BUBBLE_WOBBLE_SPEED_RANGE;
    this.wobbleAmp = BUBBLE_WOBBLE_AMP_MIN + Math.random() * BUBBLE_WOBBLE_AMP_RANGE;
    this.opacity = BUBBLE_OPACITY_MIN + Math.random() * BUBBLE_OPACITY_RANGE;
    this.popping = false;
    this.popFrame = 0;
    this.active = init;
  }
  update() {
    if (this.popping) {
      this.popFrame++;
      if (this.popFrame > BUBBLE_POP_FRAMES) { this.reset(false); this.active = false; return; }
      this.r = this.baseR * (1 + this.popFrame / BUBBLE_POP_FRAMES * 0.5);
      this.opacity = (BUBBLE_OPACITY_MIN + BUBBLE_OPACITY_RANGE) * (1 - this.popFrame / BUBBLE_POP_FRAMES);
      return;
    }
    this.wobble += this.wobbleSpeed;
    this.r += BUBBLE_GROWTH_RATE;
    this.x += Math.sin(this.wobble) * this.wobbleAmp + this.vx;
    this.y += -this.riseSpeed + this.vy;
    this.vx *= BUBBLE_FRICTION;
    this.vy *= BUBBLE_FRICTION;
    // Pop at top
    if (this.y < -this.r) {
      this.popping = true;
      this.popFrame = 0;
      this.y = this.r;
      return;
    }
    // Wrap horizontal
    if (this.x < -20) this.x += canvas.width + 40;
    if (this.x > canvas.width + 20) this.x -= canvas.width + 40;
  }
  draw() {
    if (!this.active) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;

    // Thin ring outline
    ctx.strokeStyle = 'rgba(180,255,230,0.5)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.stroke();

    // Very faint fill
    ctx.fillStyle = 'rgba(0,255,200,0.04)';
    ctx.fill();

    // Specular highlight — small arc near top-left
    if (this.r >= BUBBLE_SPECULAR_THRESHOLD) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(this.x - this.r * 0.25, this.y - this.r * 0.25,
              this.r * 0.6, -Math.PI * 0.7, -Math.PI * 0.3);
      ctx.stroke();
    } else {
      // Small bubbles — just a dot highlight
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Large bubbles get a secondary smaller highlight
    if (this.r >= BUBBLE_LARGE_THRESHOLD) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(this.x + this.r * 0.15, this.y + this.r * 0.2,
              this.r * 0.25, Math.PI * 0.2, Math.PI * 0.6);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Jellyfish {
  constructor() { this.reset(true); }
  reset(init) {
    this.bellR = JELLY_BELL_MIN + Math.random() * JELLY_BELL_RANGE;
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : canvas.height + this.bellR * 2;
    this.vx = (Math.random() - 0.5) * JELLY_DRIFT_VX;
    this.vy = 0;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed = JELLY_PULSE_SPEED_MIN + Math.random() * JELLY_PULSE_SPEED_RANGE;
    this.glowPhase = Math.random() * Math.PI * 2;
    this.color = JELLY_COLORS[Math.floor(Math.random() * JELLY_COLORS.length)];
    // Tentacle count based on size
    if (this.bellR >= JELLY_TENTACLE_LARGE_THRESHOLD) {
      this.tentacles = JELLY_TENTACLE_LARGE;
    } else if (this.bellR >= JELLY_TENTACLE_MED_THRESHOLD) {
      this.tentacles = JELLY_TENTACLE_MED;
    } else {
      this.tentacles = JELLY_TENTACLE_SMALL;
    }
    this.tentaclePhases = Array.from({length: this.tentacles}, () => Math.random() * Math.PI * 2);
  }
  update() {
    this.pulse += this.pulseSpeed;
    this.glowPhase += JELLY_GLOW_PULSE_SPEED;

    // Pulsing swim — sharp upward kick on pulse peak, slow drift down otherwise
    const pulseVal = Math.sin(this.pulse);
    if (pulseVal > 0.95) {
      this.vy -= JELLY_PULSE_STRENGTH;
    }
    this.vy += JELLY_DRIFT_VY; // gentle downward drift

    // Occasional direction change
    if (Math.random() < JELLY_DIRECTION_CHANGE) {
      this.vx = (Math.random() - 0.5) * JELLY_DRIFT_VX * 2;
    }

    this.vx *= JELLY_FRICTION;
    this.vy *= JELLY_FRICTION;
    this.x += this.vx;
    this.y += this.vy;

    // Wrap around edges
    if (this.y < -this.bellR * 3) this.y = canvas.height + this.bellR * 2;
    if (this.y > canvas.height + this.bellR * 3) this.y = -this.bellR * 2;
    if (this.x < -this.bellR * 3) this.x += canvas.width + this.bellR * 6;
    if (this.x > canvas.width + this.bellR * 3) this.x -= canvas.width + this.bellR * 6;

    // Animate tentacle phases
    for (let i = 0; i < this.tentacles; i++) {
      this.tentaclePhases[i] += JELLY_TENTACLE_WAVE_SPEED + i * 0.005;
    }
  }
  draw() {
    const c = this.color;
    const glowAlpha = JELLY_GLOW_ALPHA_MIN + Math.sin(this.glowPhase) * 0.5 * JELLY_GLOW_ALPHA_RANGE + JELLY_GLOW_ALPHA_RANGE * 0.5;

    ctx.save();

    // Bioluminescent glow — radial gradient around the bell
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.bellR * 2.5);
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.bellR * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Bell dome — parabolic arc using quadraticCurveTo
    const bellW = this.bellR;
    const bellH = this.bellR * 0.8;
    // Faint fill
    const bellGrad = ctx.createRadialGradient(this.x, this.y - bellH * 0.3, 0, this.x, this.y, this.bellR);
    bellGrad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha * 1.5})`);
    bellGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.moveTo(this.x - bellW, this.y);
    ctx.quadraticCurveTo(this.x - bellW, this.y - bellH * 2, this.x, this.y - bellH * 1.5);
    ctx.quadraticCurveTo(this.x + bellW, this.y - bellH * 2, this.x + bellW, this.y);
    ctx.closePath();
    ctx.fill();

    // Bell stroke
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.3 + glowAlpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(this.x - bellW, this.y);
    ctx.quadraticCurveTo(this.x - bellW, this.y - bellH * 2, this.x, this.y - bellH * 1.5);
    ctx.quadraticCurveTo(this.x + bellW, this.y - bellH * 2, this.x + bellW, this.y);
    ctx.stroke();

    // Tentacles — wavy lines from bottom of bell
    const tentLen = this.bellR * JELLY_TENTACLE_SEG_LEN_RATIO;
    const spacing = (bellW * 2) / (this.tentacles + 1);
    // Velocity-based trailing — offset tentacle anchors by opposite of velocity
    const trailX = -this.vx * 8;
    const trailY = -this.vy * 4;

    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.15 + glowAlpha * 0.5})`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < this.tentacles; i++) {
      const baseX = this.x - bellW + spacing * (i + 1);
      ctx.beginPath();
      ctx.moveTo(baseX, this.y);
      let tx = baseX + trailX * 0.5;
      let ty = this.y;
      for (let s = 1; s <= JELLY_TENTACLE_SEGMENTS; s++) {
        const t = s / JELLY_TENTACLE_SEGMENTS;
        const wave = Math.sin(this.tentaclePhases[i] + s * 1.2) * JELLY_TENTACLE_WAVE_AMP * this.bellR;
        tx = baseX + wave + trailX * t;
        ty = this.y + tentLen * t + trailY * t;
        const cpx = baseX + Math.sin(this.tentaclePhases[i] + (s - 0.5) * 1.2) * JELLY_TENTACLE_WAVE_AMP * this.bellR + trailX * (t - 0.5 / JELLY_TENTACLE_SEGMENTS);
        const cpy = this.y + tentLen * (t - 0.5 / JELLY_TENTACLE_SEGMENTS) + trailY * (t - 0.5 / JELLY_TENTACLE_SEGMENTS);
        ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

const defaults = {
  sky: true,       stars: true,     streaks: true,
  clouds: true,    wisps: true,     horizon: true,
  gusts: true,     motes: true,
  starCount: 120,  streakCount: 35, cloudCount: 18,
  wispCount: 12,   gustCount: 24,   moteCount: 35,
};

export function initCanvas(canvasEl, theme, options) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  const opts = Object.assign({}, defaults, options);

  let isDarkMode = theme.isDark();
  let scrollProgress = 0;
  let scrollVelocity = 0;
  let lastScrollTop = window.scrollY || 0;

  // Snow globe shake detection — track scroll direction reversals
  let lastScrollDir = 0;       // -1 = up, 1 = down, 0 = idle
  let reversalTimes = [];      // timestamps of recent direction changes
  let snowTurbulence = 0;      // current turbulence intensity, decays per frame

  // Stable viewport height that ignores the mobile browser toolbar.
  // CSS `lvh` resolves to the large viewport (toolbar hidden).
  // Using it prevents particles from teleporting when the toolbar
  // collapses/expands on scroll.
  const lvhProbe = document.createElement('div');
  lvhProbe.style.cssText = 'position:fixed;height:100lvh;pointer-events:none;visibility:hidden';
  document.body.appendChild(lvhProbe);
  function stableHeight() {
    return lvhProbe.offsetHeight || window.innerHeight;
  }

  theme.onChange(dark => { isDarkMode = dark; });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = stableHeight();
  }

  function updateScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - stableHeight();
    scrollProgress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
    const delta = scrollTop - lastScrollTop;
    scrollVelocity += delta * SCROLL_VEL_GAIN;
    lastScrollTop = scrollTop;

    // Detect direction reversals for snow globe shake
    if (Math.abs(delta) >= SHAKE_MIN_DELTA) {
      const dir = delta > 0 ? 1 : -1;
      if (lastScrollDir !== 0 && dir !== lastScrollDir) {
        const now = performance.now();
        reversalTimes.push(now);
        // Prune old reversals outside the window
        reversalTimes = reversalTimes.filter(t => now - t < SHAKE_REVERSAL_WINDOW);
        if (reversalTimes.length >= SHAKE_REVERSALS_NEEDED) {
          snowTurbulence = 1;
          reversalTimes.length = 0;
        }
      }
      lastScrollDir = dir;
    }
  }

  resize();
  updateScroll();
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateScroll, { passive: true });

  const clouds = opts.clouds ? Array.from({length: opts.cloudCount}, (_, i) => new Cloud(i, opts.cloudCount)) : [];
  const streaks = opts.streaks ? Array.from({length: opts.streakCount}, () => new Streak()) : [];
  const wisps = opts.wisps ? Array.from({length: opts.wispCount}, () => new BreezeWisp()) : [];
  const motes = opts.motes ? Array.from({length: opts.moteCount}, () => new ScrollMote()) : [];
  const snowflakes = Array.from({length: SNOW_COUNT}, () => new Snowflake());
  const bubbles = Array.from({length: BUBBLE_COUNT}, () => new Bubble());
  const jellyfish = Array.from({length: JELLY_COUNT}, () => new Jellyfish());
  let bubbleSpawnAccum = 0; // accumulates fractional bubble spawns

  const gusts = opts.gusts ? Array.from({length: opts.gustCount}, () => ({
    active: false, x: 0, y: 0, len: 0, angle: 0,
    opacity: 0, life: 0, maxLife: 0, width: 0
  })) : [];

  const stars = opts.stars ? Array.from({length: opts.starCount}, () => {
    const r = STAR_RADIUS_MIN + Math.random() * STAR_RADIUS_RANGE;
    return {
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      r,
      opacity: STAR_OPACITY_MIN + Math.random() * STAR_OPACITY_RANGE,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: STAR_TWINKLE_SPEED_MIN + Math.random() * STAR_TWINKLE_SPEED_RANGE,
      flash: 0,
      depth: STAR_DEPTH_MIN + Math.random() * STAR_DEPTH_RANGE,
    };
  }) : [];

  // Shooting stars — small reusable pool
  const shootingStars = opts.stars ? Array.from({length: SHOOTING_POOL_SIZE}, () => ({
    active: false, x: 0, y: 0, angle: 0, speed: 0,
    len: 0, life: 0, maxLife: 0, opacity: 0,
  })) : [];

  let t = 0;
  let lastFrameTime = performance.now();
  function render() {
    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000; // seconds since last frame
    lastFrameTime = now;
    const sp = scrollProgress;
    const frozen = document.body.classList.contains('frozen');
    const deepSea = document.body.classList.contains('deep-sea');
    const upsd = document.body.classList.contains('upside-down');
    // Last-triggered-wins for palette + CSS — iterate registry, no hardcoded priority
    const activeModes = SUBMODES.filter(m => document.body.classList.contains(m));
    const lastSub = document.body.dataset.lastSubmode;
    const submode = (lastSub && activeModes.includes(lastSub)) ? lastSub : (activeModes[0] || null);
    // Sync active theme to body for CSS visual rules
    const prevTheme = document.body.dataset.activeTheme || null;
    if (submode !== prevTheme) {
      if (submode) document.body.dataset.activeTheme = submode;
      else delete document.body.dataset.activeTheme;
    }
    const pal = resolvePalette(isDarkMode ? 'dark' : 'light', submode);
    currentPal = pal;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scroll-interpolated sky gradient
    if (opts.sky) {
      const skyTop = multiLerp(pal.skyTop, sp);
      const skyBot = multiLerp(pal.skyBot, sp);
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, toRgba(skyTop));
      bg.addColorStop(0.5, toRgba(lerpColor(skyTop, skyBot, 0.5)));
      bg.addColorStop(1, toRgba(skyBot));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Stars — fade out between 20-50% scroll
    if (opts.stars) {
      const starFadeRange = STAR_FADE_END - STAR_FADE_START;
      const starVis = sp < STAR_FADE_START ? 1.0 : sp < STAR_FADE_END ? 1.0 - (sp - STAR_FADE_START) / starFadeRange : 0.0;
      if (starVis > 0) {
        t += STAR_TIME_STEP;
        stars.forEach(s => {
          s.twinkle += s.twinkleSpeed;
          // Random bright flash — rare, brief spike
          if (s.flash > 0) {
            s.flash *= STAR_FLASH_DECAY;
            if (s.flash < STAR_FLASH_THRESHOLD) s.flash = 0;
          } else if (Math.random() < STAR_FLASH_CHANCE) {
            s.flash = STAR_FLASH_MIN + Math.random() * STAR_FLASH_RANGE;
          }
          const base = s.opacity * (STAR_TWINKLE_BASE + STAR_TWINKLE_RANGE * Math.sin(s.twinkle));
          const op = Math.min(1, base + s.flash) * starVis;
          // Parallax — closer stars (higher depth) shift more on scroll
          const shift = s.depth * sp * canvas.height * STAR_PARALLAX_SCALE;
          const py = ((s.y - shift) % canvas.height + canvas.height) % canvas.height;
          const sx = s.x % canvas.width;
          const sc = pal.starColor;
          // Larger stars get a soft radial glow halo
          if (s.r >= STAR_GLOW_THRESHOLD) {
            const gr = s.r * STAR_GLOW_RADIUS;
            const grad = ctx.createRadialGradient(sx, py, 0, sx, py, gr);
            grad.addColorStop(0, `rgba(${sc},${op})`);
            grad.addColorStop(STAR_GLOW_MID, `rgba(${sc},${op * STAR_GLOW_MID_ALPHA})`);
            grad.addColorStop(1, `rgba(${sc},0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, py, gr, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = `rgba(${sc},${op})`;
            ctx.beginPath();
            ctx.arc(sx, py, s.r, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    }

    // Shooting stars — rare fast arcs across the sky
    if (opts.stars) {
      const starFadeRange2 = STAR_FADE_END - STAR_FADE_START;
      const starVis2 = sp < STAR_FADE_START ? 1.0 : sp < STAR_FADE_END ? 1.0 - (sp - STAR_FADE_START) / starFadeRange2 : 0.0;
      if (starVis2 > 0 && Math.random() < SHOOTING_SPAWN_CHANCE) {
        const ss = shootingStars.find(s => !s.active);
        if (ss) {
          ss.x = Math.random() * canvas.width * SHOOTING_X_SPREAD + canvas.width * SHOOTING_X_OFFSET;
          ss.y = Math.random() * canvas.height * SHOOTING_Y_MAX;
          ss.angle = Math.PI * SHOOTING_ANGLE_MIN + Math.random() * Math.PI * SHOOTING_ANGLE_RANGE;
          ss.speed = SHOOTING_SPEED_MIN + Math.random() * SHOOTING_SPEED_RANGE;
          ss.len = SHOOTING_LEN_MIN + Math.random() * SHOOTING_LEN_RANGE;
          ss.opacity = SHOOTING_OPACITY_MIN + Math.random() * SHOOTING_OPACITY_RANGE;
          ss.life = 0;
          ss.maxLife = SHOOTING_LIFE_MIN + Math.random() * SHOOTING_LIFE_RANGE;
          ss.active = true;
        }
      }
      shootingStars.forEach(ss => {
        if (!ss.active) return;
        ss.life++;
        if (ss.life > ss.maxLife) { ss.active = false; return; }
        const p = ss.life / ss.maxLife;
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        // Fade in quickly, fade out slowly
        const fade = p < 0.1 ? p / 0.1 : (1 - p) / 0.9;
        const op = ss.opacity * fade * starVis2;
        const tailX = ss.x - Math.cos(ss.angle) * ss.len * Math.min(1, p * 3);
        const tailY = ss.y - Math.sin(ss.angle) * ss.len * Math.min(1, p * 3);
        drawGlowTrail(ss.x, ss.y, tailX, tailY, pal.shootingColors, op,
          SHOOTING_OUTER_WIDTH, SHOOTING_LINE_WIDTH, SHOOTING_CORE_WIDTH);
      });
    }

    // Click fury — no decay while actively clicking, then ramps up fast once idle
    const idleSec = (now - lastClickTime) / 1000;
    if (idleSec >= FURY_IDLE_GRACE) {
      const decayRate = FURY_DECAY_BASE + (idleSec - FURY_IDLE_GRACE) * FURY_DECAY_ACCEL;
      clickFury = Math.max(0, clickFury - dt * decayRate);
    }

    // Tier 1: Lightning bolts — multi-layer rendering
    let flashThisFrame = false;
    for (let i = lightningBolts.length - 1; i >= 0; i--) {
      const bolt = lightningBolts[i];
      bolt.life++;
      if (bolt.life > bolt.maxLife) { lightningBolts.splice(i, 1); continue; }
      if (bolt.life === 1) flashThisFrame = true;

      // Exponential fade with flicker re-strikes
      const t = bolt.life / bolt.maxLife;
      let fade = Math.pow(1 - t, 2.5);
      const isFlicker = bolt.flickerFrames.indexOf(bolt.life) !== -1;
      if (isFlicker) fade = Math.max(fade, LIGHTNING_FLICKER_ALPHA);

      const col = pal.lightningColor;
      const sc = pal.lightningShadow;
      const branchScale = bolt.depth === 0 ? 1 : 0.45;
      // Per-frame micro-jitter seed for alive feel
      const jitterSeed = bolt.life * 7.13;

      // Helper: trace the polyline path with optional micro-jitter
      const tracePath = (jitter) => {
        const pts = bolt.points;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let p = 1; p < pts.length; p++) {
          const jx = jitter ? Math.sin(jitterSeed + p * 3.7) * LIGHTNING_MICRO_JITTER : 0;
          const jy = jitter ? Math.cos(jitterSeed + p * 2.3) * LIGHTNING_MICRO_JITTER : 0;
          // Smooth: use midpoints as control points for quadratic curves
          if (p < pts.length - 1) {
            const mx = (pts[p].x + jx + pts[p + 1].x) * 0.5;
            const my = (pts[p].y + jy + pts[p + 1].y) * 0.5;
            ctx.quadraticCurveTo(pts[p].x + jx, pts[p].y + jy, mx, my);
          } else {
            ctx.lineTo(pts[p].x + jx, pts[p].y + jy);
          }
        }
      };

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'lighter';

      // Layer 1: Wide outer glow
      ctx.globalAlpha = fade * LIGHTNING_OUTER_ALPHA * branchScale * LIGHTNING_OPACITY;
      ctx.strokeStyle = `rgb(${sc[0]},${sc[1]},${sc[2]})`;
      ctx.lineWidth = LIGHTNING_OUTER_WIDTH * branchScale;
      ctx.shadowColor = `rgba(${sc[0]},${sc[1]},${sc[2]},${sc[3]})`;
      ctx.shadowBlur = LIGHTNING_GLOW_BLUR * branchScale;
      tracePath(false);
      ctx.stroke();

      // Layer 2: Medium inner glow
      ctx.globalAlpha = fade * LIGHTNING_MID_ALPHA * branchScale * LIGHTNING_OPACITY;
      ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.lineWidth = LIGHTNING_MID_WIDTH * branchScale;
      ctx.shadowBlur = LIGHTNING_GLOW_BLUR * 0.5 * branchScale;
      tracePath(true);
      ctx.stroke();

      // Layer 3: Bright hot core
      ctx.globalAlpha = fade * LIGHTNING_CORE_ALPHA * LIGHTNING_OPACITY;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = LIGHTNING_CORE_WIDTH * branchScale;
      ctx.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},1)`;
      ctx.shadowBlur = 6;
      tracePath(true);
      ctx.stroke();

      ctx.restore();
    }
    if (flashThisFrame) {
      const fc = pal.lightningFlash;
      ctx.save();
      ctx.globalAlpha = LIGHTNING_FLASH_ALPHA;
      ctx.fillStyle = `rgba(${fc[0]},${fc[1]},${fc[2]},1)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Tier 2: Aurora borealis
    const auroraTarget = clickFury >= FURY_TIER2 ? Math.min((clickFury - FURY_TIER2) / AURORA_RAMP, 1) : 0;
    auroraIntensity += (auroraTarget - auroraIntensity) * AURORA_EASE;
    if (auroraIntensity > 0.01) {
      // Seed waves if needed
      while (auroraWaves.length < AURORA_WAVE_COUNT) {
        auroraWaves.push({
          y: canvas.height * (AURORA_Y_MIN + Math.random() * AURORA_Y_RANGE),
          phase: Math.random() * Math.PI * 2,
          speed: AURORA_SPEED_MIN + Math.random() * AURORA_SPEED_RANGE,
          amp: AURORA_AMP_MIN + Math.random() * AURORA_AMP_RANGE,
          width: AURORA_WIDTH_MIN + Math.random() * AURORA_WIDTH_RANGE,
          hue: pal.auroraHueBase + Math.random() * pal.auroraHueRange,
        });
      }
      // Wave Y offset for a given position ratio t (0–1 across viewport width)
      const waveY = (w, t, mainScale, harmonicScale) =>
        Math.sin(w.phase + t * AURORA_WAVE_FREQ) * w.amp * mainScale
        + Math.sin(w.phase * AURORA_HARMONIC_PHASE + t * AURORA_HARMONIC_FREQ) * w.amp * harmonicScale;

      // Trace one edge of the aurora band as a smooth quadratic curve.
      // When reverse=true, traces right-to-left for closing the bottom edge.
      const traceEdge = (w, mainScale, harmonicScale, yBase, reverse) => {
        const steps = Math.ceil(canvas.width / AURORA_STEP);
        for (let i = 1; i <= steps; i++) {
          const x = reverse
            ? Math.max(canvas.width - i * AURORA_STEP, 0)
            : Math.min(i * AURORA_STEP, canvas.width);
          const y = yBase + waveY(w, x / canvas.width, mainScale, harmonicScale);
          if (i < steps) {
            const nx = reverse
              ? Math.max(canvas.width - (i + 1) * AURORA_STEP, 0)
              : Math.min((i + 1) * AURORA_STEP, canvas.width);
            const ny = yBase + waveY(w, nx / canvas.width, mainScale, harmonicScale);
            ctx.quadraticCurveTo(x, y, (x + nx) * 0.5, (y + ny) * 0.5);
          } else {
            ctx.lineTo(x, y);
          }
        }
      };

      auroraWaves.forEach(w => {
        w.phase += w.speed;
        // Shift existing wave hues to match current mode
        if (pal.auroraHueBase < 60 && w.hue > 60) w.hue = (w.hue - 120 + 360) % 360;
        if (pal.auroraHueBase >= 60 && w.hue < 60) w.hue = pal.auroraHueBase + Math.random() * pal.auroraHueRange;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = auroraIntensity * AURORA_ALPHA;
        const grad = ctx.createLinearGradient(0, w.y - w.width, 0, w.y + w.width);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, `hsla(${w.hue}, 80%, 60%, 0.6)`);
        grad.addColorStop(0.5, `hsla(${w.hue + AURORA_HUE_SHIFT_MID}, 70%, 50%, 0.8)`);
        grad.addColorStop(0.7, `hsla(${w.hue + AURORA_HUE_SHIFT_EDGE}, 80%, 60%, 0.6)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        // Smooth closed path: top edge forward, bottom edge backward
        const botBase = w.y + w.width * AURORA_BAND_OFFSET;
        ctx.beginPath();
        ctx.moveTo(0, w.y + waveY(w, 0, 1, AURORA_HARMONIC_AMP));
        traceEdge(w, 1, AURORA_HARMONIC_AMP, w.y, false);
        ctx.lineTo(canvas.width, botBase + waveY(w, 1, AURORA_BAND_MAIN_RATIO, AURORA_BAND_HARMONIC_RATIO));
        traceEdge(w, AURORA_BAND_MAIN_RATIO, AURORA_BAND_HARMONIC_RATIO, botBase, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    }

    // Tier 3: Meteor shower — rendered alongside normal shooting stars
    meteorPool.forEach(m => {
      if (!m.active) return;
      m.life++;
      if (m.life > m.maxLife) { m.active = false; return; }
      const p = m.life / m.maxLife;
      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      const fade = p < 0.08 ? p / 0.08 : (1 - p) / 0.92;
      const op = m.opacity * fade;
      const tailX = m.x - Math.cos(m.angle) * m.len * Math.min(1, p * 3);
      const tailY = m.y - Math.sin(m.angle) * m.len * Math.min(1, p * 3);
      drawGlowTrail(m.x, m.y, tailX, tailY, pal.meteorColors, op,
        METEOR_OUTER_WIDTH, METEOR_LINE_WIDTH, METEOR_CORE_WIDTH);
    });

    // Streaks — evolve with scroll
    if (opts.streaks) {
      const streakP = getStreakParams(sp);
      streaks.forEach(s => { s.update(streakP); s.draw(streakP, pal); });
    }

    // Cloud layer — clouds live at a fixed altitude, viewport scrolls past them
    if (opts.clouds) {
      const cloudYOffset = -(sp - CLOUD_Y_PIVOT) * canvas.height * CLOUD_Y_SCALE;
      const cloudFadeInRange = CLOUD_FADE_IN_END - CLOUD_FADE_IN_START;
      const cloudFadeOutRange = CLOUD_FADE_OUT_END - CLOUD_FADE_OUT_START;
      const cloudVis = sp < CLOUD_FADE_IN_START ? 0 : sp < CLOUD_FADE_IN_END ? (sp - CLOUD_FADE_IN_START) / cloudFadeInRange
        : sp < CLOUD_FADE_OUT_START ? 1.0 : sp < CLOUD_FADE_OUT_END ? 1.0 - (sp - CLOUD_FADE_OUT_START) / cloudFadeOutRange : 0;
      clouds.forEach(c => {
        c.update();
        // Click gently pushes nearby clouds sideways
        if (clickImpulse.strength > 0.1) {
          const cy = c.baseY + cloudYOffset;
          const dx = c.x - clickImpulse.x;
          const dy = cy - clickImpulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CLOUD_PUSH_RADIUS && dist > 1) {
            c.x += (dx / dist) * clickImpulse.strength * CLOUD_PUSH_FORCE;
          }
        }
        // Drag gently pulls nearby clouds
        if (isDragging) {
          const cy = c.baseY + cloudYOffset;
          const dx = dragPos.x - c.x;
          const dy = dragPos.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CLOUD_PULL_RADIUS && dist > 1) {
            c.x += (dx / dist) * CLOUD_PULL_FORCE;
          }
        }
        c.draw(cloudYOffset, cloudVis, pal);
      });
    }

    // Breeze wisps — horizontal wind, also scroll with atmosphere
    if (opts.wisps) {
      const wispYOffset = -(sp - WISP_Y_PIVOT) * canvas.height * WISP_Y_SCALE;
      const wispFadeInRange = WISP_FADE_IN_END - WISP_FADE_IN_START;
      const wispFadeOutRange = WISP_FADE_OUT_END - WISP_FADE_OUT_START;
      const wispVis = sp < WISP_FADE_IN_START ? 0 : sp < WISP_FADE_IN_END ? (sp - WISP_FADE_IN_START) / wispFadeInRange
        : sp < WISP_FADE_OUT_START ? 1.0 : sp < WISP_FADE_OUT_END ? 1.0 - (sp - WISP_FADE_OUT_START) / wispFadeOutRange : 0;
      wisps.forEach(w => { w.update(); w.draw(wispVis, pal, wispYOffset); });
    }

    // Horizon glow — shifts with descent
    if (opts.horizon) {
      const glowY = canvas.height * (HORIZON_Y_BASE - sp * HORIZON_Y_SHIFT);
      const glowIntensity = HORIZON_INTENSITY_BASE + sp * HORIZON_INTENSITY_SCROLL - Math.max(0, sp - HORIZON_Y_BASE) * HORIZON_INTENSITY_FALLOFF;
      const hc = pal.horizonColor;
      const hg = ctx.createRadialGradient(canvas.width/2, glowY, 0, canvas.width/2, glowY, canvas.width * (HORIZON_RADIUS_BASE + sp * HORIZON_RADIUS_SCROLL));
      hg.addColorStop(0, `rgba(${hc[0]},${hc[1]},${hc[2]},${glowIntensity.toFixed(3)})`);
      hg.addColorStop(1, 'transparent');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Edge breeze — wind lines from screen edges during scroll
    scrollVelocity *= SCROLL_VEL_DECAY;
    if (opts.gusts) {
      const absSv = Math.abs(scrollVelocity);
      if (absSv > GUST_SCROLL_THRESHOLD) {
        const spawnCount = Math.min(GUST_SPAWN_MAX, Math.floor(absSv / GUST_SPAWN_DIVISOR));
        for (let i = 0; i < spawnCount; i++) {
          const g = gusts.find(g => !g.active);
          if (!g) break;
          const side = Math.random();
          if (side < 0.35) { g.x = Math.random() * 50; g.y = Math.random() * canvas.height; }
          else if (side < 0.7) { g.x = canvas.width - Math.random() * 50; g.y = Math.random() * canvas.height; }
          else if (side < 0.85) { g.x = Math.random() * canvas.width; g.y = Math.random() * 30; }
          else { g.x = Math.random() * canvas.width; g.y = canvas.height - Math.random() * 30; }
          const dir = scrollVelocity > 0 ? -Math.PI / 2 : Math.PI / 2;
          g.angle = dir + (Math.random() - 0.5) * 0.7;
          g.len = GUST_LEN_MIN + Math.random() * GUST_LEN_RANGE;
          g.opacity = GUST_OPACITY_MIN + Math.random() * GUST_OPACITY_RANGE;
          g.width = GUST_WIDTH_MIN + Math.random() * GUST_WIDTH_RANGE;
          g.life = 0;
          g.maxLife = GUST_LIFE_MIN + Math.random() * GUST_LIFE_RANGE;
          g.active = true;
        }
      }
      const gc = pal.gustColor;
      gusts.forEach(g => {
        if (!g.active) return;
        g.life++;
        if (g.life > g.maxLife) { g.active = false; return; }
        const p = g.life / g.maxLife;
        const op = g.opacity * (p < 0.2 ? p / 0.2 : (1 - p) / 0.8);
        const progress = 0.4 + p * 0.6;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.strokeStyle = `rgba(${gc},1)`;
        ctx.lineWidth = g.width;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x + Math.cos(g.angle) * g.len * progress,
                   g.y + Math.sin(g.angle) * g.len * progress);
        ctx.stroke();
        ctx.restore();
      });
    }

    // Scroll-reactive particles — blown by scroll, settle with gravity
    // Also react to click (repel) and drag (attract, scaled by hold duration)
    if (isDragging) {
      holdStrength = Math.min((performance.now() - holdStart) / HOLD_RAMP_MS, 1);
    }
    const attractRadius = ATTRACT_RADIUS_BASE + holdStrength * ATTRACT_RADIUS_HOLD;
    const attractForce = ATTRACT_FORCE_BASE + holdStrength * ATTRACT_FORCE_HOLD;

    if (opts.motes) {
      motes.forEach(m => {
        m.update(scrollVelocity);
        if (clickImpulse.strength > 0.05) {
          const dx = m.x - clickImpulse.x;
          const dy = m.y - clickImpulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const repelR = IMPULSE_REPEL_RADIUS + clickImpulse.strength * IMPULSE_REPEL_SCALE;
          if (dist < repelR && dist > 1) {
            const f = clickImpulse.strength * (1 - dist / repelR);
            m.vx += (dx / dist) * f;
            m.vy += (dy / dist) * f;
            m.opacity = Math.min(0.5, m.opacity + f * IMPULSE_MOTE_OPACITY_GAIN);
          }
        }
        if (isDragging) {
          const dx = dragPos.x - m.x;
          const dy = dragPos.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < attractRadius && dist > 5) {
            const f = attractForce * (1 - dist / attractRadius);
            const nx = dx / dist;
            const ny = dy / dist;
            // Radial pull + tangential orbit (orbit grows with hold strength)
            m.vx += nx * f + (-ny) * f * holdStrength * ATTRACT_TANGENT_FACTOR;
            m.vy += ny * f + nx * f * holdStrength * ATTRACT_TANGENT_FACTOR;
            m.opacity = Math.min(0.5, m.opacity + 0.005 + holdStrength * 0.01);
          }
        }
        m.draw(pal);
      });
    }
    // Snowflakes — frozen mode ambient snow with pointer interaction + snow globe
    if (frozen) {
      // Snow globe turbulence — burst then decay
      if (snowTurbulence > 0.01) {
        snowflakes.forEach(s => {
          s.vx += (Math.random() - 0.5) * SHAKE_TURBULENCE * snowTurbulence;
          s.vy += (Math.random() - 0.5) * SHAKE_TURBULENCE * snowTurbulence;
          s.opacity = Math.min(1, s.opacity + SHAKE_OPACITY_BOOST * snowTurbulence);
        });
        snowTurbulence *= SHAKE_DECAY;
      }
      snowflakes.forEach(s => {
        s.update();
        // Click repels nearby snowflakes
        if (clickImpulse.strength > 0.05) {
          const dx = s.x - clickImpulse.x;
          const dy = s.y - clickImpulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < SNOW_REPEL_RADIUS && dist > 1) {
            const f = clickImpulse.strength * (1 - dist / SNOW_REPEL_RADIUS) * 0.8;
            s.vx += (dx / dist) * f;
            s.vy += (dy / dist) * f;
          }
        }
        // Drag attracts nearby snowflakes with tangential orbit
        if (isDragging) {
          const dx = dragPos.x - s.x;
          const dy = dragPos.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < SNOW_ATTRACT_RADIUS && dist > 5) {
            const f = 0.1 * (1 - dist / SNOW_ATTRACT_RADIUS);
            const nx = dx / dist;
            const ny = dy / dist;
            s.vx += nx * f + (-ny) * f * holdStrength * SNOW_ATTRACT_TANGENT;
            s.vy += ny * f + nx * f * holdStrength * SNOW_ATTRACT_TANGENT;
          }
        }
        // Scroll pushes snowflakes
        if (Math.abs(scrollVelocity) > SNOW_SCROLL_THRESHOLD) {
          s.vy -= scrollVelocity * SNOW_SCROLL_VY;
          s.vx += (Math.random() - 0.5) * Math.abs(scrollVelocity) * SNOW_SCROLL_VX;
        }
        s.draw();
      });
    }

    // Bubbles + Jellyfish — deep-sea mode
    if (deepSea) {
      // Ambient bubble spawning
      bubbleSpawnAccum += BUBBLE_AMBIENT_RATE * dt;
      while (bubbleSpawnAccum >= 1) {
        bubbleSpawnAccum--;
        const b = bubbles.find(b => !b.active);
        if (b) { b.reset(false); b.active = true; }
      }

      bubbles.forEach(b => {
        if (!b.active) return;
        b.update();
        // Click repels
        if (clickImpulse.strength > 0.05) {
          const dx = b.x - clickImpulse.x;
          const dy = b.y - clickImpulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < BUBBLE_REPEL_RADIUS && dist > 1) {
            const f = clickImpulse.strength * (1 - dist / BUBBLE_REPEL_RADIUS) * 0.8;
            b.vx += (dx / dist) * f;
            b.vy += (dy / dist) * f;
          }
        }
        // Drag attracts with tangential orbit
        if (isDragging) {
          const dx = dragPos.x - b.x;
          const dy = dragPos.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < BUBBLE_ATTRACT_RADIUS && dist > 5) {
            const f = 0.1 * (1 - dist / BUBBLE_ATTRACT_RADIUS);
            const nx = dx / dist;
            const ny = dy / dist;
            b.vx += nx * f + (-ny) * f * holdStrength * BUBBLE_ATTRACT_TANGENT;
            b.vy += ny * f + nx * f * holdStrength * BUBBLE_ATTRACT_TANGENT;
          }
        }
        // Scroll pushes laterally
        if (Math.abs(scrollVelocity) > BUBBLE_SCROLL_THRESHOLD) {
          b.vx += scrollVelocity * BUBBLE_SCROLL_VX;
        }
        b.draw();
      });

      jellyfish.forEach(j => {
        j.update();
        // Click repels gently (high friction via dampen factor)
        if (clickImpulse.strength > 0.05) {
          const dx = j.x - clickImpulse.x;
          const dy = j.y - clickImpulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < JELLY_REPEL_RADIUS && dist > 1) {
            const f = clickImpulse.strength * (1 - dist / JELLY_REPEL_RADIUS) * JELLY_REPEL_DAMPEN;
            j.vx += (dx / dist) * f;
            j.vy += (dy / dist) * f;
          }
        }
        // Drag attracts weakly — lazy drift toward cursor
        if (isDragging) {
          const dx = dragPos.x - j.x;
          const dy = dragPos.y - j.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < JELLY_ATTRACT_RADIUS && dist > 5) {
            const f = JELLY_ATTRACT_STRENGTH * (1 - dist / JELLY_ATTRACT_RADIUS);
            j.vx += (dx / dist) * f;
            j.vy += (dy / dist) * f;
          }
        }
        j.draw();
      });
    }

    clickImpulse.strength *= IMPULSE_DECAY;

    // Click burst particles
    clickParticles.forEach((p, i) => {
      p.life++;
      if (p.life > p.maxLife) { clickParticles.splice(i, 1); return; }
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= CLICK_FRICTION;
      p.vy *= CLICK_FRICTION;
      p.vy += CLICK_GRAVITY;
      // Breeze curve
      p.x += Math.sin(p.life * CLICK_BREEZE_FREQ + p.phase) * CLICK_BREEZE_AMP;
      const fade = 1 - p.life / p.maxLife;
      const op = p.opacity * fade;
      if (op < CLICK_DRAW_THRESHOLD) return;
      const c = p.color;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * CLICK_GLOW_RADIUS);
      grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${op})`);
      grad.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},${op * 0.4})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * CLICK_GLOW_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    // Hold-to-charge orbit particles — spawn, orbit, and glow around cursor
    if (isDragging && holdStrength > 0.1) {
      // Spawn new orbit particles
      const spawnChance = holdStrength * ORBIT_SPAWN_FACTOR;
      if (Math.random() < spawnChance && orbitParticles.length < ORBIT_MAX) {
        const angle = Math.random() * Math.PI * 2;
        const dist = ORBIT_DIST_MIN + Math.random() * (ORBIT_DIST_RANGE + holdStrength * ORBIT_DIST_HOLD);
        orbitParticles.push({
          x: dragPos.x + Math.cos(angle) * dist,
          y: dragPos.y + Math.sin(angle) * dist,
          vx: 0, vy: 0,
          r: ORBIT_RADIUS_MIN + Math.random() * ORBIT_RADIUS_RANGE,
          opacity: 0,
          targetOpacity: ORBIT_OPACITY_MIN + holdStrength * ORBIT_OPACITY_HOLD,
        });
      }
    }
    // Update and draw orbit particles
    const oc = pal.orbitColor;
    for (let i = orbitParticles.length - 1; i >= 0; i--) {
      const p = orbitParticles[i];
      const dx = dragPos.x - p.x;
      const dy = dragPos.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      // Pull inward + orbit tangent
      const pull = ORBIT_PULL_BASE + holdStrength * ORBIT_PULL_HOLD;
      const orbit = ORBIT_TANGENT_BASE + holdStrength * ORBIT_TANGENT_HOLD;
      p.vx += nx * pull + (-ny) * orbit;
      p.vy += ny * pull + nx * orbit;
      p.vx *= ORBIT_FRICTION;
      p.vy *= ORBIT_FRICTION;
      p.x += p.vx;
      p.y += p.vy;
      p.opacity += (p.targetOpacity - p.opacity) * ORBIT_OPACITY_EASE;
      // Draw with glow
      if (p.opacity > ORBIT_DRAW_THRESHOLD) {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * ORBIT_GLOW_RADIUS);
        grad.addColorStop(0, `rgba(${oc[0]},${oc[1]},${oc[2]},${p.opacity})`);
        grad.addColorStop(0.3, `rgba(${oc[0]},${oc[1]},${oc[2]},${p.opacity * 0.4})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * ORBIT_GLOW_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Drag breeze trail
    for (let i = trailSegments.length - 1; i >= 0; i--) {
      const s = trailSegments[i];
      s.life++;
      if (s.life > s.maxLife) { trailSegments.splice(i, 1); continue; }
      s.x += Math.sin(s.life * 0.06 + s.phase) * 0.4;
      s.y += Math.cos(s.life * 0.05 + s.phase) * 0.2;
      const fade = 1 - s.life / s.maxLife;
      const op = s.opacity * fade;
      if (op < CLICK_DRAW_THRESHOLD || !s.prev) continue;
      const c = pal.trailColor;
      ctx.save();
      ctx.globalAlpha = op;
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},1)`;
      ctx.lineWidth = s.width * fade;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.prev.x, s.prev.y);
      ctx.quadraticCurveTo(
        (s.prev.x + s.x) / 2 + Math.sin(s.phase) * TRAIL_CURVE_JITTER,
        (s.prev.y + s.y) / 2 + Math.cos(s.phase) * TRAIL_CURVE_JITTER,
        s.x, s.y
      );
      ctx.stroke();
      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  // Interaction forces — click repels, drag attracts, hold charges
  const clickImpulse = { x: 0, y: 0, strength: 0 };
  const dragPos = { x: 0, y: 0 };
  const orbitParticles = [];
  let holdStart = 0;
  let holdStrength = 0;

  // Click burst — scatter luminous motes from click point
  const clickParticles = [];
  const isUpside = () => document.body.classList.contains('upside-down');
  const isFrozen = () => document.body.classList.contains('frozen');
  let currentPal = resolvePalette(isDarkMode ? 'dark' : 'light', null);

  // Click fury — rapid clicking triggers escalating sky effects
  let clickFury = 0;
  let lastClickTime = 0;
  const lightningBolts = [];        // Tier 1: active bolt segments
  const auroraWaves = [];           // Tier 2: flowing ribbon control points
  let auroraIntensity = 0;          // fades in/out smoothly
  const meteorPool = Array.from({length: METEOR_POOL_SIZE}, () => ({
    active: false, x: 0, y: 0, angle: 0, speed: 0,
    len: 0, life: 0, maxLife: 0, opacity: 0,
  }));

  // Generate a branching lightning bolt from (x1,y1) to (x2,y2)
  function spawnLightning(x1, y1, x2, y2, depth) {
    const isBranch = depth > 0;
    const stepsMin = isBranch ? LIGHTNING_BRANCH_STEPS_MIN : LIGHTNING_STEPS_MIN;
    const stepsRange = isBranch ? LIGHTNING_BRANCH_STEPS_RANGE : LIGHTNING_STEPS_RANGE;
    const jitterX = isBranch ? LIGHTNING_BRANCH_JITTER_X : LIGHTNING_JITTER_X;
    const jitterY = isBranch ? LIGHTNING_BRANCH_JITTER_Y : LIGHTNING_JITTER_Y;
    const steps = stepsMin + Math.floor(Math.random() * stepsRange);
    // Build polyline as array of points
    const points = [{x: x1, y: y1}];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Jitter peaks in the middle of the bolt and tapers at endpoints
      const envelope = Math.sin(t * Math.PI);
      const nx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitterX * envelope;
      const ny = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitterY * envelope;
      points.push({x: nx, y: ny});
      // Random branch (main bolt and first-level branches only)
      if (depth < 2 && Math.random() < LIGHTNING_BRANCH_CHANCE) {
        const bAngle = Math.atan2(ny - points[points.length - 2].y, nx - points[points.length - 2].x)
                      + (Math.random() - 0.5) * LIGHTNING_BRANCH_ANGLE;
        const bLen = LIGHTNING_BRANCH_LEN_MIN + Math.random() * LIGHTNING_BRANCH_LEN_RANGE;
        spawnLightning(nx, ny, nx + Math.cos(bAngle) * bLen, ny + Math.sin(bAngle) * bLen, depth + 1);
      }
    }
    // Pre-compute flicker frames (frames where the bolt re-strikes at higher brightness)
    const maxLife = LIGHTNING_LIFE_MIN + Math.random() * LIGHTNING_LIFE_RANGE;
    const flickerCount = LIGHTNING_FLICKER_COUNT_MIN + Math.floor(Math.random() * LIGHTNING_FLICKER_COUNT_RANGE);
    const flickerFrames = [];
    for (let f = 0; f < flickerCount; f++) {
      flickerFrames.push(2 + Math.floor(Math.random() * (maxLife * 0.6)));
    }
    lightningBolts.push({ points, depth, life: 0, maxLife, flickerFrames });
  }

  // In upside-down mode the page is flipped via scaleY(-1), so canvas Y must mirror
  const canvasY = y => isUpside() ? canvas.height - y : y;

  document.addEventListener('click', e => {
    const cx = e.clientX;
    const cy = canvasY(e.clientY);
    clickImpulse.x = cx;
    clickImpulse.y = cy;
    clickImpulse.strength = BLAST_BASE;
    clickFury = Math.min(clickFury + FURY_PER_CLICK, FURY_MAX);
    lastClickTime = performance.now();

    // Tier 1: Lightning
    if (clickFury >= FURY_TIER1 && lightningBolts.length < LIGHTNING_MAX_BOLTS) {
      const startX = cx + (Math.random() - 0.5) * LIGHTNING_START_SPREAD;
      const startY = Math.random() * canvas.height * LIGHTNING_START_Y;
      spawnLightning(startX, startY, cx, cy, 0);
    }

    // Tier 3: Meteor shower burst
    if (clickFury >= FURY_TIER3 && scrollProgress < STAR_FADE_END) {
      const count = METEOR_BURST_MIN + Math.floor(Math.random() * METEOR_BURST_RANGE);
      for (let i = 0; i < count; i++) {
        const m = meteorPool.find(m => !m.active);
        if (!m) break;
        m.x = Math.random() * canvas.width * SHOOTING_X_SPREAD + canvas.width * SHOOTING_X_OFFSET;
        m.y = Math.random() * canvas.height * 0.3;
        m.angle = Math.PI * SHOOTING_ANGLE_MIN + Math.random() * Math.PI * 0.25;
        m.speed = METEOR_SPEED_MIN + Math.random() * METEOR_SPEED_RANGE;
        m.len = METEOR_LEN_MIN + Math.random() * METEOR_LEN_RANGE;
        m.opacity = METEOR_OPACITY_MIN + Math.random() * METEOR_OPACITY_RANGE;
        m.life = 0;
        m.maxLife = METEOR_LIFE_MIN + Math.random() * METEOR_LIFE_RANGE;
        m.active = true;
      }
    }

    // Deep-sea click burst — bubbles erupt from click point in an upward cone
    if (document.body.classList.contains('deep-sea')) {
      const burstCount = BUBBLE_CLICK_BURST_MIN + Math.floor(Math.random() * BUBBLE_CLICK_BURST_RANGE);
      for (let i = 0; i < burstCount; i++) {
        const b = bubbles.find(b => !b.active);
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
    }

    // Normal click burst particles
    const count = CLICK_COUNT_MIN + Math.floor(Math.random() * CLICK_COUNT_RANGE);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = CLICK_SPEED_MIN + Math.random() * CLICK_SPEED_RANGE;
      clickParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: CLICK_RADIUS_MIN + Math.random() * CLICK_RADIUS_RANGE,
        opacity: CLICK_OPACITY_MIN + Math.random() * CLICK_OPACITY_RANGE,
        life: 0,
        maxLife: CLICK_LIFE_MIN + Math.random() * CLICK_LIFE_RANGE,
        phase: Math.random() * Math.PI * 2,
        color: currentPal.clickColor,
      });
    }
  });

  // Drag trail — flowing wispy segments along the drag path
  const trailSegments = [];
  let isDragging = false;
  let lastTrail = { x: 0, y: 0 };
  let trailDist = 0;

  // Pointer events — unified mouse + touch + pen handling
  document.addEventListener('pointerdown', e => {
    isDragging = true;
    holdStart = performance.now();
    const cx = e.clientX, cy = canvasY(e.clientY);
    dragPos.x = cx;
    dragPos.y = cy;
    lastTrail = { x: cx, y: cy };
    trailDist = 0;
  });

  document.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const cx = e.clientX, cy = canvasY(e.clientY);
    dragPos.x = cx;
    dragPos.y = cy;
    const dx = cx - lastTrail.x;
    const dy = cy - lastTrail.y;
    trailDist += Math.sqrt(dx * dx + dy * dy);
    if (trailDist > TRAIL_SPACING) {
      trailSegments.push({
        x: cx,
        y: cy,
        prev: { x: lastTrail.x, y: lastTrail.y },
        width: TRAIL_WIDTH_MIN + Math.random() * TRAIL_WIDTH_RANGE,
        opacity: TRAIL_OPACITY_MIN + Math.random() * TRAIL_OPACITY_RANGE,
        life: 0,
        maxLife: TRAIL_LIFE_MIN + Math.random() * TRAIL_LIFE_RANGE,
        phase: Math.random() * Math.PI * 2,
      });
      // Drag spawns small bubbles in deep-sea mode
      if (document.body.classList.contains('deep-sea') && Math.random() < BUBBLE_DRAG_RATE) {
        const b = bubbles.find(b => !b.active);
        if (b) {
          b.reset(false);
          b.x = cx + (Math.random() - 0.5) * 10;
          b.y = cy + (Math.random() - 0.5) * 10;
          b.baseR = BUBBLE_RADIUS_MIN + Math.random() * 4; // small drag bubbles
          b.r = b.baseR;
          b.active = true;
        }
      }
      lastTrail = { x: cx, y: cy };
      trailDist = 0;
    }
  });

  function releaseDrag() {
    if (!isDragging) return;
    const heldSec = (performance.now() - holdStart) / 1000;
    const blast = Math.min(BLAST_BASE + heldSec * BLAST_PER_SEC, BLAST_MAX);

    // Repel all nearby motes
    clickImpulse.x = dragPos.x;
    clickImpulse.y = dragPos.y;
    clickImpulse.strength = blast;

    // Convert orbit particles into burst particles
    orbitParticles.forEach(p => {
      const dx = p.x - dragPos.x;
      const dy = p.y - dragPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = blast * (0.4 + Math.random() * 0.6);
      clickParticles.push({
        x: p.x, y: p.y,
        vx: (dx / dist) * speed + p.vx,
        vy: (dy / dist) * speed + p.vy,
        r: p.r,
        opacity: p.opacity + 0.1,
        life: 0,
        maxLife: EXTRA_BURST_LIFE_MIN + Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
        color: currentPal.clickColor,
      });
    });
    orbitParticles.length = 0;

    // Extra burst particles proportional to hold time
    const extraCount = Math.min(Math.floor(heldSec * EXTRA_BURST_PER_SEC), EXTRA_BURST_MAX);
    for (let i = 0; i < extraCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = blast * (0.3 + Math.random() * 0.7);
      clickParticles.push({
        x: dragPos.x, y: dragPos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: CLICK_RADIUS_MIN + Math.random() * 2.5,
        opacity: CLICK_OPACITY_MIN + Math.random() * CLICK_OPACITY_RANGE,
        life: 0,
        maxLife: EXTRA_BURST_LIFE_MIN + Math.random() * EXTRA_BURST_LIFE_RANGE,
        phase: Math.random() * Math.PI * 2,
        color: currentPal.clickColor,
      });
    }

    isDragging = false;
    holdStrength = 0;
  }

  document.addEventListener('pointerup', releaseDrag);

  // Touch fallback — after the browser takes over a touch for scrolling it fires
  // pointercancel and stops sending pointermove/pointerup.  Touch events still
  // fire though, so we use touchmove to keep tracking the finger and touchend
  // to release.  On desktop these never fire so there's no impact.
  document.addEventListener('touchmove', e => {
    if (!isDragging || !e.touches.length) return;
    dragPos.x = e.touches[0].clientX;
    dragPos.y = canvasY(e.touches[0].clientY);
  }, { passive: true });

  document.addEventListener('touchend', releaseDrag);

  render();
}
