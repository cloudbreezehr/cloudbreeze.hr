// ── Matrix code-rain ──
// Columns of glyphs streaming down a dedicated full-screen overlay canvas,
// using the classic fade-trail technique: each frame fades the whole canvas a
// little toward transparent and draws only each column's new head glyph — far
// cheaper than redrawing every glyph every frame. The fade *erases* (rather
// than painting a dark wash), so the overlay never builds an opaque backdrop:
// other active themes drawing on the shared canvas below — and the dark
// --theme-bg — show through the gaps, so Matrix layers with other themes
// instead of hiding them. The canvas is owned here; the theme mounts/unmounts
// it and ticks draw() once per frame from its canvas hook. Reduced motion
// paints a still field instead (no fall, no fade).
//
// The rain is interactive:
//   • Pointer reactivity — pressing/holding speeds up the columns near the
//     pointer at once, then faster the longer the hold; their heads flare.
//   • Click surge — a click flashes the struck column head-to-toe and sends an
//     expanding ring that lights the heads it passes.
//   • Decode — a click rarely resolves a column into a readable word, which
//     holds then scrambles back; the theme is notified via onDecode. Works
//     under reduced motion too, so the secret stays reachable everywhere.

import { scaled, chance, prefersReducedMotion } from "../motion.js";
import {
  MATRIX,
  MATRIX_GLYPHS,
  MATRIX_MESSAGES,
  MATRIX_HEAD,
  MATRIX_TRAIL,
  MATRIX_BRIGHT,
} from "./matrix.constants.js";

function randGlyph() {
  return MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0];
}

// One vertical stream. `head` is the row index of the leading glyph; it falls
// by accumulating scaled speed until a full cell is crossed, then steps down a
// row and picks a fresh glyph. `stepped` tells the renderer to paint this frame.
// `speedMul` lets the renderer accelerate columns near the pointer — the while
// loop lets a boosted column cross more than one cell in a frame.
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

  update(cell, height, speedMul = 1) {
    this.stepped = false;
    this.acc += scaled(this.speed * speedMul);
    let stepped = false;
    while (this.acc >= cell) {
      this.acc -= cell;
      this.head += 1;
      this.glyph = randGlyph();
      stepped = true;
      if (this.head * cell > height) {
        this.reset(false);
        break;
      }
    }
    if (stepped) {
      this.stepped = true;
      return;
    }
    if (chance(MATRIX.MUTATE_CHANCE)) {
      // An occasional in-place flicker, redrawn at the current head.
      this.glyph = randGlyph();
      this.stepped = true;
    }
  }
}

/**
 * @param {object} [opts]
 * @param {(word: string) => void} [opts.onDecode] Called when a hidden word
 *   begins resolving — the theme uses it to award the discovery.
 * @param {() => void} [opts.onClick] Called when a click's column flash renders
 *   (i.e. not under reduced motion), so the theme can sound the surge in step
 *   with the visual.
 */
export function createMatrix({ onDecode, onClick } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "matrix-rain";
  canvas.setAttribute("aria-hidden", "true");
  const ctx = canvas.getContext("2d");

  let columns = [];
  let still = []; // precomputed reduced-motion field: [{ c, row, glyph }]
  let stillPainted = false; // RM field persists once drawn; only resize dirties it
  let cols = 0;
  let rows = 0;
  let lastW = -1;
  let lastH = -1;

  let surges = []; // expanding click rings: [{ x, y, born }]
  let decodeState = null; // { col, row0, word, born } while a word resolves

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
    stillPainted = false;
  }

  function setFont() {
    ctx.font = `${MATRIX.GLYPH_SIZE}px "DM Mono", monospace`;
    ctx.textBaseline = "top";
  }

  // Begin resolving a hidden word, centred on the clicked cell so it forms out
  // of the rain right where the user clicked. Notifies the theme so the
  // discovery can be rewarded.
  function startDecode(col, clickRow) {
    const word = MATRIX_MESSAGES[(Math.random() * MATRIX_MESSAGES.length) | 0];
    col = Math.max(0, Math.min(cols - 1, col));
    const maxRow = Math.max(0, rows - word.length);
    const row0 = Math.max(0, Math.min(maxRow, clickRow - (word.length >> 1)));
    decodeState = { col, row0, word, born: performance.now() };
    if (onDecode) onDecode(word);
  }

  // Draw the locked letters of the resolving word (bright, over the column's
  // own falling rain) and retire it once finished. Letters lock in top-to-
  // bottom out of the rain during reveal and release the same way on dissolve;
  // unlocked cells aren't drawn, so the rain shows through and the word appears
  // to form from the code. Reduced motion skips reveal/dissolve and just holds.
  function renderDecode(now, cell, reduced) {
    const d = decodeState;
    const elapsed = now - d.born;
    const len = d.word.length;
    const reveal = reduced ? 0 : MATRIX.DECODE_REVEAL_MS;
    const dissolve = reduced ? 0 : MATRIX.DECODE_DISSOLVE_MS;
    const total = reveal + MATRIX.DECODE_HOLD_MS + dissolve;
    if (elapsed >= total) {
      decodeState = null;
      return;
    }
    // The locked span [from, to): grows from the top during reveal, full during
    // hold, and recedes from the top during dissolve.
    let from = 0;
    let to = len;
    if (elapsed < reveal) {
      to = Math.floor((elapsed / reveal) * len);
    } else if (elapsed >= reveal + MATRIX.DECODE_HOLD_MS) {
      from = Math.floor(
        ((elapsed - reveal - MATRIX.DECODE_HOLD_MS) / dissolve) * len,
      );
    }
    ctx.fillStyle = MATRIX_BRIGHT;
    ctx.shadowColor = MATRIX_BRIGHT;
    ctx.shadowBlur = MATRIX.REACT_GLOW;
    for (let i = from; i < to; i++) {
      const ch = d.word[i];
      if (ch === " ") continue;
      ctx.fillText(ch, d.col * cell, (d.row0 + i) * cell);
    }
  }

  // True if (x, y) lies on the leading edge of any live surge ring.
  function surgeHot(x, y, now) {
    for (const s of surges) {
      const r = (now - s.born) * MATRIX.SURGE_SPEED;
      const dx = x - s.x;
      const dy = y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - r) < MATRIX.SURGE_BAND / 2) return true;
    }
    return false;
  }

  function draw(frame = {}) {
    if (!ctx) return;
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) resize();
    const cell = MATRIX.GLYPH_SIZE;
    const now = performance.now();
    setFont();

    if (prefersReducedMotion()) {
      // Still field — painted once and left on the canvas. A click-triggered
      // decode repaints (field + word) for its duration, then restores.
      if (decodeState) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = MATRIX_TRAIL;
        ctx.shadowBlur = 0;
        for (const g of still) ctx.fillText(g.glyph, g.c * cell, g.row * cell);
        renderDecode(now, cell, true);
        ctx.shadowBlur = 0;
        if (!decodeState) stillPainted = false; // repaint clean next frame
        return;
      }
      if (stillPainted) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = MATRIX_TRAIL;
      for (const g of still) ctx.fillText(g.glyph, g.c * cell, g.row * cell);
      stillPainted = true;
      return;
    }

    // Toggling motion back on must re-arm the still field for a later RM switch.
    stillPainted = false;

    // Fade the trail by erasing toward transparent (destination-out) rather
    // than painting a dark wash — so the overlay stays clear in the gaps and
    // whatever's behind it shows through.
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = MATRIX.FADE_ALPHA;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // The rain reacts only while the pointer is pressed/held (a click or a
    // press-and-hold, drag or not) — never on plain hover. Pressing speeds up
    // nearby columns at once; holding ramps it further (holdStrength 0→1, capped).
    let px = null;
    let py = null;
    let hold = 0;
    const f = frame.forces;
    if (f && f.isDragging) {
      px = f.dragPos.x;
      py = f.dragPos.y;
      hold = f.holdStrength;
    }
    const radius = MATRIX.REACT_RADIUS;
    const radius2 = radius * radius;

    // Drop expired surge rings.
    for (let i = surges.length - 1; i >= 0; i--) {
      if ((now - surges[i].born) * MATRIX.SURGE_SPEED > MATRIX.SURGE_MAX) {
        surges.splice(i, 1);
      }
    }

    // Advance every column and draw the heads that stepped. Normal heads paint
    // inline in the green pass; the few the pointer or a surge has lit are held
    // back for a second white pass — grouping the two avoids switching the
    // expensive shadow state per glyph. The decode column keeps raining too;
    // its resolved letters draw over it afterward.
    const lit = [];
    ctx.fillStyle = MATRIX_HEAD;
    ctx.shadowColor = MATRIX_HEAD;
    ctx.shadowBlur = MATRIX.HEAD_GLOW;
    for (let c = 0; c < cols; c++) {
      const col = columns[c];
      const cx = c * cell;
      let speedMul = 1;
      if (px !== null) {
        const adx = Math.abs(cx - px);
        if (adx < radius) {
          const prox = 1 - adx / radius;
          speedMul =
            1 +
            prox * (MATRIX.REACT_SPEED_BASE + MATRIX.REACT_SPEED_BOOST * hold);
        }
      }
      col.update(cell, canvas.height, speedMul);
      if (!col.stepped) continue;
      const hy = col.head * cell;
      let hot = false;
      if (px !== null) {
        const dx = cx - px;
        const dy = hy - py;
        if (dx * dx + dy * dy < radius2) hot = true;
      }
      if (!hot) hot = surgeHot(cx, hy, now);
      if (hot) {
        lit.push({ x: cx, y: hy, g: col.glyph });
        continue;
      }
      ctx.fillText(col.glyph, cx, hy);
    }

    if (lit.length) {
      ctx.fillStyle = MATRIX_BRIGHT;
      ctx.shadowColor = MATRIX_BRIGHT;
      ctx.shadowBlur = MATRIX.REACT_GLOW;
      for (const s of lit) ctx.fillText(s.g, s.x, s.y);
    }

    if (decodeState) renderDecode(now, cell, false);
    ctx.shadowBlur = 0;
  }

  // Click feedback: flash the struck column head-to-toe, send a ring out, and
  // sometimes set a hidden word resolving in that column. The bright column and
  // ring are motion — skipped under reduced motion — but the decode is not, so
  // the secret stays reachable.
  function click(x, y) {
    if (!ctx) return;
    const cell = MATRIX.GLYPH_SIZE;
    if (!prefersReducedMotion()) {
      const now = performance.now();
      surges.push({ x, y, born: now });
      if (surges.length > MATRIX.SURGE_POOL) surges.shift();
      const cx = Math.floor(x / cell) * cell;
      setFont();
      ctx.fillStyle = MATRIX_BRIGHT;
      ctx.shadowColor = MATRIX_BRIGHT;
      ctx.shadowBlur = MATRIX.HEAD_GLOW;
      for (let yy = 0; yy < canvas.height; yy += cell) {
        ctx.fillText(randGlyph(), cx, yy);
      }
      ctx.shadowBlur = 0;
      // The surge rendered — sound it in step (skipped under reduced motion,
      // where the block above doesn't run).
      if (onClick) onClick();
    }
    if (!decodeState && Math.random() < MATRIX.DECODE_CLICK_CHANCE) {
      startDecode(Math.floor(x / cell), Math.floor(y / cell));
    }
  }

  // Reset transient state on unmount so a later mount starts clean.
  function clear() {
    surges = [];
    decodeState = null;
  }

  return { canvas, draw, click, clear };
}
