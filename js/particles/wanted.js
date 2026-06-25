// ── Wanted (pop-art) backdrop ──
// A stylised loading-screen look: flat, hard-edged colour panels behind a
// field of Ben-Day halftone dots. Dot radius follows a diagonal tonal gradient
// (small at the top-left, large at the bottom-right). The dots sit on a grid
// but spring away from clicks and drags via the shared interaction forces, then
// settle back home — the halftone ripples under the pointer. Reduced motion
// paints the grid at rest (no spring, no scatter) so it reads as a static
// comic panel.

import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
} from "../interactions.js";
import { scaled } from "../motion.js";
import {
  WANTED,
  WANTED_CREAM,
  WANTED_ORANGE,
  WANTED_TEAL,
  WANTED_INK,
} from "./wanted.constants.js";

// One halftone dot. `hx`/`hy` is its home cell centre; `baseR` is its tonal
// size. Forces nudge vx/vy; a spring restores it toward home each frame.
export class HalftoneDot {
  constructor(hx, hy, baseR) {
    this.reset(hx, hy, baseR);
  }

  reset(hx, hy, baseR) {
    this.hx = hx;
    this.hy = hy;
    this.x = hx;
    this.y = hy;
    this.vx = 0;
    this.vy = 0;
    this.baseR = baseR;
  }

  update(forces) {
    applyRepulsion(forces, this, WANTED.REPEL_RADIUS, WANTED.REPEL_DAMPEN);
    applyAttraction(
      forces,
      this,
      WANTED.ATTRACT_RADIUS,
      WANTED.ATTRACT_STRENGTH,
      WANTED.ATTRACT_TANGENT,
    );
    applyWellForce(forces, this);
    // Spring back toward the home cell — this plus the scatter above is the
    // whole motion budget, so both go through scaled() for reduced motion.
    this.vx += (this.hx - this.x) * WANTED.SPRING;
    this.vy += (this.hy - this.y) * WANTED.SPRING;
    this.x += scaled(this.vx);
    this.y += scaled(this.vy);
    // Friction is damping, not motion — it bleeds off coasting velocity even
    // when the motion budget is zero, so it stays outside scaled().
    this.vx *= WANTED.FRICTION;
    this.vy *= WANTED.FRICTION;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.baseR, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createWanted() {
  let dots = [];
  let lastW = -1;
  let lastH = -1;

  function rebuild(w, h) {
    dots = [];
    const span = WANTED.DOT_SPACING;
    // Centre the grid so partial edge cells are balanced left/right.
    const cols = Math.ceil(w / span) + 1;
    const rows = Math.ceil(h / span) + 1;
    const denom = cols - 1 + (rows - 1) || 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Diagonal tone: dots grow from top-left to bottom-right. The exponent
        // pushes the gradient's midpoint down so most of the field stays sparse
        // — a shading texture rather than a uniform dense screen.
        const t = Math.pow((c + r) / denom, WANTED.TONE_EXP);
        const baseR =
          WANTED.DOT_R_MIN + (WANTED.DOT_R_MAX - WANTED.DOT_R_MIN) * t;
        dots.push(new HalftoneDot(c * span, r * span, baseR));
      }
    }
    lastW = w;
    lastH = h;
  }

  // Flat, hard-edged colour panels behind the dots: an ink ground, a rising
  // orange wedge, a teal corner block. The ground is dark so the page's light
  // text and the cream halftone dots stay legible over it.
  function drawPanels(ctx, w, h) {
    ctx.fillStyle = WANTED_INK;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = WANTED_ORANGE;
    ctx.beginPath();
    ctx.moveTo(0, h * WANTED.WEDGE_TOP);
    ctx.lineTo(w, h * (WANTED.WEDGE_TOP - WANTED.WEDGE_SKEW));
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    const corner = Math.min(w, h) * WANTED.TEAL_CORNER;
    ctx.fillStyle = WANTED_TEAL;
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w, corner);
    ctx.lineTo(w - corner, 0);
    ctx.closePath();
    ctx.fill();
  }

  // Kick every dot upward (with a little sideways scatter); the per-dot spring
  // reels them home, so the whole field lifts off and settles — "low gravity".
  function float() {
    for (const d of dots) {
      d.vy -= WANTED.FLOAT_MIN + Math.random() * WANTED.FLOAT_RANGE;
      d.vx += (Math.random() - 0.5) * WANTED.FLOAT_SIDE;
    }
  }

  function draw(ctx, canvas, forces) {
    const w = canvas.width;
    const h = canvas.height;
    if (w !== lastW || h !== lastH) rebuild(w, h);

    drawPanels(ctx, w, h);

    // Cream dots share one fillStyle/alpha batch — flat fills, no per-dot state
    // changes, so the whole halftone field is cheap even at full density. The
    // shared alpha keeps the texture soft rather than a harsh cream-on-ink grid.
    ctx.save();
    ctx.fillStyle = WANTED_CREAM;
    ctx.globalAlpha = WANTED.DOT_ALPHA;
    for (const d of dots) {
      d.update(forces);
      d.draw(ctx);
    }
    ctx.restore();
  }

  return { draw, float };
}
