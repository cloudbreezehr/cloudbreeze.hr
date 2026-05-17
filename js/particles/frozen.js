import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { drawHaloParticle, rgbaStr } from "../canvas-utils.js";
import { defineConstants } from "../dev/registry.js";
import { scaled, step, prefersReducedMotion } from "../motion.js";
import { Z_FROZEN_CRACKLE } from "../layers.js";

// Snowflake colors — frozen theme is the only place snow renders, so the
// palette has no dedicated entries. Kept as named tuples so the helper
// callers don't carry [r,g,b] literals inline.
const SNOW_GLOW_RGB = [200, 230, 255];
const SNOW_DOT_RGB = [220, 240, 255];

// Crackle shard colors — same source-of-truth pattern.  Cool palette
// (ice) by default, warm tint on thaw clicks where the click is fighting
// the freeze rather than feeding it.
const CRACKLE_COOL_RGB = [200, 235, 255];
const CRACKLE_WARM_RGB = [255, 220, 180];

// ── Snowflakes ──
const SNOW = defineConstants(
  "particles.snow",
  {
    RADIUS_MIN: {
      value: 1.5,
      min: 0.5,
      max: 8,
      step: 0.5,
      description: "Minimum snowflake radius",
    },
    RADIUS_RANGE: {
      value: 3,
      min: 0,
      max: 8,
      step: 0.5,
      description: "Radius variation",
    },
    FALL_MIN: {
      value: 0.3,
      min: 0,
      max: 3,
      step: 0.05,
      description: "Minimum fall speed in px/frame",
    },
    FALL_RANGE: {
      value: 0.5,
      min: 0,
      max: 3,
      step: 0.05,
      description: "Fall speed variation",
    },
    SWAY_SPEED_MIN: {
      value: 0.008,
      min: 0,
      max: 0.05,
      step: 0.001,
      description: "Minimum sway oscillation speed",
    },
    SWAY_SPEED_RANGE: {
      value: 0.012,
      min: 0,
      max: 0.05,
      step: 0.001,
      description: "Sway speed variation",
    },
    SWAY_AMP_MIN: {
      value: 0.3,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Minimum sway amplitude",
    },
    SWAY_AMP_RANGE: {
      value: 0.5,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Sway amplitude variation",
    },
    OPACITY_MIN: {
      value: 0.2,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Minimum snowflake opacity",
    },
    OPACITY_RANGE: {
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Opacity variation",
    },
    GLOW_RADIUS: {
      value: 3,
      min: 1,
      max: 10,
      step: 0.5,
      description: "Crystalline glow radius multiplier",
    },
    GLOW_OPACITY: {
      value: 0.25,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Crystalline glow peak opacity",
    },
    FRICTION: {
      value: 0.96,
      min: 0.8,
      max: 1,
      step: 0.005,
      description: "Velocity damping per frame",
    },
    REPEL_RADIUS: {
      value: 150,
      min: 30,
      max: 400,
      step: 10,
      description: "Click repulsion radius",
    },
    REPEL_DAMPEN: {
      value: 0.8,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Click repulsion strength",
    },
    ATTRACT_RADIUS: {
      value: 150,
      min: 30,
      max: 400,
      step: 10,
      description: "Drag attraction radius",
    },
    ATTRACT_STRENGTH: {
      value: 0.1,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Drag attraction force",
    },
    ATTRACT_TANGENT: {
      value: 0.6,
      min: 0,
      max: 2,
      step: 0.05,
      description: "Tangential orbit factor",
    },
    SCROLL_THRESHOLD: {
      value: 0.5,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Scroll velocity to push snow",
    },
    SCROLL_VY: {
      value: 0.03,
      min: 0,
      max: 0.2,
      step: 0.005,
      description: "Vertical scroll push factor",
    },
    SCROLL_VX: {
      value: 0.02,
      min: 0,
      max: 0.2,
      step: 0.005,
      description: "Horizontal scatter factor",
    },
    CRYSTAL_THRESHOLD: {
      value: 3,
      min: 1,
      max: 8,
      step: 0.5,
      description: "Radius above which snowflakes are crystalline",
    },
    BRANCH_RATIO: {
      value: 0.35,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Crystal branch length as ratio of arm",
    },
    BRANCH_ANGLE: {
      value: Math.PI / 4,
      min: 0,
      max: Math.PI / 2,
      step: 0.05,
      description: "Crystal branch angle in radians",
    },
  },
  { theme: "frozen" },
);

// ── Snow Globe Shake ──
const SHAKE = defineConstants(
  "particles.snowShake",
  {
    TURBULENCE: {
      value: 4,
      min: 0.5,
      max: 15,
      step: 0.5,
      description: "Shake velocity burst magnitude",
    },
    DECAY: {
      value: 0.97,
      min: 0.9,
      max: 1,
      step: 0.005,
      description: "Turbulence decay rate per frame",
    },
    OPACITY_BOOST: {
      value: 0.15,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Opacity boost during shake",
    },
  },
  { theme: "frozen" },
);

// ── Frost Crackle ──
// Sharp ice shards radiating outward from each logo click during the
// freeze/thaw activation sequence.  Pure ballistic + friction → step()
// integrates them; rotation is a per-frame angular delta wrapped in
// scaled() so reduced-motion users see static shards (or, since spawn
// is gated, none at all).
const CRACKLE = defineConstants(
  "particles.frozenCrackle",
  {
    POOL: {
      value: 96,
      min: 16,
      max: 256,
      step: 8,
      description: "Total crackle slots (shared across all clicks)",
    },
    COUNT_MIN: {
      value: 5,
      min: 1,
      max: 20,
      step: 1,
      description: "Min shards per click",
    },
    COUNT_RANGE: {
      value: 4,
      min: 0,
      max: 20,
      step: 1,
      description: "Shard count variation",
    },
    SPEED_MIN: {
      value: 2.5,
      min: 0.2,
      max: 10,
      step: 0.1,
      description: "Min spawn speed (px/frame)",
    },
    SPEED_RANGE: {
      value: 4,
      min: 0,
      max: 10,
      step: 0.1,
      description: "Spawn speed variation",
    },
    LIFE_MIN: {
      value: 50,
      min: 10,
      max: 200,
      step: 1,
      description: "Min lifetime (frames)",
    },
    LIFE_RANGE: {
      value: 30,
      min: 0,
      max: 200,
      step: 1,
      description: "Lifetime variation",
    },
    FRICTION: {
      value: 0.93,
      min: 0.5,
      max: 1,
      step: 0.005,
      description: "Per-frame velocity damping",
    },
    LEN_MIN: {
      value: 4,
      min: 1,
      max: 16,
      step: 0.5,
      description: "Min shard length (px)",
    },
    LEN_RANGE: {
      value: 4,
      min: 0,
      max: 16,
      step: 0.5,
      description: "Shard length variation",
    },
    WIDTH_FRAC: {
      value: 0.35,
      min: 0.05,
      max: 1,
      step: 0.05,
      description: "Shard half-width as fraction of length",
    },
    ROT_SPEED_MIN: {
      value: 0.04,
      min: 0,
      max: 0.5,
      step: 0.005,
      description: "Min angular spin (radians/frame)",
    },
    ROT_SPEED_RANGE: {
      value: 0.06,
      min: 0,
      max: 0.5,
      step: 0.005,
      description: "Spin variation",
    },
    ALPHA_PEAK: {
      value: 0.95,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Peak shard opacity",
    },
    FADE_HOLD: {
      value: 0.45,
      min: 0,
      max: 0.9,
      step: 0.05,
      description: "Lifetime fraction at full alpha before fading begins",
    },
    GLINT_AT: {
      value: 0.15,
      min: 0,
      max: 0.5,
      step: 0.05,
      description: "Lifetime fraction at which a brief specular glint flashes",
    },
  },
  { theme: "frozen" },
);

// ── Module-scoped canvas refs ──
let _canvas, _ctx;

class Snowflake {
  constructor() {
    this.reset(true);
  }
  reset(init) {
    this.x = Math.random() * _canvas.width;
    this.y = init ? Math.random() * _canvas.height : -10;
    this.r = SNOW.RADIUS_MIN + Math.random() * SNOW.RADIUS_RANGE;
    this.fallSpeed = SNOW.FALL_MIN + Math.random() * SNOW.FALL_RANGE;
    this.vx = 0;
    this.vy = 0;
    this.sway = Math.random() * Math.PI * 2;
    this.swaySpeed =
      SNOW.SWAY_SPEED_MIN + Math.random() * SNOW.SWAY_SPEED_RANGE;
    this.swayAmp = SNOW.SWAY_AMP_MIN + Math.random() * SNOW.SWAY_AMP_RANGE;
    this.opacity = SNOW.OPACITY_MIN + Math.random() * SNOW.OPACITY_RANGE;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.01;
  }
  update() {
    this.sway += scaled(this.swaySpeed);
    this.rotation += scaled(this.rotSpeed);
    this.x += scaled(Math.sin(this.sway) * this.swayAmp + this.vx);
    this.y += scaled(this.fallSpeed + this.vy);
    this.vx *= SNOW.FRICTION;
    this.vy *= SNOW.FRICTION;
    if (this.y > _canvas.height + 10) this.reset(false);
    if (this.x < -20) this.x += _canvas.width + 40;
    if (this.x > _canvas.width + 20) this.x -= _canvas.width + 40;
  }
  draw() {
    _ctx.save();
    _ctx.globalAlpha = this.opacity;
    if (this.r >= SNOW.CRYSTAL_THRESHOLD) {
      // Crystalline snowflake — 6 arms with branches, slow rotation
      _ctx.translate(this.x, this.y);
      _ctx.rotate(this.rotation);
      _ctx.strokeStyle = "rgba(220,240,255,1)";
      _ctx.lineWidth = 0.6;
      _ctx.lineCap = "round";
      _ctx.beginPath();
      const arm = this.r;
      const branch = arm * SNOW.BRANCH_RATIO;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const ax = Math.cos(a) * arm;
        const ay = Math.sin(a) * arm;
        _ctx.moveTo(0, 0);
        _ctx.lineTo(ax, ay);
        // Two branches at 2/3 along the arm
        const mx = Math.cos(a) * arm * 0.6;
        const my = Math.sin(a) * arm * 0.6;
        _ctx.moveTo(mx, my);
        _ctx.lineTo(
          mx + Math.cos(a + SNOW.BRANCH_ANGLE) * branch,
          my + Math.sin(a + SNOW.BRANCH_ANGLE) * branch,
        );
        _ctx.moveTo(mx, my);
        _ctx.lineTo(
          mx + Math.cos(a - SNOW.BRANCH_ANGLE) * branch,
          my + Math.sin(a - SNOW.BRANCH_ANGLE) * branch,
        );
      }
      _ctx.stroke();
      // Subtle glow for larger crystalline flakes
      drawHaloParticle(
        _ctx,
        0,
        0,
        this.r * SNOW.GLOW_RADIUS,
        SNOW.GLOW_OPACITY,
        SNOW_GLOW_RGB,
      );
    } else {
      // Small flakes — simple glowing dots
      _ctx.fillStyle = rgbaStr(SNOW_DOT_RGB, 1);
      _ctx.beginPath();
      _ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      _ctx.fill();
    }
    _ctx.restore();
  }
}

// ── Frost shard ──
// Slim triangular ice splinter flung outward from a logo click.  Pure
// vx/vy + friction is exactly the shape step() integrates.  Rotation
// is a separate angular delta — also motion, also wrapped via scaled().

export class Crackle {
  constructor() {
    this.active = false;
  }
  spawn(x, y, warm) {
    this.x = x;
    this.y = y;
    // Radial scatter — full 2π.  No upward bias: shards fly the way
    // physics flings them, not toward any narrative direction.
    const angle = Math.random() * Math.PI * 2;
    const speed = CRACKLE.SPEED_MIN + Math.random() * CRACKLE.SPEED_RANGE;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    // Shard orientation tracks travel direction at spawn — looks like
    // it was flung from the impact rather than randomly oriented.
    this.rotation = angle;
    this.rotSpeed =
      (Math.random() < 0.5 ? -1 : 1) *
      (CRACKLE.ROT_SPEED_MIN + Math.random() * CRACKLE.ROT_SPEED_RANGE);
    this.len = CRACKLE.LEN_MIN + Math.random() * CRACKLE.LEN_RANGE;
    this.life = 0;
    this.maxLife = CRACKLE.LIFE_MIN + Math.random() * CRACKLE.LIFE_RANGE;
    this.warm = warm;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.life++;
    if (this.life > this.maxLife) {
      this.active = false;
      return;
    }
    step(this, 1, CRACKLE.FRICTION);
    this.rotation += scaled(this.rotSpeed);
  }
  draw(ctx) {
    if (!this.active) return;
    const t = this.life / this.maxLife;
    const alpha =
      t < CRACKLE.FADE_HOLD
        ? CRACKLE.ALPHA_PEAK
        : CRACKLE.ALPHA_PEAK *
          (1 - (t - CRACKLE.FADE_HOLD) / (1 - CRACKLE.FADE_HOLD));
    const rgb = this.warm ? CRACKLE_WARM_RGB : CRACKLE_COOL_RGB;
    const halfW = this.len * CRACKLE.WIDTH_FRAC;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgbaStr(rgb, 1);
    // Slim diamond — point forward at +len/2, point back at -len/2,
    // narrow waist at the centre.  Reads as "shard" rather than "dot".
    ctx.beginPath();
    ctx.moveTo(this.len / 2, 0);
    ctx.lineTo(0, halfW);
    ctx.lineTo(-this.len / 2, 0);
    ctx.lineTo(0, -halfW);
    ctx.closePath();
    ctx.fill();
    // Brief specular glint near spawn — a thin white highlight along
    // the leading edge that fades quickly.  Sells "ice catches the light".
    if (t < CRACKLE.GLINT_AT) {
      const glintAlpha = alpha * (1 - t / CRACKLE.GLINT_AT);
      ctx.globalAlpha = glintAlpha;
      ctx.strokeStyle = "rgba(255,255,255,1)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(this.len / 2, 0);
      ctx.lineTo(0, halfW);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ── Factory ──

export function createSnow(canvasEl, ctxEl, count) {
  _canvas = canvasEl;
  _ctx = ctxEl;

  const snowflakes = Array.from({ length: count }, () => new Snowflake());
  const crackles = Array.from({ length: CRACKLE.POOL }, () => new Crackle());

  // Crackles must render during the click-count build-up sequence, not
  // just while the theme is active — that's the whole point of the
  // per-click feedback.  The canvas hook only fires while body.frozen
  // is set, so crackles get their own overlay canvas + rAF that runs
  // independent of the main render loop.  rAF self-suspends when the
  // pool is empty and re-arms on the next spawn.
  //
  // If getContext("2d") returns null in any environment, the rest of
  // the crackle path becomes a no-op: spawn skips, the rAF never runs,
  // cleanup leaves nothing to clear.
  const crackleCanvas = document.createElement("canvas");
  crackleCanvas.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:${Z_FROZEN_CRACKLE}`;
  crackleCanvas.width = window.innerWidth;
  crackleCanvas.height = window.innerHeight;
  document.body.appendChild(crackleCanvas);
  const crackleCtx = crackleCanvas.getContext("2d");
  if (crackleCtx) {
    window.addEventListener("resize", () => {
      crackleCanvas.width = window.innerWidth;
      crackleCanvas.height = window.innerHeight;
    });
  }

  let crackleRaf = null;
  function crackleTick() {
    crackleCtx.clearRect(0, 0, crackleCanvas.width, crackleCanvas.height);
    let anyActive = false;
    for (const c of crackles) {
      c.update();
      c.draw(crackleCtx);
      if (c.active) anyActive = true;
    }
    crackleRaf = anyActive ? requestAnimationFrame(crackleTick) : null;
  }
  function ensureCrackleRunning() {
    if (!crackleCtx) return;
    if (crackleRaf === null) {
      crackleRaf = requestAnimationFrame(crackleTick);
    }
  }

  return {
    draw(forces, scrollVelocity, snowTurbulence) {
      // Snow globe turbulence — burst then decay
      if (snowTurbulence.value > 0.01) {
        snowflakes.forEach((s) => {
          s.vx +=
            (Math.random() - 0.5) * SHAKE.TURBULENCE * snowTurbulence.value;
          s.vy +=
            (Math.random() - 0.5) * SHAKE.TURBULENCE * snowTurbulence.value;
          s.opacity = Math.min(
            1,
            s.opacity + SHAKE.OPACITY_BOOST * snowTurbulence.value,
          );
        });
        snowTurbulence.value *= SHAKE.DECAY;
      }
      snowflakes.forEach((s) => {
        s.update();
        applyRepulsion(forces, s, SNOW.REPEL_RADIUS, SNOW.REPEL_DAMPEN);
        applyAttraction(
          forces,
          s,
          SNOW.ATTRACT_RADIUS,
          SNOW.ATTRACT_STRENGTH,
          SNOW.ATTRACT_TANGENT,
        );
        applyWellForce(forces, s);
        // Scroll pushes snowflakes
        if (Math.abs(scrollVelocity) > SNOW.SCROLL_THRESHOLD) {
          s.vy -= scrollVelocity * SNOW.SCROLL_VY;
          s.vx +=
            (Math.random() - 0.5) * Math.abs(scrollVelocity) * SNOW.SCROLL_VX;
        }
        s.draw();
      });
    },

    clickCrackle(x, y, warm) {
      // Discrete burst — gated on the OS preference rather than dampened.
      if (prefersReducedMotion()) return;
      // Skip the spawn entirely when the overlay can't render — there's
      // no point filling the pool with particles that will never be drawn.
      if (!crackleCtx) return;
      const count =
        CRACKLE.COUNT_MIN + Math.floor(Math.random() * CRACKLE.COUNT_RANGE);
      for (let i = 0; i < count; i++) {
        const c = crackles.find((c) => !c.active);
        if (!c) break;
        c.spawn(x, y, warm);
      }
      ensureCrackleRunning();
    },

    cleanup() {
      for (const c of crackles) c.active = false;
      if (crackleRaf !== null) {
        cancelAnimationFrame(crackleRaf);
        crackleRaf = null;
      }
      if (crackleCtx) {
        crackleCtx.clearRect(0, 0, crackleCanvas.width, crackleCanvas.height);
      }
    },
  };
}
