import { lerpColor, multiLerp, toRgba, palettes, warmShift } from './colors.js';

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
const STAR_COLOR = [180, 210, 255];
const STAR_COLOR_UPSIDE = warmShift(STAR_COLOR);
const STAR_FADE_START = 0.2;
const STAR_FADE_END = 0.5;
const STAR_TIME_STEP = 0.008;

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
const SHOOTING_COLORS = [[180, 210, 255], [200, 225, 255], [230, 240, 255]];
const SHOOTING_COLORS_UPSIDE = SHOOTING_COLORS.map(c => warmShift(c));

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
const STREAK_COLOR = [120, 190, 240];
const STREAK_COLOR_UPSIDE = warmShift(STREAK_COLOR);

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
const WISP_COLOR_DARK_UPSIDE = warmShift(palettes.dark.wispColor);
const WISP_COLOR_LIGHT_UPSIDE = warmShift(palettes.light.wispColor);
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
const MOTE_COLOR_DARK = [200, 230, 255];
const MOTE_COLOR_LIGHT = [80, 150, 220];
const MOTE_GLOW_DARK = [130, 195, 255];
const MOTE_GLOW_LIGHT = [55, 120, 200];
const MOTE_COLOR_UPSIDE_DARK = warmShift(MOTE_COLOR_DARK);
const MOTE_COLOR_UPSIDE_LIGHT = warmShift(MOTE_COLOR_LIGHT);
const MOTE_GLOW_UPSIDE_DARK = warmShift(MOTE_GLOW_DARK);
const MOTE_GLOW_UPSIDE_LIGHT = warmShift(MOTE_GLOW_LIGHT);

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
const GUST_COLOR_DARK = [180, 220, 255];
const GUST_COLOR_LIGHT = [80, 150, 220];
const GUST_COLOR_UPSIDE_DARK = warmShift(GUST_COLOR_DARK);
const GUST_COLOR_UPSIDE_LIGHT = warmShift(GUST_COLOR_LIGHT);

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
const CLICK_COLOR_DARK = [150, 210, 255];
const CLICK_COLOR_LIGHT = [55, 120, 200];
const CLICK_COLOR_UPSIDE_DARK = warmShift(CLICK_COLOR_DARK);
const CLICK_COLOR_UPSIDE_LIGHT = warmShift(CLICK_COLOR_LIGHT);

// ── Click Fury ──
const FURY_MAX = 60;
const FURY_PER_CLICK = 1;
const FURY_IDLE_GRACE = 0.4;
const FURY_DECAY_BASE = 4;
const FURY_DECAY_ACCEL = 32;

// ── Lightning (Tier 1) ──
const FURY_TIER1 = 25;
const LIGHTNING_MAX_BOLTS = 6;
const LIGHTNING_STEPS_MIN = 8;
const LIGHTNING_STEPS_RANGE = 6;
const LIGHTNING_JITTER_X = 80;
const LIGHTNING_JITTER_Y = 40;
const LIGHTNING_BRANCH_CHANCE = 0.3;
const LIGHTNING_BRANCH_ANGLE = 1.2;
const LIGHTNING_BRANCH_LEN_MIN = 30;
const LIGHTNING_BRANCH_LEN_RANGE = 50;
const LIGHTNING_LIFE_MIN = 12;
const LIGHTNING_LIFE_RANGE = 8;
const LIGHTNING_WIDTH_MAIN = 2;
const LIGHTNING_WIDTH_BRANCH = 1;
const LIGHTNING_SHADOW_BLUR = 12;
const LIGHTNING_FLASH_ALPHA = 0.06;
const LIGHTNING_COLOR = [200, 225, 255];
const LIGHTNING_SHADOW_COLOR = [180, 210, 255, 0.8];
const LIGHTNING_FLASH_COLOR = [200, 220, 255];
const LIGHTNING_COLOR_UPSIDE = warmShift(LIGHTNING_COLOR);
const LIGHTNING_SHADOW_UPSIDE = [...warmShift(LIGHTNING_SHADOW_COLOR.slice(0, 3)), LIGHTNING_SHADOW_COLOR[3]];
const LIGHTNING_FLASH_UPSIDE = warmShift(LIGHTNING_FLASH_COLOR);
const LIGHTNING_START_SPREAD = 200;
const LIGHTNING_START_Y = 0.2;
const LIGHTNING_OPACITY = 0.9;

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
const AURORA_HUE_BASE = 120;
const AURORA_HUE_RANGE = 80;
const AURORA_HUE_UPSIDE_BASE = 0;
const AURORA_HUE_UPSIDE_RANGE = 30;

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
const METEOR_COLORS = [[180, 210, 255], [200, 225, 255], [230, 240, 255]];
const METEOR_COLORS_UPSIDE = METEOR_COLORS.map(c => warmShift(c));

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
const ORBIT_COLOR_DARK = [180, 220, 255];
const ORBIT_COLOR_LIGHT = [55, 130, 210];
const ORBIT_COLOR_UPSIDE_DARK = warmShift(ORBIT_COLOR_DARK);
const ORBIT_COLOR_UPSIDE_LIGHT = warmShift(ORBIT_COLOR_LIGHT);

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
const TRAIL_COLOR_DARK = [180, 220, 255];
const TRAIL_COLOR_LIGHT = [55, 120, 200];
const TRAIL_COLOR_UPSIDE_DARK = warmShift(TRAIL_COLOR_DARK);
const TRAIL_COLOR_UPSIDE_LIGHT = warmShift(TRAIL_COLOR_LIGHT);

// ── Impulse & Scroll ──
const IMPULSE_DECAY = 0.88;
const IMPULSE_REPEL_RADIUS = 200;
const IMPULSE_REPEL_SCALE = 20;
const IMPULSE_MOTE_OPACITY_GAIN = 0.1;
const SCROLL_VEL_GAIN = 0.3;
const SCROLL_VEL_DECAY = 0.92;

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
  draw(sp, upside) {
    ctx.save();
    ctx.globalAlpha = this.opacity * sp.opMul;
    const col = upside ? STREAK_COLOR_UPSIDE : STREAK_COLOR;
    ctx.strokeStyle = `rgba(${col},1)`;
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
  draw(vis, color, yOffset) {
    if (vis <= 0) return;
    const wc = color || WISP_FALLBACK_COLOR;
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
  draw(dark, upside) {
    if (this.opacity < MOTE_DRAW_THRESHOLD) return;
    const c = dark
      ? (upside ? MOTE_COLOR_UPSIDE_DARK : MOTE_COLOR_DARK)
      : (upside ? MOTE_COLOR_UPSIDE_LIGHT : MOTE_COLOR_LIGHT);
    const g = dark
      ? (upside ? MOTE_GLOW_UPSIDE_DARK : MOTE_GLOW_DARK)
      : (upside ? MOTE_GLOW_UPSIDE_LIGHT : MOTE_GLOW_LIGHT);
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

  theme.onChange(dark => { isDarkMode = dark; });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function updateScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
    scrollVelocity += (scrollTop - lastScrollTop) * SCROLL_VEL_GAIN;
    lastScrollTop = scrollTop;
  }

  resize();
  updateScroll();
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateScroll, { passive: true });

  const clouds = opts.clouds ? Array.from({length: opts.cloudCount}, (_, i) => new Cloud(i, opts.cloudCount)) : [];
  const streaks = opts.streaks ? Array.from({length: opts.streakCount}, () => new Streak()) : [];
  const wisps = opts.wisps ? Array.from({length: opts.wispCount}, () => new BreezeWisp()) : [];
  const motes = opts.motes ? Array.from({length: opts.moteCount}, () => new ScrollMote()) : [];

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
    const pal = palettes[isDarkMode ? 'dark' : 'light'];
    const upsd = isUpside();
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
          const sc = upsd ? STAR_COLOR_UPSIDE : STAR_COLOR;
          ctx.fillStyle = `rgba(${sc},${op})`;
          ctx.beginPath();
          ctx.arc(s.x % canvas.width, py, s.r, 0, Math.PI * 2);
          ctx.fill();
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
        // Draw a tapered line with a bright head
        const tailX = ss.x - Math.cos(ss.angle) * ss.len * Math.min(1, p * 3);
        const tailY = ss.y - Math.sin(ss.angle) * ss.len * Math.min(1, p * 3);
        const shc = upsd ? SHOOTING_COLORS_UPSIDE : SHOOTING_COLORS;
        const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
        grad.addColorStop(0, `rgba(${shc[0]},0)`);
        grad.addColorStop(0.7, `rgba(${sc[1]},${op * 0.3})`);
        grad.addColorStop(1, `rgba(${sc[2]},${op})`);
        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = SHOOTING_LINE_WIDTH;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(ss.x, ss.y);
        ctx.stroke();
        ctx.restore();
      });
    }

    // Click fury — no decay while actively clicking, then ramps up fast once idle
    const idleSec = (now - lastClickTime) / 1000;
    if (idleSec >= FURY_IDLE_GRACE) {
      const decayRate = FURY_DECAY_BASE + (idleSec - FURY_IDLE_GRACE) * FURY_DECAY_ACCEL;
      clickFury = Math.max(0, clickFury - dt * decayRate);
    }

    // Tier 1: Lightning bolts
    let flashThisFrame = false;
    for (let i = lightningBolts.length - 1; i >= 0; i--) {
      const bolt = lightningBolts[i];
      bolt.life++;
      if (bolt.life > bolt.maxLife) { lightningBolts.splice(i, 1); continue; }
      if (bolt.life === 1) flashThisFrame = true;
      const fade = bolt.life < 2 ? 1 : Math.max(0, 1 - (bolt.life - 2) / (bolt.maxLife - 2));
      const col = upsd ? LIGHTNING_COLOR_UPSIDE : LIGHTNING_COLOR;
      const sc = upsd ? LIGHTNING_SHADOW_UPSIDE : LIGHTNING_SHADOW_COLOR;
      ctx.save();
      ctx.globalAlpha = fade * LIGHTNING_OPACITY;
      ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.lineWidth = bolt.width;
      ctx.lineCap = 'round';
      ctx.shadowColor = `rgba(${sc[0]},${sc[1]},${sc[2]},${sc[3]})`;
      ctx.shadowBlur = LIGHTNING_SHADOW_BLUR;
      // Batch all segments into one path — one stroke call with shadow
      ctx.beginPath();
      bolt.segments.forEach(s => {
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
      });
      ctx.stroke();
      ctx.restore();
    }
    if (flashThisFrame) {
      const fc = upsd ? LIGHTNING_FLASH_UPSIDE : LIGHTNING_FLASH_COLOR;
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
          hue: upsd ? AURORA_HUE_UPSIDE_BASE + Math.random() * AURORA_HUE_UPSIDE_RANGE : AURORA_HUE_BASE + Math.random() * AURORA_HUE_RANGE,
        });
      }
      auroraWaves.forEach(w => {
        w.phase += w.speed;
        // In upside-down, shift hues to red/orange
        if (upsd && w.hue > 60) w.hue = (w.hue - AURORA_HUE_BASE + 360) % 360;
        if (!upsd && w.hue < 60) w.hue = AURORA_HUE_BASE + Math.random() * AURORA_HUE_RANGE;
        ctx.save();
        ctx.globalAlpha = auroraIntensity * AURORA_ALPHA;
        const grad = ctx.createLinearGradient(0, w.y - w.width, 0, w.y + w.width);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, `hsla(${w.hue}, 80%, 60%, 0.6)`);
        grad.addColorStop(0.5, `hsla(${w.hue + 20}, 70%, 50%, 0.8)`);
        grad.addColorStop(0.7, `hsla(${w.hue + 40}, 80%, 60%, 0.6)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, w.y + Math.sin(w.phase) * w.amp);
        for (let x = 0; x <= canvas.width; x += 20) {
          const t = x / canvas.width;
          const yOff = Math.sin(w.phase + t * 6) * w.amp + Math.sin(w.phase * 1.3 + t * 3) * w.amp * 0.5;
          ctx.lineTo(x, w.y + yOff);
        }
        // Close the shape with a band
        for (let x = canvas.width; x >= 0; x -= 20) {
          const t = x / canvas.width;
          const yOff = Math.sin(w.phase + t * 6) * w.amp * 0.6 + Math.sin(w.phase * 1.3 + t * 3) * w.amp * 0.3;
          ctx.lineTo(x, w.y + yOff + w.width * 0.4);
        }
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
      const mc = upsd ? METEOR_COLORS_UPSIDE : METEOR_COLORS;
      const grad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
      grad.addColorStop(0, `rgba(${mc[0]},0)`);
      grad.addColorStop(0.7, `rgba(${mc[1]},${op * 0.3})`);
      grad.addColorStop(1, `rgba(${mc[2]},${op})`);
      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = METEOR_LINE_WIDTH;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.restore();
    });

    // Streaks — evolve with scroll
    if (opts.streaks) {
      const streakP = getStreakParams(sp);
      streaks.forEach(s => { s.update(streakP); s.draw(streakP, upsd); });
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
      const wispCol = upsd ? (isDarkMode ? WISP_COLOR_DARK_UPSIDE : WISP_COLOR_LIGHT_UPSIDE) : pal.wispColor;
      wisps.forEach(w => { w.update(); w.draw(wispVis, wispCol, wispYOffset); });
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
      const gc = isDarkMode
        ? (upsd ? GUST_COLOR_UPSIDE_DARK : GUST_COLOR_DARK)
        : (upsd ? GUST_COLOR_UPSIDE_LIGHT : GUST_COLOR_LIGHT);
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
        m.draw(isDarkMode, upsd);
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
      const c = isDarkMode ? p.color : p.colorLight;
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
    const oc = isDarkMode
      ? (upsd ? ORBIT_COLOR_UPSIDE_DARK : ORBIT_COLOR_DARK)
      : (upsd ? ORBIT_COLOR_UPSIDE_LIGHT : ORBIT_COLOR_LIGHT);
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
      const c = isDarkMode
        ? (upsd ? TRAIL_COLOR_UPSIDE_DARK : TRAIL_COLOR_DARK)
        : (upsd ? TRAIL_COLOR_UPSIDE_LIGHT : TRAIL_COLOR_LIGHT);
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
    const segments = [];
    const steps = LIGHTNING_STEPS_MIN + Math.floor(Math.random() * LIGHTNING_STEPS_RANGE);
    let cx = x1, cy = y1;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const nx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * LIGHTNING_JITTER_X * (1 - t);
      const ny = y1 + (y2 - y1) * t + (Math.random() - 0.5) * LIGHTNING_JITTER_Y;
      segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
      // Random branch
      if (depth < 2 && Math.random() < LIGHTNING_BRANCH_CHANCE) {
        const bAngle = Math.atan2(ny - cy, nx - cx) + (Math.random() - 0.5) * LIGHTNING_BRANCH_ANGLE;
        const bLen = LIGHTNING_BRANCH_LEN_MIN + Math.random() * LIGHTNING_BRANCH_LEN_RANGE;
        spawnLightning(cx, cy, cx + Math.cos(bAngle) * bLen, cy + Math.sin(bAngle) * bLen, depth + 1);
      }
      cx = nx; cy = ny;
    }
    lightningBolts.push({ segments, life: 0, maxLife: LIGHTNING_LIFE_MIN + Math.random() * LIGHTNING_LIFE_RANGE, width: depth === 0 ? LIGHTNING_WIDTH_MAIN : LIGHTNING_WIDTH_BRANCH });
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

    const upside = isUpside();

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
        color: upside ? CLICK_COLOR_UPSIDE_DARK : CLICK_COLOR_DARK,
        colorLight: upside ? CLICK_COLOR_UPSIDE_LIGHT : CLICK_COLOR_LIGHT,
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
      lastTrail = { x: cx, y: cy };
      trailDist = 0;
    }
  });

  document.addEventListener('pointerup', () => {
    if (!isDragging) return;
    const heldSec = (performance.now() - holdStart) / 1000;
    const blast = Math.min(BLAST_BASE + heldSec * BLAST_PER_SEC, BLAST_MAX);
    const upside = isUpside();

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
        color: upside ? CLICK_COLOR_UPSIDE_DARK : CLICK_COLOR_DARK,
        colorLight: upside ? CLICK_COLOR_UPSIDE_LIGHT : CLICK_COLOR_LIGHT,
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
        color: upside ? CLICK_COLOR_UPSIDE_DARK : CLICK_COLOR_DARK,
        colorLight: upside ? CLICK_COLOR_UPSIDE_LIGHT : CLICK_COLOR_LIGHT,
      });
    }

    isDragging = false;
    holdStrength = 0;
  });

  render();
}
