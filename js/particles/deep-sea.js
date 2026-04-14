import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";

// ── Bubbles ──
const BUBBLE_RADIUS_MIN = 2;
const BUBBLE_RADIUS_RANGE = 12;
const BUBBLE_RISE_MIN = 0.4;
const BUBBLE_RISE_RANGE = 0.8;
const BUBBLE_WOBBLE_SPEED_MIN = 0.015;
const BUBBLE_WOBBLE_SPEED_RANGE = 0.02;
const BUBBLE_WOBBLE_AMP_MIN = 0.4;
const BUBBLE_WOBBLE_AMP_RANGE = 0.8;
const BUBBLE_OPACITY_MIN = 0.3;
const BUBBLE_OPACITY_RANGE = 0.4;
const BUBBLE_GROWTH_RATE = 0.001;
const BUBBLE_FRICTION = 0.96;
const BUBBLE_REPEL_RADIUS = 150;
const BUBBLE_REPEL_DAMPEN = 0.8;
const BUBBLE_ATTRACT_RADIUS = 150;
const BUBBLE_ATTRACT_STRENGTH = 0.1;
const BUBBLE_ATTRACT_TANGENT = 0.6;
const BUBBLE_SCROLL_THRESHOLD = 0.5;
const BUBBLE_SCROLL_VX = 0.03;
const BUBBLE_AMBIENT_RATE = 2.5;
const BUBBLE_CLICK_BURST_MIN = 8;
const BUBBLE_CLICK_BURST_RANGE = 8;
const BUBBLE_DRAG_RATE = 0.3;
const BUBBLE_SPECULAR_THRESHOLD = 5;
const BUBBLE_LARGE_THRESHOLD = 9;
const BUBBLE_POP_FRAMES = 8;

// ── Jellyfish ──
const JELLY_BELL_MIN = 8;
const JELLY_BELL_RANGE = 27;
const JELLY_TENTACLE_SMALL = 3;
const JELLY_TENTACLE_MED = 4;
const JELLY_TENTACLE_LARGE = 5;
const JELLY_TENTACLE_MED_THRESHOLD = 15;
const JELLY_TENTACLE_LARGE_THRESHOLD = 25;
const JELLY_PULSE_SPEED_MIN = 0.008;
const JELLY_PULSE_SPEED_RANGE = 0.008;
const JELLY_PULSE_STRENGTH = 0.6;
const JELLY_DRIFT_VX = 0.15;
const JELLY_DRIFT_VY = 0.05;
const JELLY_DIRECTION_CHANGE = 0.002;
const JELLY_GLOW_PULSE_SPEED = 0.02;
const JELLY_GLOW_ALPHA_MIN = 0.06;
const JELLY_GLOW_ALPHA_RANGE = 0.08;
const JELLY_FRICTION = 0.985;
const JELLY_REPEL_RADIUS = 180;
const JELLY_REPEL_DAMPEN = 0.3;
const JELLY_ATTRACT_RADIUS = 200;
const JELLY_ATTRACT_STRENGTH = 0.04;
const JELLY_TENTACLE_SEGMENTS = 4;
const JELLY_TENTACLE_SEG_LEN_RATIO = 0.8;
const JELLY_TENTACLE_WAVE_AMP = 0.3;
const JELLY_TENTACLE_WAVE_SPEED = 0.03;
const JELLY_COLORS = [
  [0, 255, 180], // teal
  [0, 200, 255], // cyan
  [100, 255, 200], // green
  [180, 150, 255], // soft purple
  [0, 230, 200], // cyan-green
];

// ── Module-scoped canvas refs ──
let _canvas, _ctx;

class Bubble {
  constructor() {
    this.reset(true);
  }
  reset(init) {
    this.x = Math.random() * _canvas.width;
    this.y = init ? Math.random() * _canvas.height : _canvas.height + 10;
    this.baseR = BUBBLE_RADIUS_MIN + Math.random() * BUBBLE_RADIUS_RANGE;
    this.r = this.baseR;
    this.riseSpeed =
      BUBBLE_RISE_MIN +
      (this.baseR / (BUBBLE_RADIUS_MIN + BUBBLE_RADIUS_RANGE)) *
        BUBBLE_RISE_RANGE;
    this.vx = 0;
    this.vy = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed =
      BUBBLE_WOBBLE_SPEED_MIN + Math.random() * BUBBLE_WOBBLE_SPEED_RANGE;
    this.wobbleAmp =
      BUBBLE_WOBBLE_AMP_MIN + Math.random() * BUBBLE_WOBBLE_AMP_RANGE;
    this.opacity = BUBBLE_OPACITY_MIN + Math.random() * BUBBLE_OPACITY_RANGE;
    this.popping = false;
    this.popFrame = 0;
    this.active = init;
  }
  update() {
    if (this.popping) {
      this.popFrame++;
      if (this.popFrame > BUBBLE_POP_FRAMES) {
        this.reset(false);
        this.active = false;
        return;
      }
      this.r = this.baseR * (1 + (this.popFrame / BUBBLE_POP_FRAMES) * 0.5);
      this.opacity =
        (BUBBLE_OPACITY_MIN + BUBBLE_OPACITY_RANGE) *
        (1 - this.popFrame / BUBBLE_POP_FRAMES);
      return;
    }
    this.wobble += this.wobbleSpeed;
    this.r += BUBBLE_GROWTH_RATE;
    this.x += Math.sin(this.wobble) * this.wobbleAmp + this.vx;
    this.y += -this.riseSpeed + this.vy;
    this.vx *= BUBBLE_FRICTION;
    this.vy *= BUBBLE_FRICTION;
    // Pop at top
    if (this.y < -this.r) {
      this.popping = true;
      this.popFrame = 0;
      this.y = this.r;
      return;
    }
    // Wrap horizontal
    if (this.x < -20) this.x += _canvas.width + 40;
    if (this.x > _canvas.width + 20) this.x -= _canvas.width + 40;
  }
  draw() {
    if (!this.active) return;
    _ctx.save();
    _ctx.globalAlpha = this.opacity;

    // Thin ring outline
    _ctx.strokeStyle = "rgba(180,255,230,0.5)";
    _ctx.lineWidth = 0.6;
    _ctx.beginPath();
    _ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    _ctx.stroke();

    // Very faint fill
    _ctx.fillStyle = "rgba(0,255,200,0.04)";
    _ctx.fill();

    // Specular highlight — small arc near top-left
    if (this.r >= BUBBLE_SPECULAR_THRESHOLD) {
      _ctx.strokeStyle = "rgba(255,255,255,0.6)";
      _ctx.lineWidth = 0.8;
      _ctx.beginPath();
      _ctx.arc(
        this.x - this.r * 0.25,
        this.y - this.r * 0.25,
        this.r * 0.6,
        -Math.PI * 0.7,
        -Math.PI * 0.3,
      );
      _ctx.stroke();
    } else {
      // Small bubbles — just a dot highlight
      _ctx.fillStyle = "rgba(255,255,255,0.5)";
      _ctx.beginPath();
      _ctx.arc(
        this.x - this.r * 0.3,
        this.y - this.r * 0.3,
        this.r * 0.2,
        0,
        Math.PI * 2,
      );
      _ctx.fill();
    }

    // Large bubbles get a secondary smaller highlight
    if (this.r >= BUBBLE_LARGE_THRESHOLD) {
      _ctx.strokeStyle = "rgba(255,255,255,0.3)";
      _ctx.lineWidth = 0.5;
      _ctx.beginPath();
      _ctx.arc(
        this.x + this.r * 0.15,
        this.y + this.r * 0.2,
        this.r * 0.25,
        Math.PI * 0.2,
        Math.PI * 0.6,
      );
      _ctx.stroke();
    }

    _ctx.restore();
  }
}

class Jellyfish {
  constructor() {
    this.reset(true);
  }
  reset(init) {
    this.bellR = JELLY_BELL_MIN + Math.random() * JELLY_BELL_RANGE;
    this.x = Math.random() * _canvas.width;
    this.y = init
      ? Math.random() * _canvas.height
      : _canvas.height + this.bellR * 2;
    this.vx = (Math.random() - 0.5) * JELLY_DRIFT_VX;
    this.vy = 0;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed =
      JELLY_PULSE_SPEED_MIN + Math.random() * JELLY_PULSE_SPEED_RANGE;
    this.glowPhase = Math.random() * Math.PI * 2;
    this.color = JELLY_COLORS[Math.floor(Math.random() * JELLY_COLORS.length)];
    // Tentacle count based on size
    if (this.bellR >= JELLY_TENTACLE_LARGE_THRESHOLD) {
      this.tentacles = JELLY_TENTACLE_LARGE;
    } else if (this.bellR >= JELLY_TENTACLE_MED_THRESHOLD) {
      this.tentacles = JELLY_TENTACLE_MED;
    } else {
      this.tentacles = JELLY_TENTACLE_SMALL;
    }
    this.tentaclePhases = Array.from(
      { length: this.tentacles },
      () => Math.random() * Math.PI * 2,
    );
  }
  update() {
    this.pulse += this.pulseSpeed;
    this.glowPhase += JELLY_GLOW_PULSE_SPEED;

    // Pulsing swim — sharp upward kick on pulse peak, slow drift down otherwise
    const pulseVal = Math.sin(this.pulse);
    if (pulseVal > 0.95) {
      this.vy -= JELLY_PULSE_STRENGTH;
    }
    this.vy += JELLY_DRIFT_VY; // gentle downward drift

    // Occasional direction change
    if (Math.random() < JELLY_DIRECTION_CHANGE) {
      this.vx = (Math.random() - 0.5) * JELLY_DRIFT_VX * 2;
    }

    this.vx *= JELLY_FRICTION;
    this.vy *= JELLY_FRICTION;
    this.x += this.vx;
    this.y += this.vy;

    // Wrap around edges
    if (this.y < -this.bellR * 3) this.y = _canvas.height + this.bellR * 2;
    if (this.y > _canvas.height + this.bellR * 3) this.y = -this.bellR * 2;
    if (this.x < -this.bellR * 3) this.x += _canvas.width + this.bellR * 6;
    if (this.x > _canvas.width + this.bellR * 3)
      this.x -= _canvas.width + this.bellR * 6;

    // Animate tentacle phases
    for (let i = 0; i < this.tentacles; i++) {
      this.tentaclePhases[i] += JELLY_TENTACLE_WAVE_SPEED + i * 0.005;
    }
  }
  draw() {
    const c = this.color;
    const glowAlpha =
      JELLY_GLOW_ALPHA_MIN +
      Math.sin(this.glowPhase) * 0.5 * JELLY_GLOW_ALPHA_RANGE +
      JELLY_GLOW_ALPHA_RANGE * 0.5;

    _ctx.save();

    // Bioluminescent glow — radial gradient around the bell
    const grad = _ctx.createRadialGradient(
      this.x,
      this.y,
      0,
      this.x,
      this.y,
      this.bellR * 2.5,
    );
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha})`);
    grad.addColorStop(1, "transparent");
    _ctx.fillStyle = grad;
    _ctx.beginPath();
    _ctx.arc(this.x, this.y, this.bellR * 2.5, 0, Math.PI * 2);
    _ctx.fill();

    // Bell dome — parabolic arc using quadraticCurveTo
    const bellW = this.bellR;
    const bellH = this.bellR * 0.8;
    // Faint fill
    const bellGrad = _ctx.createRadialGradient(
      this.x,
      this.y - bellH * 0.3,
      0,
      this.x,
      this.y,
      this.bellR,
    );
    bellGrad.addColorStop(
      0,
      `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha * 1.5})`,
    );
    bellGrad.addColorStop(1, "transparent");
    _ctx.fillStyle = bellGrad;
    _ctx.beginPath();
    _ctx.moveTo(this.x - bellW, this.y);
    _ctx.quadraticCurveTo(
      this.x - bellW,
      this.y - bellH * 2,
      this.x,
      this.y - bellH * 1.5,
    );
    _ctx.quadraticCurveTo(
      this.x + bellW,
      this.y - bellH * 2,
      this.x + bellW,
      this.y,
    );
    _ctx.closePath();
    _ctx.fill();

    // Bell stroke
    _ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.3 + glowAlpha})`;
    _ctx.lineWidth = 0.8;
    _ctx.beginPath();
    _ctx.moveTo(this.x - bellW, this.y);
    _ctx.quadraticCurveTo(
      this.x - bellW,
      this.y - bellH * 2,
      this.x,
      this.y - bellH * 1.5,
    );
    _ctx.quadraticCurveTo(
      this.x + bellW,
      this.y - bellH * 2,
      this.x + bellW,
      this.y,
    );
    _ctx.stroke();

    // Tentacles — wavy lines from bottom of bell
    const tentLen = this.bellR * JELLY_TENTACLE_SEG_LEN_RATIO;
    const spacing = (bellW * 2) / (this.tentacles + 1);
    // Velocity-based trailing — offset tentacle anchors by opposite of velocity
    const trailX = -this.vx * 8;
    const trailY = -this.vy * 4;

    _ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.15 + glowAlpha * 0.5})`;
    _ctx.lineWidth = 0.5;
    for (let i = 0; i < this.tentacles; i++) {
      const baseX = this.x - bellW + spacing * (i + 1);
      _ctx.beginPath();
      _ctx.moveTo(baseX, this.y);
      let tx = baseX + trailX * 0.5;
      let ty = this.y;
      for (let s = 1; s <= JELLY_TENTACLE_SEGMENTS; s++) {
        const t = s / JELLY_TENTACLE_SEGMENTS;
        const wave =
          Math.sin(this.tentaclePhases[i] + s * 1.2) *
          JELLY_TENTACLE_WAVE_AMP *
          this.bellR;
        tx = baseX + wave + trailX * t;
        ty = this.y + tentLen * t + trailY * t;
        const cpx =
          baseX +
          Math.sin(this.tentaclePhases[i] + (s - 0.5) * 1.2) *
            JELLY_TENTACLE_WAVE_AMP *
            this.bellR +
          trailX * (t - 0.5 / JELLY_TENTACLE_SEGMENTS);
        const cpy =
          this.y +
          tentLen * (t - 0.5 / JELLY_TENTACLE_SEGMENTS) +
          trailY * (t - 0.5 / JELLY_TENTACLE_SEGMENTS);
        _ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      }
      _ctx.stroke();
    }

    _ctx.restore();
  }
}

// ── Factory ──

export function createDeepSea(canvasEl, ctxEl, bubbleCount, jellyCount) {
  _canvas = canvasEl;
  _ctx = ctxEl;

  const bubbles = Array.from({ length: bubbleCount }, () => new Bubble());
  const jellyfish = Array.from({ length: jellyCount }, () => new Jellyfish());
  let bubbleSpawnAccum = 0;

  return {
    draw(forces, scrollVelocity, dt) {
      // Ambient bubble spawning
      bubbleSpawnAccum += BUBBLE_AMBIENT_RATE * dt;
      while (bubbleSpawnAccum >= 1) {
        bubbleSpawnAccum--;
        const b = bubbles.find((b) => !b.active);
        if (b) {
          b.reset(false);
          b.active = true;
        }
      }

      bubbles.forEach((b) => {
        if (!b.active) return;
        b.update();
        applyRepulsion(forces, b, BUBBLE_REPEL_RADIUS, BUBBLE_REPEL_DAMPEN);
        applyAttraction(
          forces,
          b,
          BUBBLE_ATTRACT_RADIUS,
          BUBBLE_ATTRACT_STRENGTH,
          BUBBLE_ATTRACT_TANGENT,
        );
        applyWellForce(forces, b);
        // Scroll pushes laterally
        if (Math.abs(scrollVelocity) > BUBBLE_SCROLL_THRESHOLD) {
          b.vx += scrollVelocity * BUBBLE_SCROLL_VX;
        }
        b.draw();
      });

      jellyfish.forEach((j) => {
        j.update();
        applyRepulsion(forces, j, JELLY_REPEL_RADIUS, JELLY_REPEL_DAMPEN);
        applyAttraction(
          forces,
          j,
          JELLY_ATTRACT_RADIUS,
          JELLY_ATTRACT_STRENGTH,
          0,
        );
        applyWellForce(forces, j);
        j.draw();
      });
    },

    clickBurst(cx, cy) {
      const burstCount =
        BUBBLE_CLICK_BURST_MIN +
        Math.floor(Math.random() * BUBBLE_CLICK_BURST_RANGE);
      for (let i = 0; i < burstCount; i++) {
        const b = bubbles.find((b) => !b.active);
        if (!b) break;
        b.reset(false);
        b.x = cx;
        b.y = cy;
        b.active = true;
        // Spread in upward cone
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
        const speed = 1 + Math.random() * 2.5;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
      }
    },

    dragBubble(x, y) {
      if (Math.random() >= BUBBLE_DRAG_RATE) return;
      const b = bubbles.find((b) => !b.active);
      if (b) {
        b.reset(false);
        b.x = x + (Math.random() - 0.5) * 10;
        b.y = y + (Math.random() - 0.5) * 10;
        b.baseR = BUBBLE_RADIUS_MIN + Math.random() * 4;
        b.r = b.baseR;
        b.active = true;
      }
    },
  };
}
