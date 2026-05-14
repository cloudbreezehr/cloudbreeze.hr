// ── Fireworks Effect ──
// Reusable multi-stage firework bursts with radial glow and trailing sparkles.
// Two APIs:
//   burstFireworks(x, y, opts)         — one-shot overlay mode (self-cleaning)
//   createFireworksRenderer()          — shared-canvas mode for render loops

import { Z_FIREWORKS } from "../layers.js";
import { drawHaloParticle } from "../canvas-utils.js";
import { defineConstants } from "../dev/registry.js";

// ── Constants ──

const FW = defineConstants("effects.fireworks", {
  // ── Pool ──
  // Caps are sampled at module load and applied to fixed-size object pools, so
  // raising them takes effect on reload only. Defaults sized for the loudest
  // built-in launch (~rocket count × primary spawn × burst overlap) with
  // headroom for tuned-up values.
  MAX_PARTICLES: { value: 400, min: 50, max: 2000, step: 10 },
  MAX_BURSTS: 5,
  MAX_ROCKETS: { value: 16, min: 1, max: 100, step: 1 },

  // ── Primary burst ──
  PRIMARY_COUNT_MIN: 30,
  PRIMARY_COUNT_RANGE: 15,
  PRIMARY_SPEED_MIN: 2.5,
  PRIMARY_SPEED_RANGE: 4.5,
  PRIMARY_LIFE_MIN: 45,
  PRIMARY_LIFE_RANGE: 25,
  PRIMARY_RADIUS_MIN: 1.5,
  PRIMARY_RADIUS_RANGE: 1.8,

  // ── Secondary sparkles ──
  SECONDARY_CHANCE: 0.25,
  SECONDARY_COUNT_MIN: 2,
  SECONDARY_COUNT_RANGE: 3,
  SECONDARY_SPEED_MIN: 0.6,
  SECONDARY_SPEED_RANGE: 1.8,
  SECONDARY_LIFE_MIN: 18,
  SECONDARY_LIFE_RANGE: 14,
  SECONDARY_RADIUS_MIN: 0.5,
  SECONDARY_RADIUS_RANGE: 0.8,
  SECONDARY_TRIGGER_FADE: 0.5,

  // ── Rocket ──
  // Lifespan of the rising trail before it bursts. Lower values feel snappier
  // but skip the anticipatory arc; longer makes the trail more readable.
  ROCKET_LIFE_FRAMES: 60,
  ROCKET_RADIUS: 2,
  // Random horizontal target band, as fractions of viewport width.
  ROCKET_TARGET_X_MIN: 0.2,
  ROCKET_TARGET_X_RANGE: 0.6,
  // Target burst height, as fraction of viewport height from the top.
  ROCKET_TARGET_Y_MIN: 0.15,
  ROCKET_TARGET_Y_RANGE: 0.35,
  // Sideways jitter added as the rocket rises (px per frame, pre-easing).
  ROCKET_DRIFT: 0.2,
  // Default rocket counts per rarity tier; callers override via opts.count.
  ROCKET_COUNT_EPIC: { value: 3, min: 0, max: 30, step: 1 },
  ROCKET_COUNT_LEGENDARY: { value: 10, min: 0, max: 100, step: 1 },
  // Stagger between rockets in a multi-rocket launch (frames).
  ROCKET_STAGGER_FRAMES: 8,

  // ── Rocket trail ──
  ROCKET_TRAIL_LENGTH: 16,
  ROCKET_TRAIL_DECAY: 0.82,
  ROCKET_TRAIL_RADIUS_SCALE: 0.65,
  ROCKET_TRAIL_JITTER: 0.8,
  ROCKET_TRAIL_EMBER_CHANCE: 0.4,

  // ── Physics ──
  GRAVITY: 0.055,
  FRICTION: 0.977,
  WIND: 0.012,

  // ── Trail ──
  TRAIL_LENGTH: 4,
  TRAIL_DECAY: 0.6,
  TRAIL_RADIUS_SCALE: 0.5,

  // ── Rendering ──
  GLOW_RADIUS_MULT: 3.5,
  GLOW_MID_STOP: 0.4,
  GLOW_MID_OPACITY: 0.45,
  FADE_START: 0.55,

  // ── Color ──
  HUE_SHIFT_RANGE: 30,
  SATURATION_JITTER: 0.15,
  BRIGHTNESS_BOOST: 45,

  // ── Overlay ──
  DRAW_THRESHOLD: 0.01,
  OVERLAY_Z_INDEX: Z_FIREWORKS,
  CLEANUP_CHECK_INTERVAL: 10,
});

// ── Color Utilities ──

const FALLBACK_RGB = [150, 210, 255];

function parseHexToRgb(hex) {
  if (!hex || typeof hex !== "string") return null;
  const clean = hex.replace("#", "");
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  h /= 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function generateBurstPalette(baseRgb, count) {
  const [h, s, l] = rgbToHsl(baseRgb[0], baseRgb[1], baseRgb[2]);
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hShift = (Math.random() - 0.5) * FW.HUE_SHIFT_RANGE;
    const sJitter = 1 + (Math.random() - 0.5) * FW.SATURATION_JITTER;
    const newH = h + hShift;
    const newS = Math.min(1, Math.max(0, s * sJitter));
    colors.push(hslToRgb(newH, newS, l));
  }
  return colors;
}

function brightenRgb(rgb) {
  return [
    Math.min(255, rgb[0] + FW.BRIGHTNESS_BOOST),
    Math.min(255, rgb[1] + FW.BRIGHTNESS_BOOST),
    Math.min(255, rgb[2] + FW.BRIGHTNESS_BOOST),
  ];
}

// ── Particle ──

class FireworkParticle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.r = 0;
    this.opacity = 0;
    this.color = [255, 255, 255];
    this.brightColor = [255, 255, 255];
    this.life = 0;
    this.maxLife = 0;
    this.stage = "primary";
    this.hasSpawnedSecondary = false;
    // Trail ring buffer
    this.trail = new Array(FW.TRAIL_LENGTH);
    for (let i = 0; i < FW.TRAIL_LENGTH; i++) {
      this.trail[i] = { x: 0, y: 0, active: false };
    }
    this.trailIdx = 0;
  }

  spawnPrimary(x, y, color, angle, speed) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.r = FW.PRIMARY_RADIUS_MIN + Math.random() * FW.PRIMARY_RADIUS_RANGE;
    this.opacity = 1;
    this.color = color;
    this.brightColor = brightenRgb(color);
    this.life = 0;
    this.maxLife = FW.PRIMARY_LIFE_MIN + Math.random() * FW.PRIMARY_LIFE_RANGE;
    this.stage = "primary";
    this.hasSpawnedSecondary = false;
    for (let i = 0; i < FW.TRAIL_LENGTH; i++) {
      this.trail[i].active = false;
    }
    this.trailIdx = 0;
  }

  spawnSecondary(x, y, color, angle, speed) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.r =
      FW.SECONDARY_RADIUS_MIN + Math.random() * FW.SECONDARY_RADIUS_RANGE;
    this.opacity = 1;
    this.color = color;
    this.brightColor = brightenRgb(color);
    this.life = 0;
    this.maxLife =
      FW.SECONDARY_LIFE_MIN + Math.random() * FW.SECONDARY_LIFE_RANGE;
    this.stage = "secondary";
    this.hasSpawnedSecondary = true;
    for (let i = 0; i < FW.TRAIL_LENGTH; i++) {
      this.trail[i].active = false;
    }
    this.trailIdx = 0;
  }

  update() {
    if (!this.active) return false;

    // Trail: record current position before moving
    if (this.stage === "primary") {
      this.trail[this.trailIdx].x = this.x;
      this.trail[this.trailIdx].y = this.y;
      this.trail[this.trailIdx].active = true;
      this.trailIdx = (this.trailIdx + 1) % FW.TRAIL_LENGTH;
    }

    // Physics
    this.vy += FW.GRAVITY;
    this.vx += FW.WIND;
    this.vx *= FW.FRICTION;
    this.vy *= FW.FRICTION;
    this.x += this.vx;
    this.y += this.vy;

    // Life
    this.life++;
    const lifeFrac = this.life / this.maxLife;

    // Fade curve: full opacity until FADE_START, then linear fade out
    if (lifeFrac < FW.FADE_START) {
      this.opacity = 1;
    } else {
      this.opacity = 1 - (lifeFrac - FW.FADE_START) / (1 - FW.FADE_START);
    }

    // Death
    if (this.life >= this.maxLife) {
      this.active = false;
      return false;
    }
    return true;
  }

  draw(ctx) {
    if (!this.active || this.opacity < FW.DRAW_THRESHOLD) return;

    const c = this.color;
    const bc = this.brightColor;
    const op = this.opacity;

    // Draw trail for primary particles
    if (this.stage === "primary") {
      for (let i = 0; i < FW.TRAIL_LENGTH; i++) {
        const t = this.trail[i];
        if (!t.active) continue;
        // Oldest trail point has lowest opacity
        const age = (this.trailIdx - 1 - i + FW.TRAIL_LENGTH) % FW.TRAIL_LENGTH;
        const trailOp = op * Math.pow(FW.TRAIL_DECAY, age + 1);
        if (trailOp < FW.DRAW_THRESHOLD) continue;
        const tr = this.r * FW.TRAIL_RADIUS_SCALE;
        ctx.globalAlpha = trailOp;
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, tr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw particle with glow
    if (this.stage === "primary") {
      ctx.globalAlpha = 1;
      drawHaloParticle(
        ctx,
        this.x,
        this.y,
        this.r * FW.GLOW_RADIUS_MULT,
        op,
        bc,
        {
          midStop: FW.GLOW_MID_STOP,
          midAlpha: FW.GLOW_MID_OPACITY,
          midColor: c,
        },
      );
    } else {
      // Secondary: simple filled circle (skip gradient for perf)
      ctx.globalAlpha = op;
      ctx.fillStyle = `rgb(${bc[0]},${bc[1]},${bc[2]})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Rocket ──
// Flies up from the bottom of the canvas, leaves an ember trail, bursts on
// death into a standard primary burst.  Separate class because physics, trail
// size, and death handler differ from FireworkParticle.

class Rocket {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.startY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.color = [255, 255, 255];
    this.brightColor = [255, 255, 255];
    this.life = 0;
    this.maxLife = 0;
    this.delay = 0;
    this.trail = new Array(FW.ROCKET_TRAIL_LENGTH);
    for (let i = 0; i < FW.ROCKET_TRAIL_LENGTH; i++) {
      this.trail[i] = { x: 0, y: 0, active: false, ember: false };
    }
    this.trailIdx = 0;
  }

  spawn(startX, startY, targetX, targetY, color, delay) {
    this.active = true;
    this.x = startX;
    this.y = startY;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.color = color;
    this.brightColor = brightenRgb(color);
    this.life = 0;
    this.maxLife = FW.ROCKET_LIFE_FRAMES;
    this.delay = delay;
    for (let i = 0; i < FW.ROCKET_TRAIL_LENGTH; i++) {
      this.trail[i].active = false;
    }
    this.trailIdx = 0;
  }

  // Returns true if the rocket just detonated this frame.
  update() {
    if (!this.active) return false;

    if (this.delay > 0) {
      this.delay--;
      return false;
    }

    // Record current position in the trail ring buffer
    const slot = this.trail[this.trailIdx];
    slot.x = this.x + (Math.random() - 0.5) * FW.ROCKET_TRAIL_JITTER;
    slot.y = this.y;
    slot.active = true;
    slot.ember = Math.random() < FW.ROCKET_TRAIL_EMBER_CHANCE;
    this.trailIdx = (this.trailIdx + 1) % FW.ROCKET_TRAIL_LENGTH;

    // Ease-out motion: fast at launch, slow approaching the target
    this.life++;
    const t = this.life / this.maxLife;
    const eased = 1 - Math.pow(1 - t, 2);
    this.x =
      this.x +
      (this.targetX - this.x) * eased * 0.2 +
      (Math.random() - 0.5) * FW.ROCKET_DRIFT;
    this.y = this.startY + (this.targetY - this.startY) * eased;

    if (this.life >= this.maxLife) {
      this.active = false;
      return true;
    }
    return false;
  }

  draw(ctx) {
    if (!this.active || this.delay > 0) return;

    const c = this.color;
    const bc = this.brightColor;

    // Trail embers
    for (let i = 0; i < FW.ROCKET_TRAIL_LENGTH; i++) {
      const t = this.trail[i];
      if (!t.active) continue;
      const age =
        (this.trailIdx - 1 - i + FW.ROCKET_TRAIL_LENGTH) %
        FW.ROCKET_TRAIL_LENGTH;
      const op = Math.pow(FW.ROCKET_TRAIL_DECAY, age + 1);
      if (op < FW.DRAW_THRESHOLD) continue;
      const tr =
        FW.ROCKET_RADIUS * FW.ROCKET_TRAIL_RADIUS_SCALE * (t.ember ? 1.2 : 0.7);
      ctx.globalAlpha = op;
      ctx.fillStyle = t.ember
        ? `rgb(${bc[0]},${bc[1]},${bc[2]})`
        : `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, tr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rocket head — bright glowing dot
    ctx.globalAlpha = 1;
    drawHaloParticle(
      ctx,
      this.x,
      this.y,
      FW.ROCKET_RADIUS * FW.GLOW_RADIUS_MULT,
      1,
      bc,
      { midStop: FW.GLOW_MID_STOP, midAlpha: FW.GLOW_MID_OPACITY, midColor: c },
    );
  }
}

// ── Renderer Core ──

function createRendererCore() {
  // Pre-allocate particle pool
  const pool = Array.from(
    { length: FW.MAX_PARTICLES },
    () => new FireworkParticle(),
  );
  const rockets = Array.from({ length: FW.MAX_ROCKETS }, () => new Rocket());
  let activeBursts = 0;
  let frameCount = 0;

  function acquireParticle() {
    for (let i = 0; i < pool.length; i++) {
      if (!pool[i].active) return pool[i];
    }
    return null;
  }

  function acquireRocket() {
    for (let i = 0; i < rockets.length; i++) {
      if (!rockets[i].active) return rockets[i];
    }
    return null;
  }

  function spawnSecondaries(x, y, color) {
    const count =
      FW.SECONDARY_COUNT_MIN +
      Math.floor(Math.random() * FW.SECONDARY_COUNT_RANGE);
    for (let i = 0; i < count; i++) {
      const p = acquireParticle();
      if (!p) return;
      const angle = Math.random() * Math.PI * 2;
      const speed =
        FW.SECONDARY_SPEED_MIN + Math.random() * FW.SECONDARY_SPEED_RANGE;
      p.spawnSecondary(x, y, color, angle, speed);
    }
  }

  // Spawn primary particles for a burst at (x, y).  Internal — no cap check.
  function spawnBurst(x, y, rgb) {
    const count =
      FW.PRIMARY_COUNT_MIN + Math.floor(Math.random() * FW.PRIMARY_COUNT_RANGE);
    const palette = generateBurstPalette(rgb, count);
    for (let i = 0; i < count; i++) {
      const p = acquireParticle();
      if (!p) break;
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed =
        FW.PRIMARY_SPEED_MIN + Math.random() * FW.PRIMARY_SPEED_RANGE;
      p.spawnPrimary(x, y, palette[i], angle, speed);
    }
  }

  // Public burst entry — honors MAX_BURSTS so rapid click-fury bursts are
  // capped.  Rocket detonations bypass this (they're already rate-limited by
  // the rocket pool and stagger timing).
  function burst(x, y, opts = {}) {
    if (activeBursts >= FW.MAX_BURSTS) return false;
    activeBursts++;

    const baseRgb = opts.color
      ? typeof opts.color === "string"
        ? parseHexToRgb(opts.color)
        : opts.color
      : null;
    const rgb = baseRgb || FALLBACK_RGB;
    spawnBurst(x, y, rgb);
    return true;
  }

  // Launches `count` rockets from the visual bottom of the viewport.  Each
  // rises for ROCKET_LIFE_FRAMES then detonates into a standard burst at its
  // target.  Rockets are staggered by ROCKET_STAGGER_FRAMES so they don't
  // launch as a perfect line.  In upside-down theme the page is flipped via
  // CSS scaleY(-1) but the overlay canvas isn't, so we mirror the y coords
  // here to keep rockets launching from what the user sees as the bottom.
  function launchRockets(viewportWidth, viewportHeight, opts = {}) {
    const count = Math.max(1, opts.count || 1);
    const baseRgb = opts.color
      ? typeof opts.color === "string"
        ? parseHexToRgb(opts.color)
        : opts.color
      : null;
    const rgb = baseRgb || FALLBACK_RGB;

    const upsideDown = document.body.classList.contains("upside-down");
    const mirrorY = (y) => (upsideDown ? viewportHeight - y : y);

    let launched = 0;
    for (let i = 0; i < count; i++) {
      const r = acquireRocket();
      if (!r) break;
      const targetX =
        viewportWidth *
        (FW.ROCKET_TARGET_X_MIN + Math.random() * FW.ROCKET_TARGET_X_RANGE);
      const targetY = mirrorY(
        viewportHeight *
          (FW.ROCKET_TARGET_Y_MIN + Math.random() * FW.ROCKET_TARGET_Y_RANGE),
      );
      const startX = targetX + (Math.random() - 0.5) * viewportWidth * 0.15;
      const startY = mirrorY(viewportHeight + FW.ROCKET_RADIUS);
      const delay = i * FW.ROCKET_STAGGER_FRAMES;
      r.spawn(startX, startY, targetX, targetY, rgb, delay);
      launched++;
    }
    return launched > 0;
  }

  function update() {
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) continue;

      p.update();

      // Secondary spawn check
      if (
        p.stage === "primary" &&
        !p.hasSpawnedSecondary &&
        p.life / p.maxLife >= FW.SECONDARY_TRIGGER_FADE
      ) {
        p.hasSpawnedSecondary = true;
        if (Math.random() < FW.SECONDARY_CHANCE) {
          spawnSecondaries(p.x, p.y, p.color);
        }
      }
    }

    // Rockets: update and detonate on arrival.  Call spawnBurst directly to
    // bypass MAX_BURSTS — a LEGENDARY launch can have 10+ rockets in flight
    // and every one must detonate.
    for (let i = 0; i < rockets.length; i++) {
      const r = rockets[i];
      if (!r.active) continue;
      const detonated = r.update();
      if (detonated) spawnBurst(r.x, r.y, r.color);
    }
  }

  function draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < pool.length; i++) {
      pool[i].draw(ctx);
    }
    for (let i = 0; i < rockets.length; i++) {
      rockets[i].draw(ctx);
    }
    ctx.restore();
  }

  function hasActive() {
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].active) return true;
    }
    for (let i = 0; i < rockets.length; i++) {
      if (rockets[i].active) return true;
    }
    // Reset burst counter when all particles and rockets are dead
    activeBursts = 0;
    return false;
  }

  function checkCleanup() {
    frameCount++;
    if (frameCount % FW.CLEANUP_CHECK_INTERVAL !== 0) return false;
    return !hasActive();
  }

  return { burst, launchRockets, update, draw, hasActive, checkCleanup };
}

// ── Mode A: Overlay (self-cleaning) ──

let overlayCanvas = null;
let overlayCtx = null;
let overlayRenderer = null;
let overlayRafId = null;
let overlayResizeHandler = null;

function createOverlay() {
  overlayCanvas = document.createElement("canvas");
  overlayCanvas.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:${FW.OVERLAY_Z_INDEX}`;
  overlayCanvas.width = window.innerWidth;
  overlayCanvas.height = window.innerHeight;
  document.body.appendChild(overlayCanvas);

  overlayCtx = overlayCanvas.getContext("2d");
  overlayRenderer = createRendererCore();

  overlayResizeHandler = () => {
    overlayCanvas.width = window.innerWidth;
    overlayCanvas.height = window.innerHeight;
  };
  window.addEventListener("resize", overlayResizeHandler);
}

function destroyOverlay() {
  if (overlayRafId) {
    cancelAnimationFrame(overlayRafId);
    overlayRafId = null;
  }
  if (overlayResizeHandler) {
    window.removeEventListener("resize", overlayResizeHandler);
    overlayResizeHandler = null;
  }
  if (overlayCanvas && overlayCanvas.parentNode) {
    overlayCanvas.remove();
  }
  overlayCanvas = null;
  overlayCtx = null;
  overlayRenderer = null;
}

function overlayLoop() {
  if (!overlayCanvas || !overlayCtx || !overlayRenderer) return;

  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  overlayRenderer.update();
  overlayRenderer.draw(overlayCtx);

  if (overlayRenderer.checkCleanup()) {
    destroyOverlay();
    return;
  }

  overlayRafId = requestAnimationFrame(overlayLoop);
}

/**
 * Fire a one-shot fireworks burst at (x, y) using a temporary overlay canvas.
 * The overlay self-destructs when all particles have faded.
 *
 * @param {number} x - Viewport X coordinate
 * @param {number} y - Viewport Y coordinate
 * @param {object} [opts]
 * @param {string|number[]} [opts.color] - Hex string or [r,g,b] array
 */
export function burstFireworks(x, y, opts = {}) {
  if (!overlayCanvas) {
    createOverlay();
  }

  overlayRenderer.burst(x, y, opts);

  // Start animation loop if not running
  if (!overlayRafId) {
    overlayRafId = requestAnimationFrame(overlayLoop);
  }
}

/**
 * Map a rarity tier to the configured rocket count.  Callers pass the tier
 * they've identified (e.g. from an achievement's point value); the tier-to-
 * count mapping stays in the fireworks registry so dev-console changes to
 * ROCKET_COUNT_EPIC / ROCKET_COUNT_LEGENDARY apply automatically.
 *
 * @param {"epic"|"legendary"} tier
 * @returns {number} Number of rockets, or 0 for unrecognized tiers.
 */
export function rocketCountForTier(tier) {
  if (tier === "legendary") return FW.ROCKET_COUNT_LEGENDARY;
  if (tier === "epic") return FW.ROCKET_COUNT_EPIC;
  return 0;
}

/**
 * Launch one or more rockets from the bottom of the viewport.  Each rises for
 * ~1s and detonates into a standard burst at a randomized target position.
 *
 * @param {object} [opts]
 * @param {number}         [opts.count=1]  Number of rockets to launch.
 * @param {string|number[]} [opts.color]   Hex string or [r,g,b] array.
 */
export function launchRocketFireworks(opts = {}) {
  if (!overlayCanvas) {
    createOverlay();
  }

  overlayRenderer.launchRockets(
    overlayCanvas.width,
    overlayCanvas.height,
    opts,
  );

  if (!overlayRafId) {
    overlayRafId = requestAnimationFrame(overlayLoop);
  }
}

// ── Mode B: Shared Canvas Renderer ──

/**
 * Create a fireworks renderer for use in an existing render loop.
 * Call draw() each frame and burst() to trigger explosions.
 *
 * @returns {{ burst(x, y, opts?), draw(ctx, canvas, dt), hasActive() }}
 */
export function createFireworksRenderer() {
  const core = createRendererCore();

  return {
    burst(x, y, opts) {
      return core.burst(x, y, opts);
    },

    launchRockets(viewportWidth, viewportHeight, opts) {
      return core.launchRockets(viewportWidth, viewportHeight, opts);
    },

    draw(ctx) {
      core.update();
      core.draw(ctx);
    },

    hasActive() {
      return core.hasActive();
    },
  };
}
