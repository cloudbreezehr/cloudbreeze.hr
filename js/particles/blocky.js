import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { defineConstants } from "../dev/registry.js";

// ── Blocky Pixelation ──
const PIXEL = defineConstants(
  "particles.blocky",
  {
    SCALE: {
      value: 6,
      min: 2,
      max: 20,
      step: 1,
      description: "Pixel block size for pixelation effect",
    },
  },
  { mode: "blocky" },
);

// ── Fireflies (Blocky mode) ──
const FLY = defineConstants(
  "particles.fireflies",
  {
    RADIUS: {
      value: 2,
      min: 1,
      max: 8,
      step: 1,
      description: "Firefly core pixel size",
    },
    PULSE_MIN: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Minimum pulse brightness",
    },
    PULSE_SPEED_MIN: {
      value: 0.01,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Minimum pulse animation speed",
    },
    PULSE_SPEED_RANGE: {
      value: 0.02,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Pulse speed variation",
    },
    DRIFT: {
      value: 0.3,
      min: 0,
      max: 2,
      step: 0.05,
      description: "Random walk velocity per frame",
    },
    FRICTION: {
      value: 0.96,
      min: 0.8,
      max: 1,
      step: 0.005,
      description: "Velocity damping per frame",
    },
    OPACITY_MIN: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Minimum opacity",
    },
    OPACITY_RANGE: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Opacity variation",
    },
    REPEL_RADIUS: {
      value: 120,
      min: 30,
      max: 400,
      step: 10,
      description: "Click repulsion radius",
    },
    REPEL_DAMPEN: {
      value: 1.2,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Click repulsion strength",
    },
    ATTRACT_RADIUS: {
      value: 180,
      min: 30,
      max: 500,
      step: 10,
      description: "Drag attraction radius",
    },
    ATTRACT_STRENGTH: {
      value: 0.15,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Drag attraction force",
    },
    SCROLL_VX: {
      value: 0.02,
      min: 0,
      max: 0.2,
      step: 0.005,
      description: "Horizontal push from scroll",
    },
    SCROLL_THRESHOLD: {
      value: 0.5,
      min: 0,
      max: 3,
      step: 0.1,
      description: "Scroll velocity to push fireflies",
    },
    COLOR: [255, 240, 100],
    TRAIL_ALPHA: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Trail pixel opacity multiplier",
    },
    ATTRACT_TANGENT: {
      value: 0.3,
      min: 0,
      max: 2,
      step: 0.05,
      description: "Tangential orbit factor",
    },
    BIAS_THRESHOLD: {
      value: 0.7,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Canvas fraction triggering upward bias",
    },
    BIAS_STRENGTH: {
      value: 0.02,
      min: 0,
      max: 0.1,
      step: 0.005,
      description: "Upward bias force near bottom",
    },
    WRAP_MARGIN: {
      value: 20,
      min: 5,
      max: 60,
      step: 5,
      description: "Offscreen wrap margin",
    },
    CEIL_FRACTION: {
      value: 0.3,
      min: 0,
      max: 0.8,
      step: 0.05,
      description: "Upper boundary as fraction of canvas",
    },
    CEIL_OFFSET: {
      value: 10,
      min: 0,
      max: 50,
      step: 5,
      description: "Pixels below ceiling boundary",
    },
    FLOOR_OFFSET: {
      value: 10,
      min: 0,
      max: 50,
      step: 5,
      description: "Pixels below floor to trigger respawn",
    },
    WING_PIXEL: {
      value: 2,
      min: 1,
      max: 6,
      step: 1,
      description: "Butterfly wing pixel size",
    },
    WING_SPREAD_THRESHOLD: {
      value: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Flap threshold for spread wings",
    },
  },
  { mode: "blocky" },
);

// ── Butterflies (Blocky light mode) ──
const BUTTERFLY_COLORS = [
  [255, 80, 80], // red
  [80, 120, 255], // blue
  [255, 220, 60], // yellow
  [180, 80, 255], // purple
];

const BFLY = defineConstants(
  "particles.butterflies",
  {
    FLAP_SPEED: {
      value: 0.08,
      min: 0.01,
      max: 0.3,
      step: 0.01,
      description: "Wing flap animation speed",
    },
    OPACITY: {
      value: 0.8,
      min: 0,
      max: 1,
      step: 0.01,
      description: "Butterfly opacity",
    },
  },
  { mode: "blocky" },
);

// ── Block Fragments (Blocky click effect) ──
const FRAG = defineConstants(
  "particles.blockFragments",
  {
    COUNT_MIN: {
      value: 8,
      min: 1,
      max: 30,
      step: 1,
      description: "Minimum fragments per click",
    },
    COUNT_RANGE: {
      value: 5,
      min: 0,
      max: 20,
      step: 1,
      description: "Fragment count variation",
    },
    SIZE: {
      value: 3,
      min: 1,
      max: 10,
      step: 1,
      description: "Fragment block size at display scale",
    },
    SPEED_MIN: {
      value: 2,
      min: 0.5,
      max: 15,
      step: 0.5,
      description: "Minimum burst speed",
    },
    SPEED_RANGE: {
      value: 4,
      min: 0,
      max: 15,
      step: 0.5,
      description: "Speed variation",
    },
    GRAVITY: {
      value: 0.12,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Downward acceleration",
    },
    LIFE: {
      value: 48,
      min: 10,
      max: 120,
      step: 1,
      description: "Fragment lifetime in frames",
    },
    TUMBLE_INTERVAL: {
      value: 9,
      min: 2,
      max: 30,
      step: 1,
      description: "Frames between 90-degree rotations",
    },
    MAX: {
      value: 80,
      min: 10,
      max: 200,
      step: 5,
      description: "Maximum fragments in pool",
    },
    VY_OFFSET: {
      value: -1.5,
      min: -5,
      max: 0,
      step: 0.1,
      description: "Initial upward velocity offset",
    },
  },
  { mode: "blocky" },
);

const BLOCK_FRAG_COLORS = [
  [80, 120, 200],
  [100, 140, 220],
  [60, 100, 180],
];

// ── Module-scoped canvas refs ──
let _canvas, _ctx;

class Firefly {
  constructor() {
    this.reset(true);
  }
  reset(init) {
    this.x = Math.random() * _canvas.width;
    this.y = init
      ? _canvas.height * (0.5 + Math.random() * 0.5)
      : _canvas.height * (0.6 + Math.random() * 0.4);
    this.vx = 0;
    this.vy = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.pulseSpeed =
      FLY.PULSE_SPEED_MIN + Math.random() * FLY.PULSE_SPEED_RANGE;
    this.opacity = FLY.OPACITY_MIN + Math.random() * FLY.OPACITY_RANGE;
    this.colorVariant = Math.random(); // 0-1: determines rare color variants
    this.prevX = this.x;
    this.prevY = this.y;
    // Butterfly state (light mode)
    this.flapPhase = Math.random() * Math.PI * 2;
    this.butterflyColor =
      BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)];
  }
  update() {
    this.prevX = this.x;
    this.prevY = this.y;
    this.phase += this.pulseSpeed;
    this.flapPhase += BFLY.FLAP_SPEED;
    // Random walk
    this.vx += (Math.random() - 0.5) * FLY.DRIFT;
    this.vy += (Math.random() - 0.5) * FLY.DRIFT;
    // Slight upward bias near bottom of canvas
    if (this.y > _canvas.height * FLY.BIAS_THRESHOLD) {
      this.vy -= FLY.BIAS_STRENGTH;
    }
    this.vx *= FLY.FRICTION;
    this.vy *= FLY.FRICTION;
    this.x += this.vx;
    this.y += this.vy;
    // Wrap
    if (this.x < -FLY.WRAP_MARGIN)
      this.x += _canvas.width + FLY.WRAP_MARGIN * 2;
    if (this.x > _canvas.width + FLY.WRAP_MARGIN)
      this.x -= _canvas.width + FLY.WRAP_MARGIN * 2;
    if (this.y < _canvas.height * FLY.CEIL_FRACTION)
      this.y = _canvas.height * FLY.CEIL_FRACTION + FLY.CEIL_OFFSET;
    if (this.y > _canvas.height + FLY.FLOOR_OFFSET) this.reset(false);
  }
  drawFirefly(targetCtx) {
    const pulse =
      FLY.PULSE_MIN + (1 - FLY.PULSE_MIN) * (0.5 + 0.5 * Math.sin(this.phase));
    const op = this.opacity * pulse;
    // Pick color: mostly warm yellow, rare green or orange
    let c = FLY.COLOR;
    if (this.colorVariant > 0.92)
      c = [100, 255, 80]; // green
    else if (this.colorVariant > 0.85) c = [255, 180, 50]; // orange

    // Bright pixel core
    targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${op.toFixed(3)})`;
    targetCtx.fillRect(
      Math.round(this.x) - 1,
      Math.round(this.y) - 1,
      FLY.RADIUS,
      FLY.RADIUS,
    );

    // Trail — dim pixel at previous position
    const trailOp = op * FLY.TRAIL_ALPHA;
    if (trailOp > 0.02) {
      targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${trailOp.toFixed(3)})`;
      targetCtx.fillRect(
        Math.round(this.prevX) - 1,
        Math.round(this.prevY) - 1,
        FLY.RADIUS,
        FLY.RADIUS,
      );
    }
  }
  drawButterfly(targetCtx) {
    const c = this.butterflyColor;
    const op = this.opacity * BFLY.OPACITY;
    const flap = Math.sin(this.flapPhase);
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    const s = FLY.WING_PIXEL;

    targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${op.toFixed(3)})`;
    // Body
    targetCtx.fillRect(px, py, s, s);
    // Wings — spread depends on flap phase
    const wingSpread = Math.abs(flap);
    if (wingSpread > FLY.WING_SPREAD_THRESHOLD) {
      targetCtx.fillRect(px - s * 2, py - s, s * 2, s * 2); // left wing
      targetCtx.fillRect(px + s, py - s, s * 2, s * 2); // right wing
    } else {
      targetCtx.fillRect(px - s, py, s, s); // folded left
      targetCtx.fillRect(px + s, py, s, s); // folded right
    }
  }
}

// ── Factory ──

export function createBlocky(canvasEl, ctxEl, fireflyCount) {
  _canvas = canvasEl;
  _ctx = ctxEl;

  const fireflies = Array.from({ length: fireflyCount }, () => new Firefly());
  const blockFragments = [];

  // Offscreen canvas for pixelation post-process
  let pixelCanvas = document.createElement("canvas");
  let pixelCtx = pixelCanvas.getContext("2d");

  function resizePixelCanvas() {
    pixelCanvas.width = Math.ceil(_canvas.width / PIXEL.SCALE);
    pixelCanvas.height = Math.ceil(_canvas.height / PIXEL.SCALE);
  }
  resizePixelCanvas();

  return {
    draw(forces, scrollVelocity, isDarkMode) {
      // Pixelation post-process: downsample then scale back up
      const pw = pixelCanvas.width;
      const ph = pixelCanvas.height;
      pixelCtx.clearRect(0, 0, pw, ph);
      pixelCtx.drawImage(_canvas, 0, 0, pw, ph);
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      _ctx.imageSmoothingEnabled = false;
      _ctx.drawImage(pixelCanvas, 0, 0, _canvas.width, _canvas.height);
      _ctx.imageSmoothingEnabled = true;

      // Block fragments — update and draw
      for (let i = blockFragments.length - 1; i >= 0; i--) {
        const f = blockFragments[i];
        f.life++;
        if (f.life > FRAG.LIFE) {
          blockFragments.splice(i, 1);
          continue;
        }
        f.x += f.vx;
        f.y += f.vy;
        f.vy += FRAG.GRAVITY;
        // Hard 90° tumble
        if (f.life % FRAG.TUMBLE_INTERVAL === 0) f.rot = (f.rot + 1) % 4;
        const c = f.color;
        _ctx.save();
        _ctx.translate(f.x, f.y);
        _ctx.rotate((f.rot * Math.PI) / 2);
        _ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        _ctx.fillRect(-FRAG.SIZE / 2, -FRAG.SIZE / 2, FRAG.SIZE, FRAG.SIZE);
        _ctx.restore();
      }

      // Fireflies / Butterflies — rendered crisp post-pixelation
      fireflies.forEach((f) => {
        f.update();
        applyRepulsion(forces, f, FLY.REPEL_RADIUS, FLY.REPEL_DAMPEN);
        applyAttraction(
          forces,
          f,
          FLY.ATTRACT_RADIUS,
          FLY.ATTRACT_STRENGTH,
          FLY.ATTRACT_TANGENT,
        );
        applyWellForce(forces, f);
        if (Math.abs(scrollVelocity) > FLY.SCROLL_THRESHOLD) {
          f.vx += scrollVelocity * FLY.SCROLL_VX;
        }
        if (isDarkMode) {
          f.drawFirefly(_ctx);
        } else {
          f.drawButterfly(_ctx);
        }
      });
    },

    clickBurst(cx, cy) {
      const fragCount =
        FRAG.COUNT_MIN + Math.floor(Math.random() * FRAG.COUNT_RANGE);
      for (let i = 0; i < fragCount && blockFragments.length < FRAG.MAX; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = FRAG.SPEED_MIN + Math.random() * FRAG.SPEED_RANGE;
        blockFragments.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + FRAG.VY_OFFSET,
          color:
            BLOCK_FRAG_COLORS[
              Math.floor(Math.random() * BLOCK_FRAG_COLORS.length)
            ],
          life: 0,
          rot: 0,
        });
      }
    },

    resizePixelCanvas,
  };
}
