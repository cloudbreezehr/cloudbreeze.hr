import { Z_RAIN_GLASS } from "../layers.js";
import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { spawnBolt, renderBolt } from "../fury.js";
import { defineConstants } from "../dev/registry.js";

// ── Rain Layers ──
const RAIN = defineConstants(
  "particles.rain",
  {
    // Far layer (background)
    FAR_COUNT: {
      value: 60,
      min: 0,
      max: 150,
      step: 1,
      description: "Far-layer raindrop count",
    },
    FAR_LEN_MIN: {
      value: 4,
      min: 1,
      max: 12,
      step: 0.5,
      description: "Far-layer min streak length",
    },
    FAR_LEN_RANGE: {
      value: 4,
      min: 0,
      max: 12,
      step: 0.5,
      description: "Far-layer streak length variation",
    },
    FAR_WIDTH: {
      value: 0.5,
      min: 0.2,
      max: 2,
      step: 0.1,
      description: "Far-layer stroke width",
    },
    FAR_SPEED_MIN: {
      value: 2,
      min: 0.5,
      max: 6,
      step: 0.25,
      description: "Far-layer min fall speed",
    },
    FAR_SPEED_RANGE: {
      value: 1,
      min: 0,
      max: 4,
      step: 0.25,
      description: "Far-layer fall speed variation",
    },
    FAR_OPACITY_MIN: {
      value: 0.15,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Far-layer min opacity",
    },
    FAR_OPACITY_RANGE: {
      value: 0.1,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Far-layer opacity variation",
    },

    // Mid layer
    MID_COUNT: {
      value: 40,
      min: 0,
      max: 100,
      step: 1,
      description: "Mid-layer raindrop count",
    },
    MID_LEN_MIN: {
      value: 8,
      min: 2,
      max: 20,
      step: 0.5,
      description: "Mid-layer min streak length",
    },
    MID_LEN_RANGE: {
      value: 6,
      min: 0,
      max: 16,
      step: 0.5,
      description: "Mid-layer streak length variation",
    },
    MID_WIDTH: {
      value: 1,
      min: 0.3,
      max: 3,
      step: 0.1,
      description: "Mid-layer stroke width",
    },
    MID_SPEED_MIN: {
      value: 4,
      min: 1,
      max: 10,
      step: 0.25,
      description: "Mid-layer min fall speed",
    },
    MID_SPEED_RANGE: {
      value: 2,
      min: 0,
      max: 6,
      step: 0.25,
      description: "Mid-layer fall speed variation",
    },
    MID_OPACITY_MIN: {
      value: 0.3,
      min: 0,
      max: 0.7,
      step: 0.01,
      description: "Mid-layer min opacity",
    },
    MID_OPACITY_RANGE: {
      value: 0.2,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Mid-layer opacity variation",
    },

    // Near layer (foreground)
    NEAR_COUNT: {
      value: 25,
      min: 0,
      max: 80,
      step: 1,
      description: "Near-layer raindrop count",
    },
    NEAR_LEN_MIN: {
      value: 14,
      min: 4,
      max: 30,
      step: 1,
      description: "Near-layer min streak length",
    },
    NEAR_LEN_RANGE: {
      value: 8,
      min: 0,
      max: 20,
      step: 1,
      description: "Near-layer streak length variation",
    },
    NEAR_WIDTH: {
      value: 1.5,
      min: 0.5,
      max: 4,
      step: 0.1,
      description: "Near-layer stroke width",
    },
    NEAR_SPEED_MIN: {
      value: 7,
      min: 3,
      max: 16,
      step: 0.5,
      description: "Near-layer min fall speed",
    },
    NEAR_SPEED_RANGE: {
      value: 3,
      min: 0,
      max: 8,
      step: 0.5,
      description: "Near-layer fall speed variation",
    },
    NEAR_OPACITY_MIN: {
      value: 0.5,
      min: 0.2,
      max: 1,
      step: 0.01,
      description: "Near-layer min opacity",
    },
    NEAR_OPACITY_RANGE: {
      value: 0.2,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Near-layer opacity variation",
    },

    // Force interaction — rain is heavy
    REPEL_RADIUS: {
      value: 120,
      min: 30,
      max: 300,
      step: 10,
      description: "Click repulsion radius",
    },
    REPEL_DAMPEN: {
      value: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Click repulsion strength (low = heavy)",
    },
    ATTRACT_RADIUS: {
      value: 100,
      min: 30,
      max: 300,
      step: 10,
      description: "Drag attraction radius",
    },
    ATTRACT_STRENGTH: {
      value: 0.02,
      min: 0,
      max: 0.2,
      step: 0.005,
      description: "Drag attraction force (low = heavy)",
    },
    ATTRACT_TANGENT: {
      value: 0.05,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Tangential orbit factor (near zero = no orbiting)",
    },
    FRICTION: {
      value: 0.88,
      min: 0.7,
      max: 1,
      step: 0.01,
      description: "Lateral velocity damping per frame",
    },
    SCROLL_THRESHOLD: {
      value: 0.8,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Scroll velocity to push rain",
    },
    SCROLL_VX: {
      value: 0.01,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Horizontal scroll push factor",
    },
    STAGGER_Y_FRAC: {
      value: 0.3,
      min: 0.1,
      max: 0.8,
      step: 0.05,
      description: "Spawn stagger zone above viewport (fraction of height)",
    },
    WRAP_MARGIN: {
      value: 30,
      min: 10,
      max: 80,
      step: 5,
      description: "Horizontal off-screen wrap margin (px)",
    },
  },
  { mode: "rainy" },
);

// ── Wind System ──
const WIND = defineConstants(
  "particles.rainWind",
  {
    BASE_FREQ: {
      value: 0.0003,
      min: 0.0001,
      max: 0.002,
      step: 0.0001,
      description: "Base wind oscillation frequency",
    },
    BASE_AMP: {
      value: 0.8,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Base wind amplitude (px/frame)",
    },
    GUST_INTERVAL_MIN: {
      value: 8000,
      min: 3000,
      max: 20000,
      step: 500,
      description: "Minimum ms between gusts",
    },
    GUST_INTERVAL_RANGE: {
      value: 7000,
      min: 0,
      max: 15000,
      step: 500,
      description: "Gust interval variation",
    },
    GUST_DURATION: {
      value: 2500,
      min: 500,
      max: 5000,
      step: 100,
      description: "Gust duration in ms",
    },
    GUST_STRENGTH: {
      value: 2.5,
      min: 0.5,
      max: 6,
      step: 0.1,
      description: "Peak gust wind multiplier",
    },
    NEAR_SCALE: {
      value: 1.0,
      min: 0.2,
      max: 2,
      step: 0.1,
      description: "Wind scale for near layer",
    },
    MID_SCALE: {
      value: 0.6,
      min: 0.1,
      max: 1.5,
      step: 0.05,
      description: "Wind scale for mid layer",
    },
    FAR_SCALE: {
      value: 0.3,
      min: 0.05,
      max: 1,
      step: 0.05,
      description: "Wind scale for far layer",
    },
  },
  { mode: "rainy" },
);

// ── Splash Particles ──
const SPLASH = defineConstants(
  "particles.rainSplash",
  {
    MAX: {
      value: 40,
      min: 10,
      max: 100,
      step: 1,
      description: "Max simultaneous splash particles",
    },
    GROUND_COUNT_MIN: {
      value: 2,
      min: 1,
      max: 6,
      step: 1,
      description: "Min splash particles per ground hit",
    },
    GROUND_COUNT_RANGE: {
      value: 2,
      min: 0,
      max: 4,
      step: 1,
      description: "Ground splash count variation",
    },
    GROUND_CHANCE: {
      value: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Chance a mid/near drop splashes on landing",
    },
    CLICK_COUNT_MIN: {
      value: 8,
      min: 3,
      max: 20,
      step: 1,
      description: "Min splash particles per click",
    },
    CLICK_COUNT_RANGE: {
      value: 4,
      min: 0,
      max: 12,
      step: 1,
      description: "Click splash count variation",
    },
    SPEED_MIN: {
      value: 1.5,
      min: 0.5,
      max: 5,
      step: 0.1,
      description: "Min splash particle speed",
    },
    SPEED_RANGE: {
      value: 2,
      min: 0,
      max: 5,
      step: 0.1,
      description: "Splash speed variation",
    },
    GRAVITY: {
      value: 0.15,
      min: 0.01,
      max: 0.5,
      step: 0.01,
      description: "Splash particle gravity",
    },
    LIFE: {
      value: 15,
      min: 5,
      max: 40,
      step: 1,
      description: "Splash particle lifetime in frames",
    },
    RADIUS: {
      value: 1.5,
      min: 0.5,
      max: 4,
      step: 0.1,
      description: "Splash particle radius",
    },
    WELL_BURST_MAX: {
      value: 60,
      min: 10,
      max: 120,
      step: 5,
      description: "Max splash particles from gravity well release",
    },
    WELL_SPEED_MIN: {
      value: 3,
      min: 1,
      max: 8,
      step: 0.5,
      description: "Well burst min speed",
    },
    WELL_SPEED_RANGE: {
      value: 4,
      min: 0,
      max: 8,
      step: 0.5,
      description: "Well burst speed variation",
    },
    WELL_RADIUS: {
      value: 200,
      min: 50,
      max: 400,
      step: 10,
      description: "Radius to count collected drops for well burst",
    },
    WELL_MIN_COUNT: {
      value: 8,
      min: 2,
      max: 30,
      step: 1,
      description: "Minimum splash particles from gravity well",
    },
    WELL_COLLECT_MUL: {
      value: 1.5,
      min: 0.5,
      max: 4,
      step: 0.1,
      description: "Multiplier on collected drops for well burst count",
    },
    GROUND_ANGLE_START: {
      value: 0.15,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Ground splash upward spray start (fraction of PI)",
    },
    GROUND_ANGLE_RANGE: {
      value: 0.7,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Ground splash upward spray range (fraction of PI)",
    },
    DRAW_ALPHA: {
      value: 0.6,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Splash particle draw opacity",
    },
  },
  { mode: "rainy" },
);

// ── Glass Drops (DOM rain on screen) ──
const GLASS = defineConstants(
  "particles.rainGlass",
  {
    MAX: {
      value: 30,
      min: 5,
      max: 60,
      step: 1,
      description: "Max simultaneous glass drops",
    },
    SPAWN_RATE: {
      value: 1.5,
      min: 0.3,
      max: 5,
      step: 0.1,
      description: "Glass drops spawned per second",
    },
    GUST_SPAWN_RATE: {
      value: 3.5,
      min: 1,
      max: 8,
      step: 0.5,
      description: "Glass drops per second during gusts",
    },
    SIZE_MIN: {
      value: 4,
      min: 2,
      max: 10,
      step: 0.5,
      description: "Min glass drop diameter",
    },
    SIZE_RANGE: {
      value: 6,
      min: 0,
      max: 12,
      step: 0.5,
      description: "Glass drop size variation",
    },
    IDLE_MIN: {
      value: 500,
      min: 100,
      max: 2000,
      step: 50,
      description: "Min idle time before sliding (ms)",
    },
    IDLE_RANGE: {
      value: 1500,
      min: 0,
      max: 3000,
      step: 100,
      description: "Idle time variation (ms)",
    },
    SLIDE_SPEED_MIN: {
      value: 0.3,
      min: 0.1,
      max: 2,
      step: 0.05,
      description: "Min slide speed (px/frame)",
    },
    SLIDE_SPEED_RANGE: {
      value: 1.2,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Slide speed variation",
    },
    MERGE_DIST: {
      value: 6,
      min: 2,
      max: 15,
      step: 1,
      description: "Merge distance between drops (px)",
    },
    MERGE_ABSORB: {
      value: 0.3,
      min: 0.1,
      max: 0.8,
      step: 0.05,
      description: "Fraction of absorbed drop size transferred on merge",
    },
    SPAWN_Y_FRAC: {
      value: 0.2,
      min: 0.05,
      max: 0.5,
      step: 0.05,
      description: "Spawn zone as fraction of viewport height",
    },
    WELL_BURST_COUNT: {
      value: 6,
      min: 2,
      max: 15,
      step: 1,
      description: "Glass drops spawned on well release",
    },
    WELL_SCATTER_X: {
      value: 100,
      min: 20,
      max: 300,
      step: 10,
      description: "Horizontal scatter range for well glass splatter",
    },
    WELL_SCATTER_Y: {
      value: 80,
      min: 20,
      max: 200,
      step: 10,
      description: "Vertical scatter range for well glass splatter",
    },
    TRAIL_POINTS: {
      value: 40,
      min: 10,
      max: 80,
      step: 1,
      description: "Max position-history points per trail",
    },
    TRAIL_BODY_ALPHA: {
      value: 0.1,
      min: 0.02,
      max: 0.3,
      step: 0.01,
      description: "Drop body fill opacity",
    },
    TRAIL_TIP_ALPHA: {
      value: 0.06,
      min: 0.01,
      max: 0.2,
      step: 0.01,
      description: "Trail opacity at drop end (fades to 0 at tail)",
    },
    TRAIL_WIDTH_FRAC: {
      value: 0.45,
      min: 0.1,
      max: 0.8,
      step: 0.05,
      description: "Trail max half-width as fraction of drop size",
    },
    SPECULAR_ALPHA: {
      value: 0.22,
      min: 0.05,
      max: 0.5,
      step: 0.01,
      description: "Specular highlight intensity on drop body",
    },
    RIM_ALPHA: {
      value: 0.15,
      min: 0.02,
      max: 0.4,
      step: 0.01,
      description: "Drop rim outline opacity",
    },
    FADE_IN_MS: {
      value: 400,
      min: 100,
      max: 1000,
      step: 50,
      description: "Fade-in duration for new drops (ms)",
    },
    WOBBLE_AMP_MIN: {
      value: 0.15,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Min horizontal wobble amplitude",
    },
    WOBBLE_AMP_RANGE: {
      value: 0.25,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Wobble amplitude variation",
    },
    WOBBLE_FREQ_MIN: {
      value: 0.003,
      min: 0.001,
      max: 0.02,
      step: 0.001,
      description: "Min wobble frequency",
    },
    WOBBLE_FREQ_RANGE: {
      value: 0.004,
      min: 0,
      max: 0.02,
      step: 0.001,
      description: "Wobble frequency variation",
    },
    SCROLL_FACTOR: {
      value: 0.08,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "How much scroll velocity affects glass drop speed",
    },
    ACCEL: {
      value: 0.002,
      min: 0,
      max: 0.02,
      step: 0.001,
      description: "Drop acceleration over time (gravity on glass)",
    },
    SPEED_MAX: {
      value: 3,
      min: 1,
      max: 8,
      step: 0.1,
      description: "Max drop slide speed",
    },
  },
  { mode: "rainy" },
);

// ── Ambient Thunder ──
const THUNDER = defineConstants(
  "particles.rainThunder",
  {
    INTERVAL_MIN: {
      value: 8000,
      min: 3000,
      max: 30000,
      step: 500,
      description: "Min ms between lightning strikes",
    },
    INTERVAL_RANGE: {
      value: 12000,
      min: 0,
      max: 25000,
      step: 500,
      description: "Strike interval variation",
    },
    BOLT_COUNT_MIN: {
      value: 1,
      min: 1,
      max: 4,
      step: 1,
      description: "Min bolts per strike",
    },
    BOLT_COUNT_RANGE: {
      value: 2,
      min: 0,
      max: 4,
      step: 1,
      description: "Bolt count variation",
    },
    BOLT_MAX: {
      value: 8,
      min: 2,
      max: 20,
      step: 1,
      description: "Max simultaneous ambient bolts",
    },
    START_Y_FRAC: {
      value: 0.15,
      min: 0,
      max: 0.4,
      step: 0.01,
      description: "Bolt origin max Y as fraction of canvas",
    },
    END_Y_FRAC: {
      value: 0.5,
      min: 0.2,
      max: 0.8,
      step: 0.05,
      description: "Bolt end max Y as fraction of canvas",
    },
    FLASH_ALPHA: {
      value: 0.06,
      min: 0,
      max: 0.3,
      step: 0.01,
      description: "Screen flash opacity",
    },
    RUMBLE_PX: {
      value: 4,
      min: 1,
      max: 10,
      step: 0.5,
      description: "Screen shake intensity in pixels",
    },
    RUMBLE_MS: {
      value: 300,
      min: 100,
      max: 600,
      step: 25,
      description: "Screen shake duration in ms",
    },
    SPEED_BOOST: {
      value: 0.25,
      min: 0,
      max: 0.8,
      step: 0.05,
      description: "Rain speed boost fraction after strike",
    },
    BOOST_MS: {
      value: 2000,
      min: 500,
      max: 5000,
      step: 100,
      description: "Duration of post-strike rain intensification",
    },
    BOLT_SPREAD_X: {
      value: 0.4,
      min: 0.1,
      max: 0.8,
      step: 0.05,
      description: "Bolt horizontal spread (fraction of canvas width)",
    },
    RUMBLE_RESET_MS: {
      value: 50,
      min: 16,
      max: 200,
      step: 10,
      description: "Window after rumble ends to reset page transform (ms)",
    },
  },
  { mode: "rainy" },
);

// ── Module-scoped canvas refs ──
let _canvas, _ctx;

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
  constructor(layer) {
    this.layer = layer;
    this.reset(true);
  }

  reset(init) {
    const cfg = LAYER_CONFIGS[this.layer]();
    this.x = Math.random() * _canvas.width;
    // Stagger initial positions; subsequent resets start above viewport
    this.y = init
      ? Math.random() * _canvas.height
      : -(Math.random() * _canvas.height * RAIN.STAGGER_Y_FRAC);
    this.len = cfg.lenMin + Math.random() * cfg.lenRange;
    this.fallSpeed = cfg.speedMin + Math.random() * cfg.speedRange;
    this.opacity = cfg.opacityMin + Math.random() * cfg.opacityRange;
    this.windPhase = Math.random() * Math.PI * 2;
    this.vx = 0;
    this.vy = 0;
  }

  update(windOffset, speedBoost) {
    const cfg = LAYER_CONFIGS[this.layer]();
    this.x += windOffset * cfg.windScale + this.vx;
    this.y += this.fallSpeed * (1 + speedBoost) + this.vy;
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
    this.x += this.vx;
    this.y += this.vy;
    this.vy += SPLASH.GRAVITY;
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
    this.wobblePhase += this.wobbleFreq * dt;
    const wobble = Math.sin(this.wobblePhase) * this.wobbleAmp;

    this.y += frameSpeed;
    this.x += wobble;

    // Record position; cap history length
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > GLASS.TRAIL_POINTS) this.trail.shift();

    if (this.y > window.innerHeight + 20) {
      this.active = false;
    }
  }

  draw(ctx) {
    if (!this.active || this.opacity <= 0) return;
    const a = this.opacity;
    const len = this.trail.length;

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
      ctx.fillStyle = `rgba(200,220,240,${(a * GLASS.TRAIL_TIP_ALPHA).toFixed(3)})`;
      ctx.fill();
    }

    // ── Drop body — filled circle with subtle gradient look ──
    const r = this.size / 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,220,240,${(a * GLASS.TRAIL_BODY_ALPHA).toFixed(3)})`;
    ctx.fill();

    // Specular highlight — offset circle
    ctx.beginPath();
    ctx.arc(this.x - r * 0.25, this.y - r * 0.25, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${(a * GLASS.SPECULAR_ALPHA).toFixed(3)})`;
    ctx.fill();

    // Rim outline
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(220,235,250,${(a * GLASS.RIM_ALPHA).toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  remove() {
    this.active = false;
  }
}

// ── Factory ──

export function createRain(canvasEl, ctxEl) {
  _canvas = canvasEl;
  _ctx = ctxEl;

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
    Array.from({ length: RAIN.FAR_COUNT }, () => new Raindrop(0)),
    Array.from({ length: RAIN.MID_COUNT }, () => new Raindrop(1)),
    Array.from({ length: RAIN.NEAR_COUNT }, () => new Raindrop(2)),
  ];

  // Splash pool
  const splashes = Array.from(
    { length: SPLASH.MAX },
    () => new SplashParticle(),
  );

  // Glass drop pool
  const glassDrops = Array.from({ length: GLASS.MAX }, () => new GlassDrop());
  let glassSpawnAccum = 0;

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
      for (let i = 0; i < count; i++) {
        if (ambientBolts.length >= THUNDER.BOLT_MAX) break;
        const x1 = Math.random() * _canvas.width;
        const y1 = Math.random() * _canvas.height * THUNDER.START_Y_FRAC;
        const x2 =
          x1 + (Math.random() - 0.5) * _canvas.width * THUNDER.BOLT_SPREAD_X;
        const y2 =
          _canvas.height *
          (THUNDER.START_Y_FRAC +
            Math.random() * (THUNDER.END_Y_FRAC - THUNDER.START_Y_FRAC));
        spawnBolt(ambientBolts, x1, y1, x2, y2, 0);
      }
      thunderBoostEnd = now + THUNDER.BOOST_MS;
      rumbleEnd = now + THUNDER.RUMBLE_MS;
      nextStrikeTime =
        now + THUNDER.INTERVAL_MIN + Math.random() * THUNDER.INTERVAL_RANGE;
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
      renderBolt(_ctx, bolt, pal);
    }

    // Full-screen flash
    if (flashThisFrame) {
      const fc = pal.lightningFlash;
      _ctx.save();
      _ctx.globalAlpha = THUNDER.FLASH_ALPHA;
      _ctx.fillStyle = `rgba(${fc[0]},${fc[1]},${fc[2]},1)`;
      _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
      _ctx.restore();
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

    return now < thunderBoostEnd ? THUNDER.SPEED_BOOST : 0;
  }

  return {
    draw(forces, scrollVelocity, dt, pal) {
      const now = performance.now();
      const dtMs = dt * 1000;
      const windOffset = getWindOffset(now);
      const speedBoost = updateThunder(now, pal);

      // Rain color from palette
      const rc = pal.streakColor || [180, 200, 220];
      const rainStyle = `${rc[0]},${rc[1]},${rc[2]}`;

      // Draw each layer — batched strokes per layer
      for (let li = 0; li < layers.length; li++) {
        const pool = layers[li];
        const cfg = LAYER_CONFIGS[li]();

        _ctx.save();
        _ctx.strokeStyle = `rgba(${rainStyle},${cfg.opacityMin + cfg.opacityRange * 0.5})`;
        _ctx.lineWidth = cfg.width;
        _ctx.lineCap = "round";
        _ctx.beginPath();

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

          _ctx.moveTo(d.x, d.y);
          _ctx.lineTo(tailX, tailY);

          // Ground hit — reset + optional splash
          if (d.y > _canvas.height + d.len) {
            if (li >= 1 && Math.random() < SPLASH.GROUND_CHANCE) {
              spawnGroundSplash(d.x, _canvas.height);
            }
            d.reset(false);
          }

          // Wrap horizontal
          if (d.x < -RAIN.WRAP_MARGIN)
            d.x += _canvas.width + RAIN.WRAP_MARGIN * 2;
          if (d.x > _canvas.width + RAIN.WRAP_MARGIN)
            d.x -= _canvas.width + RAIN.WRAP_MARGIN * 2;
        }

        _ctx.stroke();
        _ctx.restore();
      }

      // Splash particles
      const sc = pal.clickColor || [200, 220, 255];
      _ctx.save();
      _ctx.fillStyle = `rgba(${sc[0]},${sc[1]},${sc[2]},${SPLASH.DRAW_ALPHA})`;
      for (let i = 0; i < splashes.length; i++) {
        const s = splashes[i];
        s.update();
        if (!s.active) continue;
        const fade = 1 - s.life / SPLASH.LIFE;
        _ctx.globalAlpha = fade * SPLASH.DRAW_ALPHA;
        _ctx.beginPath();
        _ctx.arc(s.x, s.y, SPLASH.RADIUS, 0, Math.PI * 2);
        _ctx.fill();
      }
      _ctx.restore();

      // Glass drops (overlay canvas)
      const spawnRate = isGusting ? GLASS.GUST_SPAWN_RATE : GLASS.SPAWN_RATE;
      glassSpawnAccum += spawnRate * dt;
      while (glassSpawnAccum >= 1) {
        glassSpawnAccum--;
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight * GLASS.SPAWN_Y_FRAC;
        spawnGlassDrop(x, y);
      }

      glassCtx.clearRect(0, 0, glassCanvas.width, glassCanvas.height);
      for (let i = 0; i < glassDrops.length; i++) {
        glassDrops[i].update(dtMs, scrollVelocity);
        glassDrops[i].draw(glassCtx);
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
    },
  };
}
