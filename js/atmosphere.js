import { drawHaloParticle, scrollFade } from "./canvas-utils.js";
import { lerpColor } from "./colors.js";
import {
  applyAttraction,
  applyHoverDrift,
  applyWellForce,
  HOLD,
} from "./interactions.js";
import { scaled } from "./motion.js";
import { getQualityTier } from "./quality.js";
import {
  STREAK,
  CLOUD,
  WISP,
  MOTE,
  HORIZON,
  GUST,
  DUST,
  MOTE_IMP,
  MOTE_HOVER,
  WIND,
} from "./atmosphere.constants.js";

// ── Module-scoped canvas refs ──
let _canvas, _ctx;

// ── Wind ──
// Phase advances each draw frame; cos/sin of the phase produce the
// horizontal and vertical drift biases shared by all sky particles.
let _windPhase = 0;

// ── Horizon sunrise ──
// The default sky's horizon glow warms toward this as the viewport nears ground
// level, reading as a descent into sunrise. Themes keep their own horizon.
const HORIZON_SUNRISE = [255, 150, 80];

// Dim blue-white for the parallax depth-dust layer.
const DUST_COLOR = [200, 220, 255];

// ── Streak scroll parameters ──
// Bands map scroll progress (0 = top, 1 = bottom) to opacity/speed multipliers
// in ascending order. The last entry is the fall-through for scroll progress
// at or beyond its upperBound.
const STREAK_BANDS = [
  { upperBound: 0.2, opMul: 1.0, speedMul: 1.0 }, // settled near-space
  { upperBound: 0.5, opMul: 1.3, speedMul: 1.2 }, // descent energizes streaks
  { upperBound: 0.75, opMul: 0.8, speedMul: 1.5 }, // entering atmosphere — fade
  { upperBound: 1.0, opMul: 0.3, speedMul: 0.5 }, // ground level — almost gone
];
function getStreakParams(sp) {
  for (const band of STREAK_BANDS) {
    if (sp < band.upperBound) return band;
  }
  return STREAK_BANDS[STREAK_BANDS.length - 1];
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
  update(windX) {
    this.x += scaled(this.speedX + windX);
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
    // op is the same for every blob in this cloud — depends only on the
    // cloud's scale, scroll-fade, and stretch fade.  Compute once.
    const op =
      (CLOUD.OPACITY_BASE + CLOUD.OPACITY_DEPTH * this.scale) * vis * opFade;
    // Bucket op so small changes from frame to frame don't invalidate
    // the gradient cache; the visual difference between adjacent buckets
    // is below the threshold of perception against a sky gradient.
    const opBucket = Math.round(op * CLOUD.OP_BUCKET_RESOLUTION);
    // Snapshot the GRAD_* knobs once per cloud — they're tunable, so
    // each blob's cache key has to track them or live edits silently
    // no-op until palette swap or page reload.
    const gradInner = CLOUD.GRAD_INNER;
    const gradMid = CLOUD.GRAD_MID;
    const gradMidOp = CLOUD.GRAD_MID_OPACITY;
    this.blobs.forEach((b) => {
      const bx = this.x + b.ox;
      const by = y + b.oy;
      // Cache the gradient on the blob itself.  Invalidates on op
      // bucket change, palette swap, or any GRAD_* tune; otherwise the
      // same gradient reference is reused frame after frame.  Drawn at
      // origin under a translate so position changes don't invalidate.
      if (
        b._gradOpBucket !== opBucket ||
        b._gradCw !== cw ||
        b._gradCm !== cm ||
        b._gradInner !== gradInner ||
        b._gradMid !== gradMid ||
        b._gradMidOp !== gradMidOp
      ) {
        const grad = _ctx.createRadialGradient(
          0,
          0,
          b.r * gradInner,
          0,
          0,
          b.r,
        );
        grad.addColorStop(0, `rgba(${cw[0]},${cw[1]},${cw[2]},${op})`);
        grad.addColorStop(
          gradMid,
          `rgba(${cm[0]},${cm[1]},${cm[2]},${op * gradMidOp})`,
        );
        grad.addColorStop(1, "transparent");
        b._grad = grad;
        b._gradOpBucket = opBucket;
        b._gradCw = cw;
        b._gradCm = cm;
        b._gradInner = gradInner;
        b._gradMid = gradMid;
        b._gradMidOp = gradMidOp;
      }
      _ctx.save();
      _ctx.translate(bx, by);
      _ctx.fillStyle = b._grad;
      _ctx.beginPath();
      _ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.restore();
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
    this.y += scaled(this.speed * sp.speedMul);
    this.x += scaled(this.angle);
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
  update(windX, windY) {
    this.x += scaled(this.speed + windX);
    this.y += scaled(windY);
    this.phase += scaled(WISP.PHASE_SPEED);
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
  draw(pal, opts) {
    if (this.opacity < MOTE.DRAW_THRESHOLD) return;
    drawHaloParticle(
      _ctx,
      this.x,
      this.y,
      this.r * MOTE.GLOW_RADIUS,
      this.opacity,
      pal.moteColor,
      opts,
    );
  }
}

// A faint mid-depth mote that parallax-shifts with scroll and drifts slowly
// sideways. Flat dot (no gradient) — cheap enough to run a whole extra layer.
class DepthDust {
  constructor() {
    this.x = Math.random() * _canvas.width;
    this.baseY = Math.random() * _canvas.height;
    this.depth = DUST.DEPTH_MIN + Math.random() * DUST.DEPTH_RANGE;
    this.r = DUST.RADIUS_MIN + Math.random() * DUST.RADIUS_RANGE;
    this.opacity = DUST.OPACITY_MIN + Math.random() * DUST.OPACITY_RANGE;
    this.drift = (Math.random() - 0.5) * 2 * DUST.DRIFT;
  }
  update() {
    this.x += scaled(this.drift);
    const w = _canvas.width;
    if (this.x < 0) this.x += w;
    else if (this.x > w) this.x -= w;
  }
  draw(sp, vis) {
    const h = _canvas.height;
    const shift = this.depth * sp * h * DUST.PARALLAX;
    const y = (((this.baseY - shift) % h) + h) % h;
    _ctx.globalAlpha = this.opacity * vis;
    _ctx.beginPath();
    _ctx.arc(this.x, y, this.r, 0, Math.PI * 2);
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
  // High tier only — the depth-dust layer is the richness ceiling, not shed
  // work, so lower tiers simply never build it.
  const dust =
    getQualityTier() === "high"
      ? Array.from({ length: DUST.COUNT }, () => new DepthDust())
      : [];

  return {
    draw(sp, scrollVelocity, pal, forces, blocky, hasTheme) {
      // Advance wind phase and derive per-frame drift biases.  Wrapped to
      // [0, 2π] to avoid unbounded float growth.
      _windPhase = (_windPhase + scaled(WIND.PHASE_SPEED)) % (Math.PI * 2);
      const windX = Math.cos(_windPhase) * WIND.CLOUD_AMP;
      const wispWindX = Math.cos(_windPhase) * WIND.WISP_SPEED_MOD;
      const wispWindY = Math.sin(_windPhase) * WIND.WISP_Y_AMP;

      // Depth dust — a faint parallax layer that fades in across the
      // near-space→atmosphere transition. Drawn first so it sits behind the
      // clouds. Skipped entirely outside its scroll band (and on low tiers).
      if (dust.length) {
        const dustVis = scrollFade(
          sp,
          DUST.FADE_IN_START,
          DUST.FADE_IN_END,
          DUST.FADE_OUT_START,
          DUST.FADE_OUT_END,
        );
        if (dustVis > 0) {
          _ctx.save();
          _ctx.fillStyle = `rgb(${DUST_COLOR[0]},${DUST_COLOR[1]},${DUST_COLOR[2]})`;
          for (const d of dust) {
            d.update();
            d.draw(sp, dustVis);
          }
          _ctx.restore();
        }
      }

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
          c.update(windX);
          // Click gently pushes nearby clouds sideways
          if (forces.clickImpulse.strength > 0.1) {
            const cy = c.baseY + cloudYOffset;
            const dx = c.x - forces.clickImpulse.x;
            const dy = cy - forces.clickImpulse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CLOUD.PUSH_RADIUS && dist > 1) {
              c.x += scaled(
                (dx / dist) * forces.clickImpulse.strength * CLOUD.PUSH_FORCE,
              );
            }
          }
          // Drag gently pulls nearby clouds
          if (forces.isDragging) {
            const cy = c.baseY + cloudYOffset;
            const dx = forces.dragPos.x - c.x;
            const dy = forces.dragPos.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CLOUD.PULL_RADIUS && dist > 1) {
              c.x += scaled((dx / dist) * CLOUD.PULL_FORCE);
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
          w.update(wispWindX, wispWindY);
          w.draw(wispVis, pal, wispYOffset);
        });
      }

      // Horizon glow — shifts with descent (skipped in blocky theme)
      if (opts.horizon && !blocky) {
        const glowY = _canvas.height * (HORIZON.Y_BASE - sp * HORIZON.Y_SHIFT);
        const glowIntensity =
          HORIZON.INTENSITY_BASE +
          sp * HORIZON.INTENSITY_SCROLL -
          Math.max(0, sp - HORIZON.Y_BASE) * HORIZON.INTENSITY_FALLOFF;
        let hc = pal.horizonColor;
        // On the default (unthemed) sky, warm the horizon toward sunrise as the
        // viewport descends to ground level; active themes keep their horizon.
        if (!hasTheme && sp > HORIZON.WARM_START) {
          const t = (sp - HORIZON.WARM_START) / (1 - HORIZON.WARM_START);
          hc = lerpColor(hc, HORIZON_SUNRISE, t * HORIZON.WARM_STRENGTH);
        }
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
          `rgba(${Math.round(hc[0])},${Math.round(hc[1])},${Math.round(hc[2])},${glowIntensity})`,
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
          const leftMax = GUST.HORIZONTAL_BIAS / 2;
          const rightMax = GUST.HORIZONTAL_BIAS;
          const topMax = GUST.HORIZONTAL_BIAS + (1 - GUST.HORIZONTAL_BIAS) / 2;
          for (let i = 0; i < spawnCount; i++) {
            const g = gusts.find((g) => !g.active);
            if (!g) break;
            const side = Math.random();
            if (side < leftMax) {
              g.x = Math.random() * GUST.EDGE_BAND_HORIZONTAL;
              g.y = Math.random() * _canvas.height;
            } else if (side < rightMax) {
              g.x = _canvas.width - Math.random() * GUST.EDGE_BAND_HORIZONTAL;
              g.y = Math.random() * _canvas.height;
            } else if (side < topMax) {
              g.x = Math.random() * _canvas.width;
              g.y = Math.random() * GUST.EDGE_BAND_VERTICAL;
            } else {
              g.x = Math.random() * _canvas.width;
              g.y = _canvas.height - Math.random() * GUST.EDGE_BAND_VERTICAL;
            }
            const dir = scrollVelocity > 0 ? -Math.PI / 2 : Math.PI / 2;
            g.angle = dir + (Math.random() - 0.5) * GUST.ANGLE_JITTER;
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
          const op =
            g.opacity *
            (p < GUST.FADE_IN_FRAC
              ? p / GUST.FADE_IN_FRAC
              : (1 - p) / (1 - GUST.FADE_IN_FRAC));
          const progress = GUST.PROGRESS_START + p * (1 - GUST.PROGRESS_START);
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
        // One halo opts object shared across every mote this frame —
        // midColor is palette-derived so it must rebuild per frame, but
        // not per particle.
        const moteHaloOpts = {
          midStop: MOTE.GRAD_MID,
          midAlpha: MOTE.GRAD_MID_OPACITY,
          midColor: pal.moteGlow,
        };
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
              m.opacity = Math.min(
                MOTE_IMP.INTERACTION_OPACITY_MAX,
                m.opacity + f * MOTE_IMP.CLICK_OPACITY_GAIN,
              );
            }
          }
          if (forces.isDragging) {
            const beforeVx = m.vx;
            const beforeVy = m.vy;
            applyAttraction(
              forces,
              m,
              attractRadius,
              attractForce,
              HOLD.ATTRACT_TANGENT_FACTOR,
            );
            // Light up only when the helper actually pulled this mote.
            if (m.vx !== beforeVx || m.vy !== beforeVy) {
              m.opacity = Math.min(
                MOTE_IMP.INTERACTION_OPACITY_MAX,
                m.opacity +
                  MOTE_IMP.DRAG_OPACITY_GAIN +
                  forces.holdStrength * MOTE_IMP.DRAG_OPACITY_GAIN_HOLD,
              );
            }
          } else {
            applyHoverDrift(forces, m, MOTE_HOVER.RADIUS, MOTE_HOVER.STRENGTH);
          }
          applyWellForce(forces, m);
          m.draw(pal, moteHaloOpts);
        });
      }
    },
  };
}
