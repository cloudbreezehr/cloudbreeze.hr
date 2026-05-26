// ── Wipe Transition Effect ──
// Full-screen opacity wipe: covers the viewport, runs a midpoint callback
// while obscured, then reveals the new state. The CSS class supplied by
// the caller controls the visual appearance (gradient, color).

import { prefersReducedMotion } from "../motion.js";

/**
 * Play a full-screen opacity wipe transition.
 *
 * @param {object} opts
 * @param {string}   opts.className   - CSS class(es) for the wipe div (controls gradient/color)
 * @param {number}   opts.coverMs     - Time to hold the cover before midpoint callback
 * @param {number}   opts.revealMs    - Time for the fade-out reveal after midpoint
 * @param {function} opts.onMidpoint  - Called while the screen is fully covered
 * @param {function} opts.onComplete  - Called after the wipe div is removed
 */
export function playWipe({
  className,
  coverMs,
  revealMs,
  onMidpoint,
  onComplete,
}) {
  if (prefersReducedMotion()) {
    // Skip the cover/reveal element entirely — the wipe div IS the
    // flash the user opted out of.  Callbacks still fire so theme
    // application and post-wipe cleanup proceed; async hops preserve
    // the "call returns, then midpoint, then complete" sequence that
    // synchronous callers rely on.
    setTimeout(() => {
      if (onMidpoint) onMidpoint();
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 0);
    }, 0);
    return;
  }

  const wipe = document.createElement("div");
  wipe.className = className;
  document.body.appendChild(wipe);
  void wipe.offsetHeight;

  wipe.style.opacity = "1";

  setTimeout(() => {
    if (onMidpoint) onMidpoint();

    requestAnimationFrame(() => {
      wipe.style.opacity = "0";
      setTimeout(() => {
        wipe.remove();
        if (onComplete) onComplete();
      }, revealMs);
    });
  }, coverMs);
}
