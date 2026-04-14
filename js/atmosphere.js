import { scrollFade } from './canvas-utils.js';
import { applyWellForce, ATTRACT_RADIUS_BASE, ATTRACT_RADIUS_HOLD, ATTRACT_FORCE_BASE, ATTRACT_FORCE_HOLD, ATTRACT_TANGENT_FACTOR } from './interactions.js';

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

// ── Mote Impulse ──
const IMPULSE_REPEL_RADIUS = 200;
const IMPULSE_REPEL_SCALE = 20;
const IMPULSE_MOTE_OPACITY_GAIN = 0.1;

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
    this.x = Math.random() * _canvas.width * CLOUD_X_SPREAD - _canvas.width * CLOUD_X_OFFSET;
    this.baseY = (i / total) * _canvas.height * CLOUD_Y_DEPTH - _canvas.height * CLOUD_Y_OFFSET;
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
    if (this.x < -m) this.x += _canvas.width + m * 2;
    if (this.x > _canvas.width + m) this.x -= _canvas.width + m * 2;
  }
  draw(yOffset, vis, pal) {
    if (vis <= 0) return;
    const y = this.baseY + yOffset;
    if (y < -CLOUD_CULL_MARGIN || y > _canvas.height + CLOUD_CULL_MARGIN) return;
    const cw = pal.cloudWhite;
    const cm = pal.cloudMid;
    this.blobs.forEach(b => {
      const bx = this.x + b.ox;
      const by = y + b.oy;
      const op = (CLOUD_OPACITY_BASE + CLOUD_OPACITY_DEPTH * this.scale) * vis;
      const grad = _ctx.createRadialGradient(bx, by, b.r * CLOUD_GRAD_INNER, bx, by, b.r);
      grad.addColorStop(0, `rgba(${cw[0]},${cw[1]},${cw[2]},${op})`);
      grad.addColorStop(CLOUD_GRAD_MID, `rgba(${cm[0]},${cm[1]},${cm[2]},${op * CLOUD_GRAD_MID_OPACITY})`);
      grad.addColorStop(1, 'transparent');
      _ctx.fillStyle = grad;
      _ctx.beginPath();
      _ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      _ctx.fill();
    });
  }
}

class Streak {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * _canvas.width;
    this.y = init ? Math.random() * _canvas.height : -10;
    this.len = STREAK_LEN_MIN + Math.random() * STREAK_LEN_RANGE;
    this.speed = STREAK_SPEED_MIN + Math.random() * STREAK_SPEED_RANGE;
    this.opacity = STREAK_OPACITY_MIN + Math.random() * STREAK_OPACITY_RANGE;
    this.width = STREAK_WIDTH_MIN + Math.random() * STREAK_WIDTH_RANGE;
    this.angle = STREAK_ANGLE_MIN + Math.random() * STREAK_ANGLE_RANGE;
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
  constructor() { this.reset(true); }
  reset(init) {
    this.x = init ? Math.random() * _canvas.width : -300;
    this.y = Math.random() * _canvas.height;
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
    if (this.x > _canvas.width + this.len) this.reset(false);
  }
  draw(vis, pal, yOffset) {
    if (vis <= 0) return;
    const wc = pal ? pal.wispColor : WISP_FALLBACK_COLOR;
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
    if (this.y < -MOTE_BOUNDS || this.y > _canvas.height + MOTE_BOUNDS ||
        this.x < -MOTE_BOUNDS || this.x > _canvas.width + MOTE_BOUNDS) {
      this.x = Math.random() * _canvas.width;
      this.y = Math.random() * _canvas.height;
      this.vx = 0;
      this.vy = 0;
    }
  }
  draw(pal) {
    if (this.opacity < MOTE_DRAW_THRESHOLD) return;
    const c = pal.moteColor;
    const g = pal.moteGlow;
    const grad = _ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * MOTE_GLOW_RADIUS);
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${this.opacity})`);
    grad.addColorStop(MOTE_GRAD_MID, `rgba(${g[0]},${g[1]},${g[2]},${this.opacity * MOTE_GRAD_MID_OPACITY})`);
    grad.addColorStop(1, 'transparent');
    _ctx.fillStyle = grad;
    _ctx.beginPath();
    _ctx.arc(this.x, this.y, this.r * MOTE_GLOW_RADIUS, 0, Math.PI * 2);
    _ctx.fill();
  }
}

// ── Factory ──

export function createAtmosphere(canvasEl, ctxEl, opts) {
  _canvas = canvasEl;
  _ctx = ctxEl;

  const clouds = opts.clouds ? Array.from({length: opts.cloudCount}, (_, i) => new Cloud(i, opts.cloudCount)) : [];
  const streaks = opts.streaks ? Array.from({length: opts.streakCount}, () => new Streak()) : [];
  const wisps = opts.wisps ? Array.from({length: opts.wispCount}, () => new BreezeWisp()) : [];
  const motes = opts.motes ? Array.from({length: opts.moteCount}, () => new ScrollMote()) : [];
  const gusts = opts.gusts ? Array.from({length: opts.gustCount}, () => ({
    active: false, x: 0, y: 0, len: 0, angle: 0,
    opacity: 0, life: 0, maxLife: 0, width: 0,
  })) : [];

  return {
    draw(sp, scrollVelocity, pal, forces, blocky) {
      // Streaks — evolve with scroll
      if (opts.streaks) {
        const streakP = getStreakParams(sp);
        streaks.forEach(s => { s.update(streakP); s.draw(streakP, pal); });
      }

      // Cloud layer — clouds live at a fixed altitude, viewport scrolls past them
      if (opts.clouds) {
        const cloudYOffset = -(sp - CLOUD_Y_PIVOT) * _canvas.height * CLOUD_Y_SCALE;
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
        const wispYOffset = -(sp - WISP_Y_PIVOT) * _canvas.height * WISP_Y_SCALE;
        const wispVis = scrollFade(sp, WISP_FADE_IN_START, WISP_FADE_IN_END, WISP_FADE_OUT_START, WISP_FADE_OUT_END);
        wisps.forEach(w => { w.update(); w.draw(wispVis, pal, wispYOffset); });
      }

      // Horizon glow — shifts with descent (skipped in blocky mode)
      if (opts.horizon && !blocky) {
        const glowY = _canvas.height * (HORIZON_Y_BASE - sp * HORIZON_Y_SHIFT);
        const glowIntensity = HORIZON_INTENSITY_BASE + sp * HORIZON_INTENSITY_SCROLL - Math.max(0, sp - HORIZON_Y_BASE) * HORIZON_INTENSITY_FALLOFF;
        const hc = pal.horizonColor;
        const hg = _ctx.createRadialGradient(_canvas.width / 2, glowY, 0, _canvas.width / 2, glowY, _canvas.width * (HORIZON_RADIUS_BASE + sp * HORIZON_RADIUS_SCROLL));
        hg.addColorStop(0, `rgba(${hc[0]},${hc[1]},${hc[2]},${glowIntensity.toFixed(3)})`);
        hg.addColorStop(1, 'transparent');
        _ctx.fillStyle = hg;
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
      }

      // Edge breeze — wind lines from screen edges during scroll
      if (opts.gusts) {
        const absSv = Math.abs(scrollVelocity);
        if (absSv > GUST_SCROLL_THRESHOLD) {
          const spawnCount = Math.min(GUST_SPAWN_MAX, Math.floor(absSv / GUST_SPAWN_DIVISOR));
          for (let i = 0; i < spawnCount; i++) {
            const g = gusts.find(g => !g.active);
            if (!g) break;
            const side = Math.random();
            if (side < 0.35) { g.x = Math.random() * 50; g.y = Math.random() * _canvas.height; }
            else if (side < 0.7) { g.x = _canvas.width - Math.random() * 50; g.y = Math.random() * _canvas.height; }
            else if (side < 0.85) { g.x = Math.random() * _canvas.width; g.y = Math.random() * 30; }
            else { g.x = Math.random() * _canvas.width; g.y = _canvas.height - Math.random() * 30; }
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
          _ctx.save();
          _ctx.globalAlpha = op;
          _ctx.strokeStyle = `rgba(${gc},1)`;
          _ctx.lineWidth = g.width;
          _ctx.beginPath();
          _ctx.moveTo(g.x, g.y);
          _ctx.lineTo(g.x + Math.cos(g.angle) * g.len * progress,
                     g.y + Math.sin(g.angle) * g.len * progress);
          _ctx.stroke();
          _ctx.restore();
        });
      }

      // Scroll-reactive particles — blown by scroll, settle with gravity
      if (opts.motes) {
        const attractRadius = ATTRACT_RADIUS_BASE + forces.holdStrength * ATTRACT_RADIUS_HOLD;
        const attractForce = ATTRACT_FORCE_BASE + forces.holdStrength * ATTRACT_FORCE_HOLD;
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
              m.vx += nx * f + (-ny) * f * forces.holdStrength * ATTRACT_TANGENT_FACTOR;
              m.vy += ny * f + nx * f * forces.holdStrength * ATTRACT_TANGENT_FACTOR;
              m.opacity = Math.min(0.5, m.opacity + 0.005 + forces.holdStrength * 0.01);
            }
          }
          applyWellForce(forces, m);
          m.draw(pal);
        });
      }
    },
  };
}
