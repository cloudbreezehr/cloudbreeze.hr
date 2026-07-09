import { Z_RAIN_GLASS } from "../layers.js";
import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { spawnBolt, renderBolt } from "../fury.js";
import { drawHaloParticle } from "../canvas-utils.js";
import { scaled, step, chance, prefersReducedMotion } from "../motion.js";
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

export class Raindrop {
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

// Area-conserving coalescence: the projected wet area of the pair is
// preserved, so repeated merges read as real growth. Capped — a drop can
// only hold so much before it would fall off the pane in reality.
export function mergedSize(a, b) {
  return Math.min(GLASS.SIZE_MAX, Math.hypot(a, b));
}

// A droplet on the pane lives a little life: it condenses somewhere and
// pins in place (surface tension beats gravity while it's light), fattens
// by condensation and by merging with neighbours, and lets go once it
// outgrows its grip. Sliding, it runs at a mass-dependent pace — light
// drops in stick-slip jerks, heavy ones in a smooth run — meanders,
// steers toward the wet droplets below it, swallows what it touches, and
// sheds beads behind itself until it either escapes the pane or thins out
// and pins again. Shed beads slowly dry off; the pane mists back up.
export class GlassDrop {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.size = 0;
    this.grip = 0;
    this.speed = 0;
    this.meander = 0;
    this.steerX = null;
    this.absorbed = 0;
    this.sinceShed = 0;
    this.active = false;
    this.sliding = false;
    this.bead = false;
    this.trail = []; // wet neck behind a slider: [{x, y}]
    this.opacity = 0;
    this.fadeIn = true;
  }

  spawn(x, y, size, { bead = false } = {}) {
    this.x = x;
    this.y = y;
    this.size = size ?? GLASS.SIZE_MIN + Math.random() * GLASS.SIZE_RANGE;
    // Pinning strength — the diameter this drop must outgrow before
    // gravity wins. Randomized per drop: glass is dirty and imperfect.
    this.grip = GLASS.GRIP_MIN + Math.random() * GLASS.GRIP_RANGE;
    this.speed = 0;
    this.meander = 0;
    this.steerX = null;
    this.absorbed = 0;
    this.sinceShed = 0;
    this.active = true;
    this.sliding = false;
    this.bead = bead;
    this.trail = [];
    // Shed beads are already-wet water left on the track — they appear at
    // full strength so the trail never lags behind its head. Only fresh
    // condensation fades in.
    this.opacity = bead ? 1 : 0;
    this.fadeIn = !bead;
  }

  startSliding() {
    this.sliding = true;
    this.bead = false;
    this.speed = GLASS.SPEED_BASE;
    this.absorbed = 0;
    this.sinceShed = 0;
    this.trail = [{ x: this.x, y: this.y }];
  }

  // Thinned out mid-run: surface tension wins again. The drop pins where
  // it stands and needs a fresh feed before it can release once more.
  stall() {
    this.sliding = false;
    this.trail = [];
    this.grip = Math.max(this.grip, this.size + GLASS.STALL_GRIP_MARGIN);
  }

  // Water jumps to water: the head lurches toward what it swallowed,
  // gains its area, and picks up pace from the released surface tension.
  absorb(other) {
    this.x += scaled((other.x - this.x) * GLASS.ABSORB_LURCH);
    this.size = mergedSize(this.size, other.size);
    if (this.sliding) {
      this.speed += scaled(GLASS.ABSORB_KICK);
      this.absorbed++;
    }
    other.remove();
  }

  update(dt, scrollVel, wind, depositBead) {
    if (!this.active) return;

    // Fade in
    if (this.fadeIn) {
      this.opacity = Math.min(1, this.opacity + dt / GLASS.FADE_IN_MS);
      if (this.opacity >= 1) this.fadeIn = false;
    }

    if (!this.sliding) {
      if (this.bead) {
        // Shed beads only dry off; they wait to be swallowed, not to slide.
        this.size -= scaled(GLASS.BEAD_EVAP_PER_FRAME);
        if (this.size <= GLASS.MIN_VISIBLE_SIZE) this.active = false;
        return;
      }
      // Condensation fattens a pinned drop until gravity outgrows its
      // grip — or, rarely, a mid-weight drop shakes loose early.
      this.size = Math.min(
        GLASS.SIZE_MAX,
        this.size + scaled(GLASS.CONDENSE_PER_FRAME),
      );
      if (
        this.size > this.grip ||
        (this.size > GLASS.RELEASE_MIN_SIZE && chance(GLASS.RELEASE_CHANCE))
      ) {
        this.startSliding();
      }
      return;
    }

    // ── Sliding ──
    // A thinned drop doesn't snap to a halt at speed — its pace follows its
    // size down (the mass-set target below), and only once it has slowed to
    // a creep can the glass catch it. The chance() keeps even that catch a
    // dribbling-out rather than an instant stop.
    if (
      this.size <= GLASS.STALL_SIZE &&
      this.speed <= GLASS.STALL_MAX_SPEED &&
      chance(GLASS.STALL_CHANCE)
    ) {
      this.stall();
      return;
    }

    // Mass sets the pace, approached gradually; light drops catch on the
    // glass and jerk free (stick-slip) instead of gliding.
    const targetSpeed = Math.min(
      GLASS.SPEED_MAX,
      Math.max(
        0,
        GLASS.SPEED_BASE + (this.size - GLASS.GRIP_MIN) * GLASS.SPEED_PER_SIZE,
      ),
    );
    this.speed += scaled((targetSpeed - this.speed) * GLASS.SPEED_LERP);
    if (this.size < GLASS.STICK_MAX_SIZE && chance(GLASS.STICK_CHANCE)) {
      this.speed *= GLASS.STICK_DAMP;
    }

    // Meander: a damped random walk, pulled toward the nearest wet droplet
    // below (water runs to water — the field writes steerX each frame) and
    // pushed by the storm's wind. Scroll still tilts the glass vertically.
    this.meander += scaled((Math.random() - 0.5) * GLASS.MEANDER_JITTER);
    if (this.steerX != null) {
      const pull = (this.steerX - this.x) * GLASS.STEER_GAIN;
      this.meander += scaled(
        Math.max(-GLASS.STEER_MAX, Math.min(GLASS.STEER_MAX, pull)),
      );
    }
    this.meander *= GLASS.MEANDER_DAMP;

    // Gravity dominates a real run: the whole lateral step — meander,
    // steering, and wind together — is capped to a fraction of the drop's
    // own downward pace, so a crawling drop can only crawl sideways too.
    const pace = Math.max(0, this.speed + scrollVel * GLASS.SCROLL_FACTOR);
    const lateralCap = pace * GLASS.LATERAL_RATIO_MAX;
    this.meander = Math.max(-lateralCap, Math.min(lateralCap, this.meander));
    const lateral = Math.max(
      -lateralCap,
      Math.min(lateralCap, this.meander + wind * GLASS.WIND_FACTOR),
    );

    const dy = scaled(pace);
    this.x += scaled(lateral);
    this.y += dy;

    if (dy > 0) {
      // Distance-sampled neck, so its on-screen length holds whatever the
      // pace — a per-frame history would shrink to a stub on a slow drop.
      const last = this.trail[this.trail.length - 1];
      if (
        !last ||
        Math.hypot(this.x - last.x, this.y - last.y) >= GLASS.NECK_SPACING_PX
      ) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > GLASS.NECK_POINTS) this.trail.shift();
      }

      // Shed a bead into the track. The head only pays a fraction of the
      // bead's area — the wet film the run lays down feeds the rest — so a
      // healthy drop outlives many sheds and crossing the pane is the norm;
      // the stall check at the top of the slide catches the lean exceptions.
      this.sinceShed += dy;
      if (this.sinceShed >= GLASS.SHED_INTERVAL_PX) {
        this.sinceShed = 0;
        const beadSize = Math.max(
          GLASS.BEAD_MIN,
          Math.min(GLASS.BEAD_MAX, this.size * GLASS.BEAD_FRAC),
        );
        depositBead?.(this.x, this.y - this.size, beadSize);
        this.size = Math.sqrt(
          Math.max(
            0,
            this.size * this.size - beadSize * beadSize * GLASS.SHED_COST_FRAC,
          ),
        );
      }
    }

    if (this.y > window.innerHeight + GLASS.EXIT_MARGIN) {
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

    // ── Drop body — a circle at rest, a teardrop once it runs ──
    const r = this.size / 2;
    const elong = this.sliding
      ? Math.min(GLASS.ELONG_MAX, this.speed * GLASS.ELONG_PER_SPEED)
      : 0;
    ctx.beginPath();
    ctx.ellipse(
      this.x,
      this.y,
      r / (1 + elong),
      r * (1 + elong),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = `rgba(${body[0]},${body[1]},${body[2]},${a * GLASS.TRAIL_BODY_ALPHA})`;
    ctx.fill();

    // Specular and rim read as noise on the smallest droplets — skip
    // (the same economy the gradient rule applies to faint particles).
    if (this.size < GLASS.DETAIL_MIN_SIZE) return;

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
    ctx.ellipse(
      this.x,
      this.y,
      r / (1 + elong),
      r * (1 + elong),
      0,
      0,
      Math.PI * 2,
    );
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

  function depositBead(x, y, size) {
    const g = glassDrops.find((g) => !g.active);
    if (g) g.spawn(x, y, size, { bead: true });
  }

  // Point each slider at the nearest pinned droplet below it — water runs
  // to water, so the run visibly hunts sideways toward its next meal.
  function steerSliders() {
    for (const a of glassDrops) {
      if (!a.active || !a.sliding) continue;
      a.steerX = null;
      let nearest = Infinity;
      for (const b of glassDrops) {
        if (b === a || !b.active || b.sliding) continue;
        const dy = b.y - a.y;
        if (dy <= 0 || dy > GLASS.LOOKAHEAD_Y) continue;
        if (Math.abs(b.x - a.x) > GLASS.LOOKAHEAD_X) continue;
        if (dy < nearest) {
          nearest = dy;
          a.steerX = b.x;
        }
      }
    }
  }

  // Coalescence pass: a slider swallows whatever it touches (a run of
  // swallows is a cascade — worth an achievement event); two pinned
  // droplets that grow into each other merge, the bigger drinking the
  // smaller and jumping toward the pair's centre of mass — which is how
  // most drops end up past their grip and start to run.
  function settleGlassPane() {
    // Every branch below repositions a drop — a discrete jump dampening
    // can't soften — so the whole pass sits out under reduced motion.
    if (prefersReducedMotion()) return;
    for (let i = 0; i < glassDrops.length; i++) {
      const a = glassDrops[i];
      if (!a.active) continue;
      for (let j = i + 1; j < glassDrops.length; j++) {
        const b = glassDrops[j];
        if (!b.active) continue;
        const anySliding = a.sliding || b.sliding;
        const reach =
          ((a.size + b.size) / 2) *
          (anySliding ? GLASS.CAPTURE_FRAC : GLASS.MERGE_OVERLAP_FRAC);
        const dx = a.x - b.x;
        if (dx > reach || dx < -reach) continue;
        const dy = a.y - b.y;
        if (dx * dx + dy * dy >= reach * reach) continue;

        if (anySliding) {
          // The slider eats; between two sliders, the heavier one wins.
          const head = !b.sliding || (a.sliding && a.size >= b.size) ? a : b;
          const food = head === a ? b : a;
          head.absorb(food);
          if (head.absorbed === GLASS.CASCADE_COUNT) {
            window.dispatchEvent(
              new CustomEvent("achievement", {
                detail: { type: "glass-cascade" },
              }),
            );
          }
        } else {
          const big = a.size >= b.size ? a : b;
          const small = big === a ? b : a;
          const merged = mergedSize(big.size, small.size);
          // Centre-of-mass jump, weighted by the pair's areas.
          const share = (small.size * small.size) / (merged * merged);
          big.x += scaled((small.x - big.x) * share);
          big.y += scaled((small.y - big.y) * share);
          big.size = merged;
          small.remove();
        }
        if (!a.active) break;
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

    // Screen rumble — physical page motion, so reduced motion skips it
    // entirely (the bolt and flash still render).
    if (pageEl && now < rumbleEnd && !prefersReducedMotion()) {
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
            if (li >= 1 && chance(SPLASH.GROUND_CHANCE)) {
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

      // Glass droplets (overlay canvas) — condensation misting the pane.
      // Spawn rate dampens with motion so no new drops appear under
      // reduced motion.
      const spawnRate = isGusting ? GLASS.GUST_SPAWN_RATE : GLASS.SPAWN_RATE;
      glassSpawnAccum += scaled(spawnRate * dt);
      while (glassSpawnAccum >= 1) {
        glassSpawnAccum--;
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight * GLASS.SPAWN_Y_FRAC;
        spawnGlassDrop(x, y);
      }

      glassCtx.clearRect(0, 0, glassCanvas.width, glassCanvas.height);
      steerSliders();
      for (let i = 0; i < glassDrops.length; i++) {
        glassDrops[i].update(dtMs, scrollVelocity, windOffset, depositBead);
        glassDrops[i].draw(glassCtx, pal);
      }
      settleGlassPane();
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
      // A strike's rumble offset must not outlive the theme — draw() stops,
      // so its own reset window can no longer clear it.
      if (pageEl) pageEl.style.translate = "";
    },
  };
}
