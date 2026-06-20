import { Z_RAIN_GLASS } from "../layers.js";
import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { spawnBolt, renderBolt } from "../fury.js";
import { drawHaloParticle } from "../canvas-utils.js";
import { scaled, step, prefersReducedMotion } from "../motion.js";
import { RAIN, WIND, SPLASH, GLASS, THUNDER, EMBER } from "./rain.constants.js";

// ── Layer config lookup ──
const LAYER_CONFIGS = [
  () => ({
    lenMin: RAIN.FAR_LEN_MIN,
    lenRange: RAIN.FAR_LEN_RANGE,
    width: RAIN.FAR_WIDTH,
    speedMin: RAIN.FAR_SPEED_MIN,
    speedRange: RAIN.FAR_SPEED_RANGE,
    opacityMin: RAIN.FAR_OPACITY_MIN,
    opacityRange: RAIN.FAR_OPACITY_RANGE,
    windScale: WIND.FAR_SCALE,
  }),
  () => ({
    lenMin: RAIN.MID_LEN_MIN,
    lenRange: RAIN.MID_LEN_RANGE,
    width: RAIN.MID_WIDTH,
    speedMin: RAIN.MID_SPEED_MIN,
    speedRange: RAIN.MID_SPEED_RANGE,
    opacityMin: RAIN.MID_OPACITY_MIN,
    opacityRange: RAIN.MID_OPACITY_RANGE,
    windScale: WIND.MID_SCALE,
  }),
  () => ({
    lenMin: RAIN.NEAR_LEN_MIN,
    lenRange: RAIN.NEAR_LEN_RANGE,
    width: RAIN.NEAR_WIDTH,
    speedMin: RAIN.NEAR_SPEED_MIN,
    speedRange: RAIN.NEAR_SPEED_RANGE,
    opacityMin: RAIN.NEAR_OPACITY_MIN,
    opacityRange: RAIN.NEAR_OPACITY_RANGE,
    windScale: WIND.NEAR_SCALE,
  }),
];

// ── Raindrop ──

class Raindrop {
  constructor(canvas, layer) {
    this.canvas = canvas;
    this.layer = layer;
    this.reset(true);
  }

  reset(init) {
    const cfg = LAYER_CONFIGS[this.layer]();
    this.x = Math.random() * this.canvas.width;
    // Stagger initial positions; subsequent resets start above viewport
    this.y = init
      ? Math.random() * this.canvas.height
      : -(Math.random() * this.canvas.height * RAIN.STAGGER_Y_FRAC);
    this.len = cfg.lenMin + Math.random() * cfg.lenRange;
    this.fallSpeed = cfg.speedMin + Math.random() * cfg.speedRange;
    this.opacity = cfg.opacityMin + Math.random() * cfg.opacityRange;
    this.windPhase = Math.random() * Math.PI * 2;
    this.vx = 0;
    this.vy = 0;
  }

  update(windOffset, speedBoost) {
    const cfg = LAYER_CONFIGS[this.layer]();
    this.x += scaled(windOffset * cfg.windScale + this.vx);
    this.y += scaled(this.fallSpeed * (1 + speedBoost) + this.vy);
    // High friction so forces cause brief deflections, not sustained drift
    this.vx *= RAIN.FRICTION;
    this.vy *= RAIN.FRICTION;
  }
}

// ── Splash particle ──

class SplashParticle {
  constructor() {
    this.active = false;
  }

  spawn(x, y, angle, speed) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 0;
    this.active = true;
  }

  update() {
    if (!this.active) return;
    this.life++;
    if (this.life > SPLASH.LIFE) {
      this.active = false;
      return;
    }
    this.x += scaled(this.vx);
    this.y += scaled(this.vy);
    this.vy += scaled(SPLASH.GRAVITY);
  }
}

// ── Strike ember ──
// Ballistic spark scattered from a lightning strike's endpoint.  Pure
// vx/vy with friction — exactly the shape `step()` from motion.js
// integrates, so the per-frame update is one call.  No gravity: embers
// ride the heat plume upward (UPWARD_BIAS biases vy negative on spawn)
// and friction kills them.

export class Ember {
  constructor() {
    this.active = false;
  }
  spawn(x, y) {
    this.x = x;
    this.y = y;
    // Radial scatter — full 2π, then add an upward bias so the cloud
    // tends to rise even though individual sparks fly any direction.
    const angle = Math.random() * Math.PI * 2;
    const speed = EMBER.SPEED_MIN + Math.random() * EMBER.SPEED_RANGE;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - speed * EMBER.UPWARD_BIAS;
    this.life = 0;
    this.maxLife = EMBER.LIFE_MIN + Math.random() * EMBER.LIFE_RANGE;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.life++;
    if (this.life > this.maxLife) {
      this.active = false;
      return;
    }
    step(this, 1, EMBER.FRICTION);
  }
  draw(ctx) {
    if (!this.active) return;
    const t = this.life / this.maxLife;
    // Hold at peak alpha for the first FADE_HOLD fraction, then fade
    // linearly to zero — keeps embers bright long enough to register
    // visually on high-refresh displays where frame-counted life is fast.
    const alpha =
      t < EMBER.FADE_HOLD
        ? EMBER.ALPHA_PEAK
        : EMBER.ALPHA_PEAK *
          (1 - (t - EMBER.FADE_HOLD) / (1 - EMBER.FADE_HOLD));
    // Outer warm halo
    drawHaloParticle(
      ctx,
      this.x,
      this.y,
      EMBER.RADIUS * EMBER.GLOW_RADIUS,
      alpha,
      EMBER.COLOR,
    );
    // Hot inner core — small bright dot inside the halo so the ember
    // reads as a point of light against busy rain texture.
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${EMBER.COLOR_HOT[0]},${EMBER.COLOR_HOT[1]},${EMBER.COLOR_HOT[2]})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, EMBER.RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Glass drop (canvas overlay) ──

class GlassDrop {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.size = 0;
    this.speed = 0;
    this.active = false;
    this.sliding = false;
    this.idleTimer = 0;
    this.wobblePhase = 0;
    this.wobbleAmp = 0;
    this.wobbleFreq = 0;
    this.trail = []; // position history: [{x, y}]
    this.opacity = 0;
    this.fadeIn = true;
  }

  spawn(x, y) {
    this.x = x;
    this.y = y;
    this.size = GLASS.SIZE_MIN + Math.random() * GLASS.SIZE_RANGE;
    this.speed =
      GLASS.SLIDE_SPEED_MIN + Math.random() * GLASS.SLIDE_SPEED_RANGE;
    this.active = true;
    this.sliding = false;
    this.idleTimer = GLASS.IDLE_MIN + Math.random() * GLASS.IDLE_RANGE;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.wobbleAmp =
      GLASS.WOBBLE_AMP_MIN + Math.random() * GLASS.WOBBLE_AMP_RANGE;
    this.wobbleFreq =
      GLASS.WOBBLE_FREQ_MIN + Math.random() * GLASS.WOBBLE_FREQ_RANGE;
    this.trail = [{ x, y }];
    this.opacity = 0;
    this.fadeIn = true;
  }

  update(dt, scrollVel) {
    if (!this.active) return;

    // Fade in
    if (this.fadeIn) {
      this.opacity = Math.min(1, this.opacity + dt / GLASS.FADE_IN_MS);
      if (this.opacity >= 1) this.fadeIn = false;
    }

    if (!this.sliding) {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) this.sliding = true;
      return;
    }

    // Gravity accelerates the drop; scroll tilts the glass
    this.speed = Math.min(GLASS.SPEED_MAX, this.speed + GLASS.ACCEL * dt);
    const scrollPush = scrollVel * GLASS.SCROLL_FACTOR;
    const frameSpeed = Math.max(0, this.speed + scrollPush);

    // Wobble — organic lateral drift like real glass imperfections
    this.wobblePhase += scaled(this.wobbleFreq * dt);
    const wobble = Math.sin(this.wobblePhase) * this.wobbleAmp;

    this.y += scaled(frameSpeed);
    this.x += scaled(wobble);

    // Record position; cap history length
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > GLASS.TRAIL_POINTS) this.trail.shift();

    if (this.y > window.innerHeight + 20) {
      this.active = false;
    }
  }

  draw(ctx, pal) {
    if (!this.active || this.opacity <= 0) return;
    const a = this.opacity;
    const len = this.trail.length;
    const body = pal.glassBody;
    const rim = pal.glassRim;
    const spec = pal.glassSpecular;

    // ── Trail — filled polygon following position history ──
    // Left edge oldest→newest, right edge newest→oldest, single fill
    if (len > 2 && this.sliding) {
      ctx.beginPath();
      const maxHalf = this.size * GLASS.TRAIL_WIDTH_FRAC;
      // Left edge
      for (let i = 0; i < len; i++) {
        const t = i / (len - 1); // 0=oldest, 1=newest
        const hw = maxHalf * t * t; // quadratic taper: thin→thick
        const p = this.trail[i];
        if (i === 0) ctx.moveTo(p.x - hw, p.y);
        else ctx.lineTo(p.x - hw, p.y);
      }
      // Right edge (reversed)
      for (let i = len - 1; i >= 0; i--) {
        const t = i / (len - 1);
        const hw = maxHalf * t * t;
        ctx.lineTo(this.trail[i].x + hw, this.trail[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${body[0]},${body[1]},${body[2]},${a * GLASS.TRAIL_TIP_ALPHA})`;
      ctx.fill();
    }

    // ── Drop body — filled circle with subtle gradient look ──
    const r = this.size / 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${body[0]},${body[1]},${body[2]},${a * GLASS.TRAIL_BODY_ALPHA})`;
    ctx.fill();

    // Specular highlight — offset circle
    ctx.beginPath();
    ctx.arc(
      this.x - r * GLASS.SPECULAR_OFFSET_FRAC,
      this.y - r * GLASS.SPECULAR_OFFSET_FRAC,
      r * GLASS.SPECULAR_SIZE_FRAC,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = `rgba(${spec[0]},${spec[1]},${spec[2]},${a * GLASS.SPECULAR_ALPHA})`;
    ctx.fill();

    // Rim outline
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rim[0]},${rim[1]},${rim[2]},${a * GLASS.RIM_ALPHA})`;
    ctx.lineWidth = GLASS.RIM_WIDTH;
    ctx.stroke();
  }

  remove() {
    this.active = false;
  }
}

// ── Factory ──

export function createRain(canvasEl, ctxEl) {
  const canvas = canvasEl;
  const ctx = ctxEl;

  // Overlay canvas for glass drops — sits on top of page content
  const glassCanvas = document.createElement("canvas");
  glassCanvas.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:${Z_RAIN_GLASS}`;
  glassCanvas.width = window.innerWidth;
  glassCanvas.height = window.innerHeight;
  document.body.appendChild(glassCanvas);
  const glassCtx = glassCanvas.getContext("2d");

  window.addEventListener("resize", () => {
    glassCanvas.width = window.innerWidth;
    glassCanvas.height = window.innerHeight;
  });

  // Rain pools — one per layer (0=far, 1=mid, 2=near)
  const layers = [
    Array.from({ length: RAIN.FAR_COUNT }, () => new Raindrop(canvas, 0)),
    Array.from({ length: RAIN.MID_COUNT }, () => new Raindrop(canvas, 1)),
    Array.from({ length: RAIN.NEAR_COUNT }, () => new Raindrop(canvas, 2)),
  ];

  // Splash pool
  const splashes = Array.from(
    { length: SPLASH.MAX },
    () => new SplashParticle(),
  );

  // Glass drop pool
  const glassDrops = Array.from({ length: GLASS.MAX }, () => new GlassDrop());
  let glassSpawnAccum = 0;

  // Ember pool — embers from lightning strike endpoints
  const embers = Array.from({ length: EMBER.POOL }, () => new Ember());

  // Wind state
  let nextGustTime =
    performance.now() +
    WIND.GUST_INTERVAL_MIN +
    Math.random() * WIND.GUST_INTERVAL_RANGE;
  let gustStart = 0;
  let isGusting = false;

  // Ambient thunder state
  const ambientBolts = [];
  let nextStrikeTime =
    performance.now() +
    THUNDER.INTERVAL_MIN +
    Math.random() * THUNDER.INTERVAL_RANGE;
  let thunderBoostEnd = 0;
  let rumbleEnd = 0;

  // Page element for rumble shake
  const pageEl = document.querySelector(".page");

  function getWindOffset(now) {
    const base = Math.sin(now * WIND.BASE_FREQ) * WIND.BASE_AMP;
    let gustMul = 1;
    if (isGusting) {
      const elapsed = now - gustStart;
      if (elapsed > WIND.GUST_DURATION) {
        isGusting = false;
        nextGustTime =
          now +
          WIND.GUST_INTERVAL_MIN +
          Math.random() * WIND.GUST_INTERVAL_RANGE;
      } else {
        // Sine-eased gust envelope
        const t = elapsed / WIND.GUST_DURATION;
        gustMul = 1 + Math.sin(t * Math.PI) * (WIND.GUST_STRENGTH - 1);
      }
    } else if (now >= nextGustTime) {
      isGusting = true;
      gustStart = now;
    }
    return base * gustMul;
  }

  function spawnGroundSplash(x, y) {
    const count =
      SPLASH.GROUND_COUNT_MIN +
      Math.floor(Math.random() * SPLASH.GROUND_COUNT_RANGE);
    for (let i = 0; i < count; i++) {
      const s = splashes.find((s) => !s.active);
      if (!s) break;
      const angle =
        -Math.PI *
        (SPLASH.GROUND_ANGLE_START + Math.random() * SPLASH.GROUND_ANGLE_RANGE);
      const speed = SPLASH.SPEED_MIN + Math.random() * SPLASH.SPEED_RANGE;
      s.spawn(x, y, angle, speed);
    }
  }

  function spawnGlassDrop(x, y) {
    const g = glassDrops.find((g) => !g.active);
    if (g) g.spawn(x, y);
  }

  function checkGlassMerge() {
    for (let i = 0; i < glassDrops.length; i++) {
      const a = glassDrops[i];
      if (!a.active || !a.sliding) continue;
      for (let j = i + 1; j < glassDrops.length; j++) {
        const b = glassDrops[j];
        if (!b.active) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (dx * dx + dy * dy < GLASS.MERGE_DIST * GLASS.MERGE_DIST) {
          // Absorb b into a — grow size
          a.size = Math.min(
            a.size + b.size * GLASS.MERGE_ABSORB,
            GLASS.SIZE_MIN + GLASS.SIZE_RANGE,
          );
          b.remove();
          break;
        }
      }
    }
  }

  function updateThunder(now, pal) {
    // Spawn ambient strikes
    if (now >= nextStrikeTime && ambientBolts.length < THUNDER.BOLT_MAX) {
      const count =
        THUNDER.BOLT_COUNT_MIN +
        Math.floor(Math.random() * THUNDER.BOLT_COUNT_RANGE);
      // Embers are a discrete burst, not ambient motion — gate on
      // prefersReducedMotion() so reduced-motion users get the bolt
      // and flash but no spark shower.
      const spawnEmbers = !prefersReducedMotion();
      for (let i = 0; i < count; i++) {
        if (ambientBolts.length >= THUNDER.BOLT_MAX) break;
        const x1 = Math.random() * canvas.width;
        const y1 = Math.random() * canvas.height * THUNDER.START_Y_FRAC;
        const x2 =
          x1 + (Math.random() - 0.5) * canvas.width * THUNDER.BOLT_SPREAD_X;
        const y2 =
          canvas.height *
          (THUNDER.START_Y_FRAC +
            Math.random() * (THUNDER.END_Y_FRAC - THUNDER.START_Y_FRAC));
        spawnBolt(ambientBolts, x1, y1, x2, y2, 0);
        if (spawnEmbers) {
          const emberCount =
            EMBER.COUNT_MIN + Math.floor(Math.random() * EMBER.COUNT_RANGE);
          for (let k = 0; k < emberCount; k++) {
            const e = embers.find((e) => !e.active);
            if (!e) break;
            e.spawn(x2, y2);
          }
        }
      }
      thunderBoostEnd = now + THUNDER.BOOST_MS;
      rumbleEnd = now + THUNDER.RUMBLE_MS;
      nextStrikeTime =
        now + THUNDER.INTERVAL_MIN + Math.random() * THUNDER.INTERVAL_RANGE;
      // Announce the strike so the audio layer can roll a distant rumble; the
      // bolt + flash render even under reduced motion, so this isn't gated.
      window.dispatchEvent(
        new CustomEvent("achievement", { detail: { type: "rain-thunder" } }),
      );
    }

    // Render active bolts
    let flashThisFrame = false;
    for (let i = ambientBolts.length - 1; i >= 0; i--) {
      const bolt = ambientBolts[i];
      bolt.life++;
      if (bolt.life > bolt.maxLife) {
        ambientBolts.splice(i, 1);
        continue;
      }
      if (bolt.life === 1) flashThisFrame = true;
      renderBolt(ctx, bolt, pal);
    }

    // Full-screen flash
    if (flashThisFrame) {
      const fc = pal.lightningFlash;
      ctx.save();
      ctx.globalAlpha = THUNDER.FLASH_ALPHA;
      ctx.fillStyle = `rgba(${fc[0]},${fc[1]},${fc[2]},1)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Screen rumble
    if (pageEl && now < rumbleEnd) {
      const dx = (Math.random() - 0.5) * THUNDER.RUMBLE_PX;
      const dy = (Math.random() - 0.5) * THUNDER.RUMBLE_PX;
      pageEl.style.translate = `${dx}px ${dy}px`;
    } else if (
      pageEl &&
      now >= rumbleEnd &&
      now < rumbleEnd + THUNDER.RUMBLE_RESET_MS
    ) {
      pageEl.style.translate = "";
    }

    // Embers — pure ballistic, friction-only.  Update integrates via
    // step() which already absorbs the motion budget.
    for (const e of embers) {
      e.update();
      e.draw(ctx);
    }

    return now < thunderBoostEnd ? THUNDER.SPEED_BOOST : 0;
  }

  return {
    draw(forces, scrollVelocity, dt, pal) {
      const now = performance.now();
      const dtMs = dt * 1000;
      const windOffset = getWindOffset(now);
      const speedBoost = updateThunder(now, pal);

      // Rain color from palette
      const rc = pal.streakColor;
      const rainStyle = `${rc[0]},${rc[1]},${rc[2]}`;

      // Draw each layer — batched strokes per layer
      for (let li = 0; li < layers.length; li++) {
        const pool = layers[li];
        const cfg = LAYER_CONFIGS[li]();

        ctx.save();
        ctx.strokeStyle = `rgba(${rainStyle},${cfg.opacityMin + cfg.opacityRange * 0.5})`;
        ctx.lineWidth = cfg.width;
        ctx.lineCap = "round";
        ctx.beginPath();

        for (let i = 0; i < pool.length; i++) {
          const d = pool[i];
          d.update(windOffset, speedBoost);

          // Force interactions
          applyRepulsion(forces, d, RAIN.REPEL_RADIUS, RAIN.REPEL_DAMPEN);
          applyAttraction(
            forces,
            d,
            RAIN.ATTRACT_RADIUS,
            RAIN.ATTRACT_STRENGTH,
            RAIN.ATTRACT_TANGENT,
          );
          applyWellForce(forces, d);

          // Scroll push
          if (Math.abs(scrollVelocity) > RAIN.SCROLL_THRESHOLD) {
            d.vx += scrollVelocity * RAIN.SCROLL_VX;
          }

          // Streak direction — tail trails behind motion
          const totalVx = windOffset * cfg.windScale + d.vx;
          const totalVy = d.fallSpeed * (1 + speedBoost) + d.vy;
          const speed = Math.sqrt(totalVx * totalVx + totalVy * totalVy) || 1;
          const nx = totalVx / speed;
          const ny = totalVy / speed;
          const tailX = d.x - nx * d.len;
          const tailY = d.y - ny * d.len;

          ctx.moveTo(d.x, d.y);
          ctx.lineTo(tailX, tailY);

          // Ground hit — reset + optional splash
          if (d.y > canvas.height + d.len) {
            if (li >= 1 && Math.random() < SPLASH.GROUND_CHANCE) {
              spawnGroundSplash(d.x, canvas.height);
            }
            d.reset(false);
          }

          // Wrap horizontal
          if (d.x < -RAIN.WRAP_MARGIN)
            d.x += canvas.width + RAIN.WRAP_MARGIN * 2;
          if (d.x > canvas.width + RAIN.WRAP_MARGIN)
            d.x -= canvas.width + RAIN.WRAP_MARGIN * 2;
        }

        ctx.stroke();
        ctx.restore();
      }

      // Splash particles
      const sc = pal.clickColor;
      ctx.save();
      ctx.fillStyle = `rgba(${sc[0]},${sc[1]},${sc[2]},${SPLASH.DRAW_ALPHA})`;
      for (let i = 0; i < splashes.length; i++) {
        const s = splashes[i];
        s.update();
        if (!s.active) continue;
        const fade = 1 - s.life / SPLASH.LIFE;
        ctx.globalAlpha = fade * SPLASH.DRAW_ALPHA;
        ctx.beginPath();
        ctx.arc(s.x, s.y, SPLASH.RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Glass drops (overlay canvas) — spawn rate dampens with motion
      // so no new drops appear under reduced motion.
      const spawnRate = isGusting ? GLASS.GUST_SPAWN_RATE : GLASS.SPAWN_RATE;
      glassSpawnAccum += scaled(spawnRate * dt);
      while (glassSpawnAccum >= 1) {
        glassSpawnAccum--;
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight * GLASS.SPAWN_Y_FRAC;
        spawnGlassDrop(x, y);
      }

      glassCtx.clearRect(0, 0, glassCanvas.width, glassCanvas.height);
      for (let i = 0; i < glassDrops.length; i++) {
        glassDrops[i].update(dtMs, scrollVelocity);
        glassDrops[i].draw(glassCtx, pal);
      }
      checkGlassMerge();
    },

    clickBurst(cx, cy) {
      const count =
        SPLASH.CLICK_COUNT_MIN +
        Math.floor(Math.random() * SPLASH.CLICK_COUNT_RANGE);
      for (let i = 0; i < count; i++) {
        const s = splashes.find((s) => !s.active);
        if (!s) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = SPLASH.SPEED_MIN + Math.random() * SPLASH.SPEED_RANGE;
        s.spawn(cx, cy, angle, speed);
      }
    },

    wellBurst(cx, cy) {
      // Count drops near well center
      let collected = 0;
      for (const pool of layers) {
        for (const d of pool) {
          const dx = d.x - cx;
          const dy = d.y - cy;
          if (dx * dx + dy * dy < SPLASH.WELL_RADIUS * SPLASH.WELL_RADIUS) {
            collected++;
          }
        }
      }
      // Massive splash proportional to collected count
      const count = Math.min(
        SPLASH.WELL_BURST_MAX,
        Math.max(
          SPLASH.WELL_MIN_COUNT,
          Math.floor(collected * SPLASH.WELL_COLLECT_MUL),
        ),
      );
      for (let i = 0; i < count; i++) {
        const s = splashes.find((s) => !s.active);
        if (!s) break;
        const angle = Math.random() * Math.PI * 2;
        const speed =
          SPLASH.WELL_SPEED_MIN + Math.random() * SPLASH.WELL_SPEED_RANGE;
        s.spawn(cx, cy, angle, speed);
      }
      // Glass splatter near well center
      for (let i = 0; i < GLASS.WELL_BURST_COUNT; i++) {
        const gx = cx + (Math.random() - 0.5) * GLASS.WELL_SCATTER_X;
        const gy = cy + (Math.random() - 0.5) * GLASS.WELL_SCATTER_Y;
        spawnGlassDrop(gx, gy);
      }
    },

    cleanup() {
      // Deactivate all glass drops and clear overlay
      for (const g of glassDrops) {
        g.remove();
      }
      glassCtx.clearRect(0, 0, glassCanvas.width, glassCanvas.height);
      // Drop in-flight embers so they don't reappear when the theme returns
      for (const e of embers) e.active = false;
    },
  };
}
