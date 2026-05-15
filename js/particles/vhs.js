// ── VHS Particle System ──
// The "particle" is a misnomer here — VHS doesn't add discrete particles.
// Its identity is a canvas-level phosphor layer that ages the previous
// frame and composites it on top of the current frame at low alpha
// (creating a faint ghost trail), plus a small DOM click-glitch effect.
//
// Phosphor cycle (called once per frame at the END of the main draw):
//   drawAfter():
//     1. Composite phosphor onto main canvas at SHOW_OPACITY (the ghost
//        appears as a faint overlay of the previous frame).
//     2. Decay phosphor by drawing rgba(0,0,0,DECAY) over it (so older
//        contributions fade away).
//     3. Capture the just-composited main canvas back into the phosphor
//        at CAPTURE_OPACITY (this frame contributes to next frame's ghost).
//
// Painting last means the sky gradient and every other layer have already
// rendered at their natural alpha, and the phosphor reads as a CRT
// afterglow on top — the model that matches actual phosphor decay.

import { defineConstants } from "../dev/registry.js";

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
    // Click-glitch DOM element pool cap.  Each glitch is a 50ms element;
    // a sustained mash beyond this cap drops the oldest.
    GLITCH_MAX: 10,
    // Pixel size of the glitch rect at the click location.
    GLITCH_SIZE_PX: 120,
    // Vertical extent the glitch covers (a horizontal band at the click).
    GLITCH_HEIGHT_PX: 24,
  },
  { theme: "vhs" },
);

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
    // is short (~50ms) so most of the time the cap never triggers.
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
    // the phosphor, and captures the composited frame back in for the
    // next cycle. Single entry point keeps the canvas.js integration to
    // one line and the order of operations local to this module.
    drawAfter(ctx) {
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
    },
  };
}
