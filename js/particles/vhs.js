// ── VHS Particle System ──
// The "particle" is a misnomer here — VHS doesn't add discrete particles.
// Its identity is a canvas-level phosphor layer that ages the previous
// frame and composites it on top of the current frame at low alpha
// (creating a faint ghost trail), a cursor afterimage trail painted on
// top, and a small DOM click-glitch effect.
//
// Phosphor cycle (called once per frame at the END of the main draw):
//   drawAfter():
//     1. Composite phosphor onto main canvas at SHOW_OPACITY (the ghost
//        appears as a faint overlay of the previous frame).
//     2. Decay phosphor by drawing rgba(0,0,0,DECAY) over it (so older
//        contributions fade away).
//     3. Capture the just-composited main canvas back into the phosphor
//        at CAPTURE_OPACITY (this frame contributes to next frame's ghost).
//     4. Render the cursor trail directly on the main canvas, after the
//        phosphor capture so the trail is a self-contained polyline
//        rather than feeding into the phosphor's recursive decay.
//
// Painting last means the sky gradient and every other layer have already
// rendered at their natural alpha, and the phosphor reads as a CRT
// afterglow on top — the model that matches actual phosphor decay.

import { defineConstants } from "../dev/registry.js";
import { chance } from "../motion.js";

const PHOSPHOR = defineConstants(
  "particles.vhs",
  {
    // Alpha of the black rect drawn over the phosphor each frame.
    // Higher = faster decay (ghost fades quicker).
    DECAY_PER_FRAME: 0.06,
    // Alpha at which the phosphor composites onto the main canvas.
    // Higher = more opaque ghost.
    SHOW_OPACITY: 0.5,
    // Alpha at which the current frame contributes to the phosphor.
    // Higher = stronger smear from current frame into next frame.
    CAPTURE_OPACITY: 0.4,
    // Click-glitch DOM element pool cap.  Each glitch is short-lived;
    // a sustained mash beyond this cap drops the oldest.
    GLITCH_MAX: 10,
    // Pixel size of the glitch rect at the click location.
    GLITCH_SIZE_PX: 120,
    // Vertical extent the glitch covers (a horizontal band at the click).
    GLITCH_HEIGHT_PX: 24,
  },
  { theme: "vhs" },
);

// ── Cursor Trail ──
// Recent cursor positions kept in a ring buffer; rendered each frame as
// three chromatic-fringed polylines (magenta offset left, cyan offset
// right, green core in the middle).  Width and alpha taper from the
// tail (oldest position) toward the head (newest), so the trail reads
// as a phosphor afterimage even when the cursor is stationary briefly.
// Independent of the phosphor pipeline so neither feeds the other.
export const TRAIL = defineConstants(
  "particles.vhs.trail",
  {
    // Number of cursor positions kept in history — a fraction of a second
    // of trail at ~60fps.  Higher values cost a few extra strokes per frame.
    HISTORY_LEN: 24,
    // Stroke width at the head (most recent position) in px.
    HEAD_WIDTH_PX: 6,
    // Stroke width at the tail (oldest position).  Tapers linearly
    // between head and tail across the polyline.
    TAIL_WIDTH_PX: 0.5,
    // Alpha of the green core line at the head.
    HEAD_ALPHA: 0.85,
    // Alpha at the tail (alpha tapers linearly toward this).  Zero by
    // default so the tail dissolves into the page.
    TAIL_ALPHA: 0,
    // Sideways pixel offset of the chromatic fringe satellites.  Read
    // as a scanline-misalignment artifact rather than a deliberate
    // double-image.
    FRINGE_OFFSET_PX: 2,
    // Fringe alpha relative to core alpha (per-segment factor).  Below
    // 1 so the green core reads as the center of the trail and the
    // fringes as bleed-out.
    FRINGE_ALPHA_FACTOR: 0.6,
    // Squared px the cursor must travel between samples for a new
    // position to be recorded.  Avoids a runaway buffer of identical
    // positions when the cursor is stationary, which would otherwise
    // paint the same spot N times and inflate apparent intensity.
    MIN_SAMPLE_DIST_SQ_PX: 1,
  },
  { theme: "vhs" },
);

// ── Phosphor Fizz ──
// Occasional 1-pixel cyan/magenta specks that pop along the recent
// cursor-trail history and fade fast.  Suggests a CRT phosphor pop-fizz
// artifact — meant to be just barely noticeable, not a deliberate effect.
// Pure visual flash: no motion, no integration, just a fade timer.  Spawn
// is gated by chance() at the cursor-record site so reduced-motion users
// see a clean trail with no fizz.
export const FIZZ = defineConstants(
  "particles.vhs.fizz",
  {
    POOL: {
      value: 64,
      min: 16,
      max: 256,
      step: 8,
      description: "Total fizz slots",
    },
    SPAWN_PER_SAMPLE: {
      value: 0.45,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Per-cursor-sample probability of spawning a fizz speck",
    },
    JITTER_PX: {
      value: 6,
      min: 0,
      max: 20,
      step: 0.5,
      description: "Max random offset from the chosen history point",
    },
    HEAD_BIAS: {
      value: 0.6,
      min: 0,
      max: 1,
      step: 0.05,
      description:
        "Bias toward the head of the history buffer when picking an anchor (0 = uniform, 1 = always the head)",
    },
    LIFE_MIN: {
      value: 4,
      min: 1,
      max: 60,
      step: 1,
      description: "Min lifetime (frames)",
    },
    LIFE_RANGE: {
      value: 8,
      min: 0,
      max: 60,
      step: 1,
      description: "Lifetime variation",
    },
    SIZE_PX: {
      value: 1,
      min: 1,
      max: 4,
      step: 1,
      description: "Fizz speck size in px",
    },
    ALPHA_PEAK: {
      value: 0.9,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Peak speck opacity",
    },
  },
  { theme: "vhs" },
);

// Phosphor fizz speck.  Pure life timer — no motion, no integration,
// no friction.  Spawn picks a history point + random jitter + a
// chromatic channel; draw lays a 1px rect with linear alpha fade.
export class Fizz {
  constructor() {
    this.active = false;
  }
  spawn(x, y, isCyan) {
    this.x = x;
    this.y = y;
    this.isCyan = isCyan;
    this.life = 0;
    this.maxLife = FIZZ.LIFE_MIN + Math.random() * FIZZ.LIFE_RANGE;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.life++;
    if (this.life > this.maxLife) {
      this.active = false;
    }
  }
  draw(ctx, pal) {
    if (!this.active || !pal) return;
    const t = this.life / this.maxLife;
    const alpha = FIZZ.ALPHA_PEAK * (1 - t);
    const c = this.isCyan ? pal.cursorPhosphorCyan : pal.cursorPhosphorMagenta;
    if (!c) return;
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    ctx.fillRect(
      Math.round(this.x),
      Math.round(this.y),
      FIZZ.SIZE_PX,
      FIZZ.SIZE_PX,
    );
  }
}

// Render the cursor afterimage as three chromatic-fringed polylines on
// `ctx`.  History is an array of {x, y} positions oldest → newest.
// Pure function — no module state, no side effects beyond ctx.  Pulled
// out of createVhs so it can be tested directly without spinning up the
// full factory.
export function drawCursorTrail(ctx, history, pal) {
  const n = history.length;
  if (n < 2 || !pal || !pal.cursorPhosphor) return;

  const headW = TRAIL.HEAD_WIDTH_PX;
  const tailW = TRAIL.TAIL_WIDTH_PX;
  const headA = TRAIL.HEAD_ALPHA;
  const tailA = TRAIL.TAIL_ALPHA;
  const fringeAlpha = TRAIL.FRINGE_ALPHA_FACTOR;
  const fringeOff = TRAIL.FRINGE_OFFSET_PX;
  const segments = n - 1;
  // Alpha and width are interpolated per-segment from tail (segment 0)
  // toward head (segment n-2).  Each chromatic channel paints with the
  // same geometry, just shifted in x.
  const channels = [
    { color: pal.cursorPhosphorMagenta, dx: -fringeOff, alphaMul: fringeAlpha },
    { color: pal.cursorPhosphorCyan, dx: fringeOff, alphaMul: fringeAlpha },
    { color: pal.cursorPhosphor, dx: 0, alphaMul: 1 },
  ];

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const ch of channels) {
    const c = ch.color;
    for (let i = 0; i < segments; i++) {
      // t=0 at the tail, t→1 at the head.  Use (i+1) so the head segment
      // (between the two newest points) gets the full head width/alpha.
      const t = (i + 1) / segments;
      const w = tailW + (headW - tailW) * t;
      const a = (tailA + (headA - tailA) * t) * ch.alphaMul;
      if (a <= 0 || w <= 0) continue;
      const p0 = history[i];
      const p1 = history[i + 1];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(p0.x + ch.dx, p0.y);
      ctx.lineTo(p1.x + ch.dx, p1.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function createVhs(canvasEl) {
  // ── Offscreen phosphor canvas ──
  // Lazy-init: skipped entirely until drawPre runs while VHS is active.
  // This means the offscreen buffer doesn't allocate at module load for
  // visitors who never trigger VHS.
  let phosphor = null;
  let pctx = null;
  let lastW = 0;
  let lastH = 0;

  function ensurePhosphor() {
    const w = canvasEl.width;
    const h = canvasEl.height;
    if (!phosphor) {
      phosphor = document.createElement("canvas");
      phosphor.width = w;
      phosphor.height = h;
      pctx = phosphor.getContext("2d");
      lastW = w;
      lastH = h;
      return;
    }
    // Resize tracking: main canvas resized → reallocate the phosphor.
    // Reset to fully transparent (drawImage onto a fresh surface) so the
    // first post-resize frame doesn't ghost stale content.
    if (w !== lastW || h !== lastH) {
      phosphor.width = w;
      phosphor.height = h;
      lastW = w;
      lastH = h;
    }
  }

  // ── Cursor trail history ──
  // Ring buffer of recent cursor positions, oldest → newest.  Capped at
  // TRAIL.HISTORY_LEN; oldest entry shifts out as new ones arrive.  Held
  // here as closure state so each createVhs gets its own buffer (the
  // module is constructed once per canvas init).
  let cursorHistory = [];

  // ── Phosphor fizz pool ──
  const fizzes = Array.from({ length: FIZZ.POOL }, () => new Fizz());

  // ── Click-glitch DOM pool ──
  // Tracked in a FIFO array so a sustained click mash doesn't unbound the
  // DOM. Each element self-removes via animationend; the array entry is
  // pruned in the same handler.
  const glitches = [];

  function clickGlitch(cx, cy) {
    const el = document.createElement("div");
    el.className = "vhs-glitch-rect";
    const half = PHOSPHOR.GLITCH_SIZE_PX / 2;
    const halfH = PHOSPHOR.GLITCH_HEIGHT_PX / 2;
    el.style.left = `${cx - half}px`;
    el.style.top = `${cy - halfH}px`;
    el.style.width = `${PHOSPHOR.GLITCH_SIZE_PX}px`;
    el.style.height = `${PHOSPHOR.GLITCH_HEIGHT_PX}px`;
    document.body.appendChild(el);
    glitches.push(el);
    // Cap: if we're over the limit, hard-remove the oldest. The animation
    // is short-lived so most of the time the cap never triggers.
    while (glitches.length > PHOSPHOR.GLITCH_MAX) {
      const old = glitches.shift();
      old.remove();
    }
    el.addEventListener(
      "animationend",
      () => {
        el.remove();
        const i = glitches.indexOf(el);
        if (i !== -1) glitches.splice(i, 1);
      },
      { once: true },
    );
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "vhs-glitch" } }),
    );
  }

  return {
    // Called at the END of the main draw cycle. Composites the persisted
    // phosphor onto the just-rendered frame (faint ghost overlay), ages
    // the phosphor, captures the composited frame back in for the next
    // cycle, and finally renders the cursor trail directly on top.
    // Single entry point keeps the canvas.js integration to one line and
    // the order of operations local to this module.
    drawAfter(ctx, pal) {
      ensurePhosphor();

      // 1. Composite phosphor onto main canvas (ghost overlay).
      ctx.save();
      ctx.globalAlpha = PHOSPHOR.SHOW_OPACITY;
      ctx.drawImage(phosphor, 0, 0);
      ctx.restore();

      // 2. Decay the phosphor — older contributions fade.
      pctx.save();
      pctx.fillStyle = `rgba(0, 0, 0, ${PHOSPHOR.DECAY_PER_FRAME})`;
      pctx.fillRect(0, 0, phosphor.width, phosphor.height);
      pctx.restore();

      // 3. Capture the composited main canvas (current frame plus its
      //    ghost overlay) into the phosphor for the next frame.  Recursive
      //    self-feedback at low alpha + decay produces the CRT afterglow.
      pctx.save();
      pctx.globalAlpha = PHOSPHOR.CAPTURE_OPACITY;
      pctx.drawImage(canvasEl, 0, 0);
      pctx.restore();

      // 4. Cursor trail — drawn after capture so the trail is fully owned
      //    by its own history buffer and doesn't compound with the
      //    phosphor's recursive decay.
      drawCursorTrail(ctx, cursorHistory, pal);

      // 5. Phosphor fizz — laid on top of the trail so cyan/magenta
      //    specks read as scanline pop-fizz crossing the afterimage.
      //    Spawn happens in recordCursor; here we only update + draw.
      for (const f of fizzes) {
        f.update();
        f.draw(ctx, pal);
      }
    },

    // Stamp the live cursor position into the trail history.  Skips the
    // sample if the cursor hasn't moved meaningfully since the last
    // stamp, so a stationary cursor doesn't paint identical positions
    // repeatedly and inflate apparent intensity.
    recordCursor(x, y) {
      const n = cursorHistory.length;
      if (n > 0) {
        const last = cursorHistory[n - 1];
        const dx = x - last.x;
        const dy = y - last.y;
        if (dx * dx + dy * dy < TRAIL.MIN_SAMPLE_DIST_SQ_PX) return;
      }
      cursorHistory.push({ x, y });
      if (cursorHistory.length > TRAIL.HISTORY_LEN) {
        cursorHistory.shift();
      }
      // Phosphor fizz — chance() folds in the motion budget so reduced-
      // motion users see a clean trail.  Anchor to a recent history
      // point with head-bias (newer trail noise reads better than old).
      if (chance(FIZZ.SPAWN_PER_SAMPLE)) {
        const len = cursorHistory.length;
        // u in [0..1) skewed toward 1 (head) by HEAD_BIAS.  bias=0 →
        // uniform (exp=1); bias=1 → always 1 (exp=0).  Math.pow with
        // exp<1 pushes the distribution toward 1.
        const u = Math.pow(Math.random(), 1 - FIZZ.HEAD_BIAS);
        const idx = Math.min(len - 1, Math.floor(u * len));
        const anchor = cursorHistory[idx];
        const fx = anchor.x + (Math.random() - 0.5) * 2 * FIZZ.JITTER_PX;
        const fy = anchor.y + (Math.random() - 0.5) * 2 * FIZZ.JITTER_PX;
        const f = fizzes.find((f) => !f.active);
        if (f) f.spawn(fx, fy, Math.random() < 0.5);
      }
    },

    // Drop history so the trail vanishes — used when the pointer leaves
    // the canvas so a stale trail doesn't hang in mid-air.
    clearCursor() {
      cursorHistory = [];
    },

    clickGlitch,

    // Called when VHS theme deactivates so the offscreen buffer doesn't
    // bleed lingering content into a future re-activation.
    cleanup() {
      if (phosphor && pctx) {
        pctx.clearRect(0, 0, phosphor.width, phosphor.height);
      }
      while (glitches.length) {
        const el = glitches.shift();
        el.remove();
      }
      cursorHistory = [];
      for (const f of fizzes) f.active = false;
    },
  };
}
