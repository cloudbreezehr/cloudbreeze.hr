import { lerpColor, multiLerp, toRgba, resolvePalette } from './colors.js';
import { bindPointer } from './pointer.js';
import { scrollFade } from './canvas-utils.js';
import { createSky } from './sky.js';
import { createFury } from './fury.js';
import {
  applyRepulsion, applyAttraction, applyWellForce,
  createInteractions, BLAST_BASE, IMPULSE_DECAY,
  ATTRACT_RADIUS_BASE, ATTRACT_RADIUS_HOLD,
  ATTRACT_FORCE_BASE, ATTRACT_FORCE_HOLD, ATTRACT_TANGENT_FACTOR,
} from './interactions.js';

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

// ── Impulse & Scroll ──
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
const SNOW_REPEL_DAMPEN = 0.8;
const SNOW_ATTRACT_RADIUS = 150;
const SNOW_ATTRACT_STRENGTH = 0.1;
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
const SUBMODES = ['deep-sea', 'frozen', 'blocky', 'upside-down'];

// ── Blocky Pixelation ──
const PIXEL_SCALE = 6;

// ── Fireflies (Blocky mode) ──
const FIREFLY_COUNT = 28;
const FIREFLY_RADIUS = 2;               // drawn at pixel-scale after pixelation
const FIREFLY_PULSE_MIN = 0.3;
const FIREFLY_PULSE_SPEED_MIN = 0.01;
const FIREFLY_PULSE_SPEED_RANGE = 0.02;
const FIREFLY_DRIFT = 0.3;              // random walk velocity per frame
const FIREFLY_FRICTION = 0.96;
const FIREFLY_OPACITY_MIN = 0.4;
const FIREFLY_OPACITY_RANGE = 0.4;
const FIREFLY_REPEL_RADIUS = 120;
const FIREFLY_REPEL_DAMPEN = 1.2;
const FIREFLY_ATTRACT_RADIUS = 180;
const FIREFLY_ATTRACT_STRENGTH = 0.15;
const FIREFLY_SCROLL_VX = 0.02;
const FIREFLY_SCROLL_THRESHOLD = 0.5;
const FIREFLY_COLOR = [255, 240, 100];
const FIREFLY_TRAIL_ALPHA = 0.3;

// ── Butterflies (Blocky light mode) ──
const BUTTERFLY_COLORS = [
  [255, 80, 80],    // red
  [80, 120, 255],   // blue
  [255, 220, 60],   // yellow
  [180, 80, 255],   // purple
];
const BUTTERFLY_FLAP_SPEED = 0.08;

// ── Block Fragments (Blocky click effect) ──
const BLOCK_FRAG_COUNT_MIN = 8;
const BLOCK_FRAG_COUNT_RANGE = 5;
const BLOCK_FRAG_SIZE = 3;              // pixel block size at display scale
const BLOCK_FRAG_SPEED_MIN = 2;
const BLOCK_FRAG_SPEED_RANGE = 4;
const BLOCK_FRAG_GRAVITY = 0.12;
const BLOCK_FRAG_LIFE = 48;             // ~800ms at 60fps
const BLOCK_FRAG_TUMBLE_INTERVAL = 9;   // frames between 90° rotations
const BLOCK_FRAG_MAX = 80;              // pool cap for block fragments

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
const BUBBLE_REPEL_DAMPEN = 0.8;
const BUBBLE_ATTRACT_RADIUS = 150;
const BUBBLE_ATTRACT_STRENGTH = 0.1;
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

class Firefly {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * (canvas ? canvas.width : 1920);
    this.y = init
      ? (canvas ? canvas.height : 1080) * (0.5 + Math.random() * 0.5)
      : (canvas ? canvas.height : 1080) * (0.6 + Math.random() * 0.4);
    this.vx = 0;
    this.vy = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.pulseSpeed = FIREFLY_PULSE_SPEED_MIN + Math.random() * FIREFLY_PULSE_SPEED_RANGE;
    this.opacity = FIREFLY_OPACITY_MIN + Math.random() * FIREFLY_OPACITY_RANGE;
    this.colorVariant = Math.random();  // 0-1: determines rare color variants
    this.prevX = this.x;
    this.prevY = this.y;
    // Butterfly state (light mode)
    this.flapPhase = Math.random() * Math.PI * 2;
    this.butterflyColor = BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)];
  }
  update() {
    this.prevX = this.x;
    this.prevY = this.y;
    this.phase += this.pulseSpeed;
    this.flapPhase += BUTTERFLY_FLAP_SPEED;
    // Random walk
    this.vx += (Math.random() - 0.5) * FIREFLY_DRIFT;
    this.vy += (Math.random() - 0.5) * FIREFLY_DRIFT;
    // Slight upward bias near bottom of canvas
    if (this.y > (canvas ? canvas.height * 0.7 : 700)) {
      this.vy -= 0.02;
    }
    this.vx *= FIREFLY_FRICTION;
    this.vy *= FIREFLY_FRICTION;
    this.x += this.vx;
    this.y += this.vy;
    // Wrap
    if (this.x < -20) this.x += canvas.width + 40;
    if (this.x > canvas.width + 20) this.x -= canvas.width + 40;
    if (this.y < canvas.height * 0.3) this.y = canvas.height * 0.3 + 10;
    if (this.y > canvas.height + 10) this.reset(false);
  }
  drawFirefly(targetCtx) {
    const pulse = FIREFLY_PULSE_MIN + (1 - FIREFLY_PULSE_MIN) * (0.5 + 0.5 * Math.sin(this.phase));
    const op = this.opacity * pulse;
    // Pick color: mostly warm yellow, rare green or orange
    let c = FIREFLY_COLOR;
    if (this.colorVariant > 0.92) c = [100, 255, 80];      // green
    else if (this.colorVariant > 0.85) c = [255, 180, 50];  // orange

    // Bright pixel core
    targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${op.toFixed(3)})`;
    targetCtx.fillRect(
      Math.round(this.x) - 1,
      Math.round(this.y) - 1,
      FIREFLY_RADIUS, FIREFLY_RADIUS
    );

    // Trail — dim pixel at previous position
    const trailOp = op * FIREFLY_TRAIL_ALPHA;
    if (trailOp > 0.02) {
      targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${trailOp.toFixed(3)})`;
      targetCtx.fillRect(
        Math.round(this.prevX) - 1,
        Math.round(this.prevY) - 1,
        FIREFLY_RADIUS, FIREFLY_RADIUS
      );
    }
  }
  drawButterfly(targetCtx) {
    const c = this.butterflyColor;
    const op = this.opacity * 0.8;
    const flap = Math.sin(this.flapPhase);
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    const s = 2; // wing pixel size

    targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${op.toFixed(3)})`;
    // Body
    targetCtx.fillRect(px, py, s, s);
    // Wings — spread depends on flap phase
    const wingSpread = Math.abs(flap);
    if (wingSpread > 0.3) {
      targetCtx.fillRect(px - s * 2, py - s, s * 2, s * 2); // left wing
      targetCtx.fillRect(px + s, py - s, s * 2, s * 2);     // right wing
    } else {
      targetCtx.fillRect(px - s, py, s, s);                  // folded left
      targetCtx.fillRect(px + s, py, s, s);                  // folded right
    }
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
    resizePixelCanvas();
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

  // Offscreen canvas for blocky pixelation post-process
  let pixelCanvas = null;
  let pixelCtx = null;

  function initPixelCanvas() {
    pixelCanvas = document.createElement('canvas');
    pixelCtx = pixelCanvas.getContext('2d');
  }
  function resizePixelCanvas() {
    if (!pixelCanvas) initPixelCanvas();
    pixelCanvas.width = Math.ceil(canvas.width / PIXEL_SCALE);
    pixelCanvas.height = Math.ceil(canvas.height / PIXEL_SCALE);
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
  const fireflies = Array.from({length: FIREFLY_COUNT}, () => new Firefly());
  let bubbleSpawnAccum = 0; // accumulates fractional bubble spawns
  const blockFragments = [];  // active block fragment particles

  // Interaction forces — click repels, drag attracts, hold charges
  const forces = {
    clickImpulse: { x: 0, y: 0, strength: 0 },
    isDragging: false,
    dragPos: { x: 0, y: 0 },
    holdStrength: 0,
    wellStrength: 0,
  };
  const interactions = createInteractions();

  const gusts = opts.gusts ? Array.from({length: opts.gustCount}, () => ({
    active: false, x: 0, y: 0, len: 0, angle: 0,
    opacity: 0, life: 0, maxLife: 0, width: 0
  })) : [];

  const sky = opts.stars ? createSky(opts.starCount) : null;

  let lastFrameTime = performance.now();
  function render() {
    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000; // seconds since last frame
    lastFrameTime = now;
    const sp = scrollProgress;
    const frozen = document.body.classList.contains('frozen');
    const deepSea = document.body.classList.contains('deep-sea');
    const upsd = document.body.classList.contains('upside-down');
    const blocky = document.body.classList.contains('blocky');
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

    // Stars and shooting stars
    if (sky) sky.draw(ctx, canvas, sp, pal);

    // Click fury — lightning, aurora, meteors
    fury.draw(ctx, canvas, pal, sp, dt, now);

    // Streaks — evolve with scroll
    if (opts.streaks) {
      const streakP = getStreakParams(sp);
      streaks.forEach(s => { s.update(streakP); s.draw(streakP, pal); });
    }

    // Cloud layer — clouds live at a fixed altitude, viewport scrolls past them
    if (opts.clouds) {
      const cloudYOffset = -(sp - CLOUD_Y_PIVOT) * canvas.height * CLOUD_Y_SCALE;
      const cloudVis = scrollFade(sp, CLOUD_FADE_IN_START, CLOUD_FADE_IN_END, CLOUD_FADE_OUT_START, CLOUD_FADE_OUT_END);
      clouds.forEach(c => {
        c.update();
        // Click gently pushes nearby clouds sideways
        if (forces.clickImpulse.strength > 0.1) {
          const cy = c.baseY + cloudYOffset;
          const dx = c.x - forces.clickImpulse.x;
          const dy = cy - forces.clickImpulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CLOUD_PUSH_RADIUS && dist > 1) {
            c.x += (dx / dist) * forces.clickImpulse.strength * CLOUD_PUSH_FORCE;
          }
        }
        // Drag gently pulls nearby clouds
        if (forces.isDragging) {
          const cy = c.baseY + cloudYOffset;
          const dx = forces.dragPos.x - c.x;
          const dy = forces.dragPos.y - cy;
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
      const wispVis = scrollFade(sp, WISP_FADE_IN_START, WISP_FADE_IN_END, WISP_FADE_OUT_START, WISP_FADE_OUT_END);
      wisps.forEach(w => { w.update(); w.draw(wispVis, pal, wispYOffset); });
    }

    // Horizon glow — shifts with descent (skipped in blocky mode)
    if (opts.horizon && !blocky) {
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

    // Hold strength + gravity well computation
    interactions.updateHold(forces, performance.now());
    const attractRadius = ATTRACT_RADIUS_BASE + forces.holdStrength * ATTRACT_RADIUS_HOLD;
    const attractForce = ATTRACT_FORCE_BASE + forces.holdStrength * ATTRACT_FORCE_HOLD;

    // Scroll-reactive particles — blown by scroll, settle with gravity
    // Also react to click (repel) and drag (attract, scaled by hold duration)
    if (opts.motes) {
      motes.forEach(m => {
        m.update(scrollVelocity);
        if (forces.clickImpulse.strength > 0.05) {
          const dx = m.x - forces.clickImpulse.x;
          const dy = m.y - forces.clickImpulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const repelR = IMPULSE_REPEL_RADIUS + forces.clickImpulse.strength * IMPULSE_REPEL_SCALE;
          if (dist < repelR && dist > 1) {
            const f = forces.clickImpulse.strength * (1 - dist / repelR);
            m.vx += (dx / dist) * f;
            m.vy += (dy / dist) * f;
            m.opacity = Math.min(0.5, m.opacity + f * IMPULSE_MOTE_OPACITY_GAIN);
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
            // Radial pull + tangential orbit (orbit grows with hold strength)
            m.vx += nx * f + (-ny) * f * forces.holdStrength * ATTRACT_TANGENT_FACTOR;
            m.vy += ny * f + nx * f * forces.holdStrength * ATTRACT_TANGENT_FACTOR;
            m.opacity = Math.min(0.5, m.opacity + 0.005 + forces.holdStrength * 0.01);
          }
        }
        applyWellForce(forces, m);
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
        applyRepulsion(forces, s, SNOW_REPEL_RADIUS, SNOW_REPEL_DAMPEN);
        applyAttraction(forces, s, SNOW_ATTRACT_RADIUS, SNOW_ATTRACT_STRENGTH, SNOW_ATTRACT_TANGENT);
        applyWellForce(forces, s);
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
        applyRepulsion(forces, b, BUBBLE_REPEL_RADIUS, BUBBLE_REPEL_DAMPEN);
        applyAttraction(forces, b, BUBBLE_ATTRACT_RADIUS, BUBBLE_ATTRACT_STRENGTH, BUBBLE_ATTRACT_TANGENT);
        applyWellForce(forces, b);
        // Scroll pushes laterally
        if (Math.abs(scrollVelocity) > BUBBLE_SCROLL_THRESHOLD) {
          b.vx += scrollVelocity * BUBBLE_SCROLL_VX;
        }
        b.draw();
      });

      jellyfish.forEach(j => {
        j.update();
        applyRepulsion(forces, j, JELLY_REPEL_RADIUS, JELLY_REPEL_DAMPEN);
        applyAttraction(forces, j, JELLY_ATTRACT_RADIUS, JELLY_ATTRACT_STRENGTH, 0);
        applyWellForce(forces, j);
        j.draw();
      });
    }

    interactions.decayImpulse(forces);
    interactions.draw(ctx, pal, forces);

    // ── Blocky mode: pixelation post-process + fireflies ──
    if (blocky) {
      // Pixelation post-process: downsample then scale back up
      const pw = pixelCanvas.width;
      const ph = pixelCanvas.height;
      pixelCtx.clearRect(0, 0, pw, ph);
      pixelCtx.drawImage(canvas, 0, 0, pw, ph);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pixelCanvas, 0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;

      // Block fragments — update and draw
      for (let i = blockFragments.length - 1; i >= 0; i--) {
        const f = blockFragments[i];
        f.life++;
        if (f.life > BLOCK_FRAG_LIFE) { blockFragments.splice(i, 1); continue; }
        f.x += f.vx;
        f.y += f.vy;
        f.vy += BLOCK_FRAG_GRAVITY;
        // Hard 90° tumble
        if (f.life % BLOCK_FRAG_TUMBLE_INTERVAL === 0) f.rot = (f.rot + 1) % 4;
        const c = f.color;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot * Math.PI / 2);
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(-BLOCK_FRAG_SIZE / 2, -BLOCK_FRAG_SIZE / 2, BLOCK_FRAG_SIZE, BLOCK_FRAG_SIZE);
        ctx.restore();
      }

      // Fireflies / Butterflies — rendered crisp post-pixelation
      fireflies.forEach(f => {
        f.update();
        applyRepulsion(forces, f, FIREFLY_REPEL_RADIUS, FIREFLY_REPEL_DAMPEN);
        applyAttraction(forces, f, FIREFLY_ATTRACT_RADIUS, FIREFLY_ATTRACT_STRENGTH, 0.3);
        applyWellForce(forces, f);
        if (Math.abs(scrollVelocity) > FIREFLY_SCROLL_THRESHOLD) {
          f.vx += scrollVelocity * FIREFLY_SCROLL_VX;
        }
        if (isDarkMode) {
          f.drawFirefly(ctx);
        } else {
          f.drawButterfly(ctx);
        }
      });
    }

    requestAnimationFrame(render);
  }

  const isUpside = () => document.body.classList.contains('upside-down');
  const isFrozen = () => document.body.classList.contains('frozen');
  let currentPal = resolvePalette(isDarkMode ? 'dark' : 'light', null);

  const fury = createFury();

  // In upside-down mode the page is flipped via scaleY(-1), so canvas Y must mirror
  const canvasY = y => isUpside() ? canvas.height - y : y;

  document.addEventListener('click', e => {
    const cx = e.clientX;
    const cy = canvasY(e.clientY);
    forces.clickImpulse.x = cx;
    forces.clickImpulse.y = cy;
    forces.clickImpulse.strength = BLAST_BASE;
    fury.click(cx, cy, canvas, scrollProgress);

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

    // Blocky click burst — block fragments instead of smooth particles
    if (document.body.classList.contains('blocky')) {
      const fragCount = BLOCK_FRAG_COUNT_MIN + Math.floor(Math.random() * BLOCK_FRAG_COUNT_RANGE);
      const skyColors = [[80, 120, 200], [100, 140, 220], [60, 100, 180]];
      for (let i = 0; i < fragCount && blockFragments.length < BLOCK_FRAG_MAX; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = BLOCK_FRAG_SPEED_MIN + Math.random() * BLOCK_FRAG_SPEED_RANGE;
        blockFragments.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          color: skyColors[Math.floor(Math.random() * skyColors.length)],
          life: 0, rot: 0,
        });
      }
    }

    // Normal click burst particles (skipped in blocky — block fragments replace them)
    if (!document.body.classList.contains('blocky')) {
      interactions.click(cx, cy, currentPal);
    }
  });

  // Pointer events — drag/trail/release delegated to interactions module
  bindPointer(document, {
    onDown(x, y) {
      const cx = x, cy = canvasY(y);
      interactions.startDrag(forces, cx, cy);
    },
    onMove(x, y) {
      const cx = x, cy = canvasY(y);
      const added = interactions.addTrail(forces, cx, cy);
      // Drag spawns small bubbles in deep-sea mode
      if (added && document.body.classList.contains('deep-sea') && Math.random() < BUBBLE_DRAG_RATE) {
        const b = bubbles.find(b => !b.active);
        if (b) {
          b.reset(false);
          b.x = cx + (Math.random() - 0.5) * 10;
          b.y = cy + (Math.random() - 0.5) * 10;
          b.baseR = BUBBLE_RADIUS_MIN + Math.random() * 4;
          b.r = b.baseR;
          b.active = true;
        }
      }
    },
    onUp() {
      interactions.releaseDrag(forces, currentPal);
    },
  });

  render();
}
