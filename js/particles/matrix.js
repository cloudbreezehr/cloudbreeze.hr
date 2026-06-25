// ── Matrix code-rain ──
// Columns of glyphs streaming down a dedicated full-screen canvas, using the
// classic fade-trail technique: each frame paints a translucent dark wash over
// the whole canvas (dimming older glyphs into a trail) and draws only each
// column's new head glyph — far cheaper than redrawing every glyph every frame.
// The canvas is owned here; the theme mounts/unmounts it and ticks draw() once
// per frame from its canvas hook. Reduced motion paints a still field instead
// (no fall, no fade) so the theme still reads as Matrix without animation.

import { scaled, chance, prefersReducedMotion } from "../motion.js";
import { MATRIX, MATRIX_GLYPHS } from "./matrix.constants.js";

function randGlyph() {
  return MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0];
}

// One vertical stream. `head` is the row index of the leading glyph; it falls
// by accumulating scaled speed until a full cell is crossed, then steps down a
// row and picks a fresh glyph. `stepped` tells the renderer to paint this frame.
export class Column {
  constructor(rows) {
    this.rows = rows;
    this.reset(true);
  }

  reset(init) {
    this.head = init ? Math.floor(Math.random() * this.rows) : 0;
    this.speed = MATRIX.FALL_MIN + Math.random() * MATRIX.FALL_RANGE;
    this.acc = 0;
    this.glyph = randGlyph();
    this.stepped = false;
  }

  update(cell, height) {
    this.stepped = false;
    this.acc += scaled(this.speed);
    if (this.acc >= cell) {
      this.acc -= cell;
      this.head += 1;
      this.glyph = randGlyph();
      this.stepped = true;
      if (this.head * cell > height) this.reset(false);
    } else if (chance(MATRIX.MUTATE_CHANCE)) {
      // An occasional in-place flicker, redrawn at the current head.
      this.glyph = randGlyph();
      this.stepped = true;
    }
  }
}

export function createMatrix() {
  const canvas = document.createElement("canvas");
  canvas.className = "matrix-rain";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");

  let columns = [];
  let still = []; // precomputed reduced-motion field: [{ c, row, glyph }]
  let cols = 0;
  let rows = 0;
  let lastW = -1;
  let lastH = -1;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    const cell = MATRIX.GLYPH_SIZE;
    cols = Math.ceil(w / cell);
    rows = Math.ceil(h / cell);
    columns = Array.from({ length: cols }, () => new Column(rows));
    still = [];
    for (let c = 0; c < cols; c++) {
      const fill = Math.floor(rows * MATRIX.STILL_FILL * Math.random());
      for (let row = 0; row < fill; row++) {
        still.push({ c, row, glyph: randGlyph() });
      }
    }
    lastW = w;
    lastH = h;
  }

  function draw(pal) {
    if (!ctx) return;
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) resize();
    const cell = MATRIX.GLYPH_SIZE;
    ctx.font = `${cell}px "DM Mono", monospace`;
    ctx.textBaseline = "top";

    if (prefersReducedMotion()) {
      // A frozen field — redrawn each frame so it persists without a fade loop.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = pal.matrixTrail;
      for (const g of still) ctx.fillText(g.glyph, g.c * cell, g.row * cell);
      return;
    }

    // Fade the trail toward the dark backdrop.
    ctx.globalAlpha = MATRIX.FADE_ALPHA;
    ctx.fillStyle = pal.matrixBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    ctx.shadowColor = pal.matrixHead;
    for (let c = 0; c < cols; c++) {
      const col = columns[c];
      col.update(cell, canvas.height);
      if (!col.stepped) continue;
      ctx.fillStyle = pal.matrixHead;
      ctx.shadowBlur = MATRIX.HEAD_GLOW;
      ctx.fillText(col.glyph, c * cell, col.head * cell);
    }
    ctx.shadowBlur = 0;
  }

  return { canvas, draw };
}
