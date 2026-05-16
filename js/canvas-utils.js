// Format an [r,g,b] tuple plus alpha as a `rgba(...)` string. Centralizes
// the c[0]/c[1]/c[2] template literal so consumers don't reimplement (and
// occasionally typo) the same destructure inline.
export function rgbaStr(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// Return the shared #bg-canvas element and its 2D context.  Safe to call
// from any number of callers: getContext("2d") on the same canvas always
// returns the same context, and the only cost is one DOM lookup.
//
// Throws if #bg-canvas isn't present — initialization order in
// bootstrap.js puts the canvas first, so a missing element means the
// caller is running before bootstrap, in a stripped-down test DOM, or
// against the wrong page.
export function getCanvasCtx() {
  const canvasEl = document.getElementById("bg-canvas");
  if (!canvasEl) throw new Error("getCanvasCtx: #bg-canvas not found");
  return { canvasEl, ctx: canvasEl.getContext("2d") };
}

// Trapezoidal scroll-visibility fade: 0 → fade in → 1 → fade out → 0.
// For fade-out-only (e.g. stars), pass inStart = inEnd = 0.
export function scrollFade(sp, inStart, inEnd, outStart, outEnd) {
  if (sp < inStart) return 0;
  if (sp < inEnd)
    return inEnd === inStart ? 1 : (sp - inStart) / (inEnd - inStart);
  if (sp < outStart) return 1;
  if (sp < outEnd) return 1 - (sp - outStart) / (outEnd - outStart);
  return 0;
}

// Tapered gradient trail shared by shooting stars and meteors.
// colors is a 3-element array: [tail, mid, head] RGB strings.
export function drawTrail(
  ctx,
  headX,
  headY,
  tailX,
  tailY,
  colors,
  opacity,
  lineWidth,
) {
  const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
  grad.addColorStop(0, `rgba(${colors[0]},0)`);
  grad.addColorStop(0.7, `rgba(${colors[1]},${opacity * 0.3})`);
  grad.addColorStop(1, `rgba(${colors[2]},${opacity})`);
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(headX, headY);
  ctx.stroke();
  ctx.restore();
}

// Filled radial-gradient halo at (x, y) with radius `r`, where
// the gradient runs `color` (alpha = `opacity`) → midColor (alpha =
// `opacity * midAlpha`) at `midStop` → transparent at the rim.
//
// Two-stop mode: omit `midStop`/`midAlpha`, the gradient becomes a simple
// `color` → transparent fade. Two-color mode: pass `midColor` distinct
// from `color`.
//
// Caller is responsible for `ctx.save`/`globalCompositeOperation` setup
// when needed (e.g. additive blending) — the helper only paints the disc.
export function drawHaloParticle(
  ctx,
  x,
  y,
  r,
  opacity,
  color,
  { midStop, midAlpha, midColor } = {},
) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, rgbaStr(color, opacity));
  if (midStop !== undefined) {
    grad.addColorStop(midStop, rgbaStr(midColor || color, opacity * midAlpha));
  }
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
