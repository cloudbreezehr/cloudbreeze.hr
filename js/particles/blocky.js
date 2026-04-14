import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";

// ── Blocky Pixelation ──
const PIXEL_SCALE = 6;

// ── Fireflies (Blocky mode) ──
const FIREFLY_RADIUS = 2; // drawn at pixel-scale after pixelation
const FIREFLY_PULSE_MIN = 0.3;
const FIREFLY_PULSE_SPEED_MIN = 0.01;
const FIREFLY_PULSE_SPEED_RANGE = 0.02;
const FIREFLY_DRIFT = 0.3; // random walk velocity per frame
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
const FIREFLY_ATTRACT_TANGENT = 0.3;

// ── Butterflies (Blocky light mode) ──
const BUTTERFLY_COLORS = [
  [255, 80, 80], // red
  [80, 120, 255], // blue
  [255, 220, 60], // yellow
  [180, 80, 255], // purple
];
const BUTTERFLY_FLAP_SPEED = 0.08;
const BUTTERFLY_OPACITY = 0.8;

// ── Block Fragments (Blocky click effect) ──
const BLOCK_FRAG_COUNT_MIN = 8;
const BLOCK_FRAG_COUNT_RANGE = 5;
const BLOCK_FRAG_SIZE = 3; // pixel block size at display scale
const BLOCK_FRAG_SPEED_MIN = 2;
const BLOCK_FRAG_SPEED_RANGE = 4;
const BLOCK_FRAG_GRAVITY = 0.12;
const BLOCK_FRAG_LIFE = 48; // ~800ms at 60fps
const BLOCK_FRAG_TUMBLE_INTERVAL = 9; // frames between 90° rotations
const BLOCK_FRAG_MAX = 80; // pool cap for block fragments
const BLOCK_FRAG_VY_OFFSET = -1.5;
const BLOCK_FRAG_COLORS = [
  [80, 120, 200],
  [100, 140, 220],
  [60, 100, 180],
];

// ── Firefly upward bias ──
const FIREFLY_BIAS_THRESHOLD = 0.7; // fraction of canvas height triggering upward bias
const FIREFLY_BIAS_STRENGTH = 0.02;
const FIREFLY_WRAP_MARGIN = 20;
const FIREFLY_CEIL_FRACTION = 0.3;
const FIREFLY_CEIL_OFFSET = 10;
const FIREFLY_FLOOR_OFFSET = 10;
const FIREFLY_WING_PIXEL = 2;
const FIREFLY_WING_SPREAD_THRESHOLD = 0.3;

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
      FIREFLY_PULSE_SPEED_MIN + Math.random() * FIREFLY_PULSE_SPEED_RANGE;
    this.opacity = FIREFLY_OPACITY_MIN + Math.random() * FIREFLY_OPACITY_RANGE;
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
    this.flapPhase += BUTTERFLY_FLAP_SPEED;
    // Random walk
    this.vx += (Math.random() - 0.5) * FIREFLY_DRIFT;
    this.vy += (Math.random() - 0.5) * FIREFLY_DRIFT;
    // Slight upward bias near bottom of canvas
    if (this.y > _canvas.height * FIREFLY_BIAS_THRESHOLD) {
      this.vy -= FIREFLY_BIAS_STRENGTH;
    }
    this.vx *= FIREFLY_FRICTION;
    this.vy *= FIREFLY_FRICTION;
    this.x += this.vx;
    this.y += this.vy;
    // Wrap
    if (this.x < -FIREFLY_WRAP_MARGIN)
      this.x += _canvas.width + FIREFLY_WRAP_MARGIN * 2;
    if (this.x > _canvas.width + FIREFLY_WRAP_MARGIN)
      this.x -= _canvas.width + FIREFLY_WRAP_MARGIN * 2;
    if (this.y < _canvas.height * FIREFLY_CEIL_FRACTION)
      this.y = _canvas.height * FIREFLY_CEIL_FRACTION + FIREFLY_CEIL_OFFSET;
    if (this.y > _canvas.height + FIREFLY_FLOOR_OFFSET) this.reset(false);
  }
  drawFirefly(targetCtx) {
    const pulse =
      FIREFLY_PULSE_MIN +
      (1 - FIREFLY_PULSE_MIN) * (0.5 + 0.5 * Math.sin(this.phase));
    const op = this.opacity * pulse;
    // Pick color: mostly warm yellow, rare green or orange
    let c = FIREFLY_COLOR;
    if (this.colorVariant > 0.92)
      c = [100, 255, 80]; // green
    else if (this.colorVariant > 0.85) c = [255, 180, 50]; // orange

    // Bright pixel core
    targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${op.toFixed(3)})`;
    targetCtx.fillRect(
      Math.round(this.x) - 1,
      Math.round(this.y) - 1,
      FIREFLY_RADIUS,
      FIREFLY_RADIUS,
    );

    // Trail — dim pixel at previous position
    const trailOp = op * FIREFLY_TRAIL_ALPHA;
    if (trailOp > 0.02) {
      targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${trailOp.toFixed(3)})`;
      targetCtx.fillRect(
        Math.round(this.prevX) - 1,
        Math.round(this.prevY) - 1,
        FIREFLY_RADIUS,
        FIREFLY_RADIUS,
      );
    }
  }
  drawButterfly(targetCtx) {
    const c = this.butterflyColor;
    const op = this.opacity * BUTTERFLY_OPACITY;
    const flap = Math.sin(this.flapPhase);
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    const s = FIREFLY_WING_PIXEL;

    targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${op.toFixed(3)})`;
    // Body
    targetCtx.fillRect(px, py, s, s);
    // Wings — spread depends on flap phase
    const wingSpread = Math.abs(flap);
    if (wingSpread > FIREFLY_WING_SPREAD_THRESHOLD) {
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
    pixelCanvas.width = Math.ceil(_canvas.width / PIXEL_SCALE);
    pixelCanvas.height = Math.ceil(_canvas.height / PIXEL_SCALE);
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
        if (f.life > BLOCK_FRAG_LIFE) {
          blockFragments.splice(i, 1);
          continue;
        }
        f.x += f.vx;
        f.y += f.vy;
        f.vy += BLOCK_FRAG_GRAVITY;
        // Hard 90° tumble
        if (f.life % BLOCK_FRAG_TUMBLE_INTERVAL === 0) f.rot = (f.rot + 1) % 4;
        const c = f.color;
        _ctx.save();
        _ctx.translate(f.x, f.y);
        _ctx.rotate((f.rot * Math.PI) / 2);
        _ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        _ctx.fillRect(
          -BLOCK_FRAG_SIZE / 2,
          -BLOCK_FRAG_SIZE / 2,
          BLOCK_FRAG_SIZE,
          BLOCK_FRAG_SIZE,
        );
        _ctx.restore();
      }

      // Fireflies / Butterflies — rendered crisp post-pixelation
      fireflies.forEach((f) => {
        f.update();
        applyRepulsion(forces, f, FIREFLY_REPEL_RADIUS, FIREFLY_REPEL_DAMPEN);
        applyAttraction(
          forces,
          f,
          FIREFLY_ATTRACT_RADIUS,
          FIREFLY_ATTRACT_STRENGTH,
          FIREFLY_ATTRACT_TANGENT,
        );
        applyWellForce(forces, f);
        if (Math.abs(scrollVelocity) > FIREFLY_SCROLL_THRESHOLD) {
          f.vx += scrollVelocity * FIREFLY_SCROLL_VX;
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
        BLOCK_FRAG_COUNT_MIN +
        Math.floor(Math.random() * BLOCK_FRAG_COUNT_RANGE);
      for (
        let i = 0;
        i < fragCount && blockFragments.length < BLOCK_FRAG_MAX;
        i++
      ) {
        const angle = Math.random() * Math.PI * 2;
        const speed =
          BLOCK_FRAG_SPEED_MIN + Math.random() * BLOCK_FRAG_SPEED_RANGE;
        blockFragments.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + BLOCK_FRAG_VY_OFFSET,
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
