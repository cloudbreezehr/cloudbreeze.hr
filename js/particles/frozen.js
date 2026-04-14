import { applyRepulsion, applyAttraction, applyWellForce } from '../interactions.js';

// ── Snowflakes ──
const SNOW_RADIUS_MIN = 1.5;
const SNOW_RADIUS_RANGE = 3;
const SNOW_FALL_MIN = 0.3;
const SNOW_FALL_RANGE = 0.5;
const SNOW_SWAY_SPEED_MIN = 0.008;
const SNOW_SWAY_SPEED_RANGE = 0.012;
const SNOW_SWAY_AMP_MIN = 0.3;
const SNOW_SWAY_AMP_RANGE = 0.5;
const SNOW_OPACITY_MIN = 0.2;
const SNOW_OPACITY_RANGE = 0.5;
const SNOW_GLOW_RADIUS = 3;
const SNOW_GLOW_OPACITY = 0.25;
const SNOW_FRICTION = 0.96;
const SNOW_REPEL_RADIUS = 150;
const SNOW_REPEL_DAMPEN = 0.8;
const SNOW_ATTRACT_RADIUS = 150;
const SNOW_ATTRACT_STRENGTH = 0.1;
const SNOW_ATTRACT_TANGENT = 0.6;
const SNOW_SCROLL_THRESHOLD = 0.5;
const SNOW_SCROLL_VY = 0.03;
const SNOW_SCROLL_VX = 0.02;
const SNOW_CRYSTAL_THRESHOLD = 3;
const SNOW_BRANCH_RATIO = 0.35;
const SNOW_BRANCH_ANGLE = Math.PI / 4;

// ── Snow Globe Shake ──
const SHAKE_TURBULENCE = 4;
const SHAKE_DECAY = 0.97;
const SHAKE_OPACITY_BOOST = 0.15;

// ── Module-scoped canvas refs ──
let _canvas, _ctx;

class Snowflake {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * _canvas.width;
    this.y = init ? Math.random() * _canvas.height : -10;
    this.r = SNOW_RADIUS_MIN + Math.random() * SNOW_RADIUS_RANGE;
    this.fallSpeed = SNOW_FALL_MIN + Math.random() * SNOW_FALL_RANGE;
    this.vx = 0;
    this.vy = 0;
    this.sway = Math.random() * Math.PI * 2;
    this.swaySpeed = SNOW_SWAY_SPEED_MIN + Math.random() * SNOW_SWAY_SPEED_RANGE;
    this.swayAmp = SNOW_SWAY_AMP_MIN + Math.random() * SNOW_SWAY_AMP_RANGE;
    this.opacity = SNOW_OPACITY_MIN + Math.random() * SNOW_OPACITY_RANGE;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.01;
  }
  update() {
    this.sway += this.swaySpeed;
    this.rotation += this.rotSpeed;
    this.x += Math.sin(this.sway) * this.swayAmp + this.vx;
    this.y += this.fallSpeed + this.vy;
    this.vx *= SNOW_FRICTION;
    this.vy *= SNOW_FRICTION;
    if (this.y > _canvas.height + 10) this.reset(false);
    if (this.x < -20) this.x += _canvas.width + 40;
    if (this.x > _canvas.width + 20) this.x -= _canvas.width + 40;
  }
  draw() {
    _ctx.save();
    _ctx.globalAlpha = this.opacity;
    if (this.r >= SNOW_CRYSTAL_THRESHOLD) {
      // Crystalline snowflake — 6 arms with branches, slow rotation
      _ctx.translate(this.x, this.y);
      _ctx.rotate(this.rotation);
      _ctx.strokeStyle = 'rgba(220,240,255,1)';
      _ctx.lineWidth = 0.6;
      _ctx.lineCap = 'round';
      _ctx.beginPath();
      const arm = this.r;
      const branch = arm * SNOW_BRANCH_RATIO;
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
        _ctx.lineTo(mx + Math.cos(a + SNOW_BRANCH_ANGLE) * branch, my + Math.sin(a + SNOW_BRANCH_ANGLE) * branch);
        _ctx.moveTo(mx, my);
        _ctx.lineTo(mx + Math.cos(a - SNOW_BRANCH_ANGLE) * branch, my + Math.sin(a - SNOW_BRANCH_ANGLE) * branch);
      }
      _ctx.stroke();
      // Subtle glow for larger crystalline flakes
      const grad = _ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * SNOW_GLOW_RADIUS);
      grad.addColorStop(0, `rgba(200,230,255,${SNOW_GLOW_OPACITY})`);
      grad.addColorStop(1, 'transparent');
      _ctx.fillStyle = grad;
      _ctx.beginPath();
      _ctx.arc(0, 0, this.r * SNOW_GLOW_RADIUS, 0, Math.PI * 2);
      _ctx.fill();
    } else {
      // Small flakes — simple glowing dots
      _ctx.fillStyle = 'rgba(220,240,255,1)';
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

  const snowflakes = Array.from({length: count}, () => new Snowflake());

  return {
    draw(forces, scrollVelocity, snowTurbulence) {
      // Snow globe turbulence — burst then decay
      if (snowTurbulence.value > 0.01) {
        snowflakes.forEach(s => {
          s.vx += (Math.random() - 0.5) * SHAKE_TURBULENCE * snowTurbulence.value;
          s.vy += (Math.random() - 0.5) * SHAKE_TURBULENCE * snowTurbulence.value;
          s.opacity = Math.min(1, s.opacity + SHAKE_OPACITY_BOOST * snowTurbulence.value);
        });
        snowTurbulence.value *= SHAKE_DECAY;
      }
      snowflakes.forEach(s => {
        s.update();
        applyRepulsion(forces, s, SNOW_REPEL_RADIUS, SNOW_REPEL_DAMPEN);
        applyAttraction(forces, s, SNOW_ATTRACT_RADIUS, SNOW_ATTRACT_STRENGTH, SNOW_ATTRACT_TANGENT);
        applyWellForce(forces, s);
        // Scroll pushes snowflakes
        if (Math.abs(scrollVelocity) > SNOW_SCROLL_THRESHOLD) {
          s.vy -= scrollVelocity * SNOW_SCROLL_VY;
          s.vx += (Math.random() - 0.5) * Math.abs(scrollVelocity) * SNOW_SCROLL_VX;
        }
        s.draw();
      });
    },
  };
}
