// ── Wipe Transition Effect ──
// Full-screen opacity wipe used by mode transitions. Covers the viewport,
// runs a midpoint callback while obscured, then reveals the new state.
// CSS classes control the visual appearance (gradient, color) per mode.

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
