// Trapezoidal scroll-visibility fade: 0 → fade in → 1 → fade out → 0.
// For fade-out-only (e.g. stars), pass inStart = inEnd = 0.
export function scrollFade(sp, inStart, inEnd, outStart, outEnd) {
  if (sp < inStart) return 0;
  if (sp < inEnd) return (inEnd === inStart) ? 1 : (sp - inStart) / (inEnd - inStart);
  if (sp < outStart) return 1;
  if (sp < outEnd) return 1 - (sp - outStart) / (outEnd - outStart);
  return 0;
}

// Tapered gradient trail shared by shooting stars and meteors.
// colors is a 3-element array: [tail, mid, head] RGB strings.
export function drawTrail(ctx, headX, headY, tailX, tailY, colors, opacity, lineWidth) {
  const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
  grad.addColorStop(0, `rgba(${colors[0]},0)`);
  grad.addColorStop(0.7, `rgba(${colors[1]},${opacity * 0.3})`);
  grad.addColorStop(1, `rgba(${colors[2]},${opacity})`);
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(headX, headY);
  ctx.stroke();
  ctx.restore();
}
