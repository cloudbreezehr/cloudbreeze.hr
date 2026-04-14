import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { defineConstants } from "../dev/registry.js";

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
  { mode: "frozen" },
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
  { mode: "frozen" },
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
    this.sway += this.swaySpeed;
    this.rotation += this.rotSpeed;
    this.x += Math.sin(this.sway) * this.swayAmp + this.vx;
    this.y += this.fallSpeed + this.vy;
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
      const grad = _ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        this.r * SNOW.GLOW_RADIUS,
      );
      grad.addColorStop(0, `rgba(200,230,255,${SNOW.GLOW_OPACITY})`);
      grad.addColorStop(1, "transparent");
      _ctx.fillStyle = grad;
      _ctx.beginPath();
      _ctx.arc(0, 0, this.r * SNOW.GLOW_RADIUS, 0, Math.PI * 2);
      _ctx.fill();
    } else {
      // Small flakes — simple glowing dots
      _ctx.fillStyle = "rgba(220,240,255,1)";
      _ctx.beginPath();
      _ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      _ctx.fill();
    }
    _ctx.restore();
  }
}

// ── Factory ──

export function createSnow(canvasEl, ctxEl, count) {
  _canvas = canvasEl;
  _ctx = ctxEl;

  const snowflakes = Array.from({ length: count }, () => new Snowflake());

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
  };
}
