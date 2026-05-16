// ── Viewport ──
// Owns the page-flip detail so callers don't each re-implement it (and
// don't each grow their own subtly-disagreeing copy).
//
// Two strategies are available, in order of preference:
//
//   1. Add the CSS class `flips-with-page` to your overlay element.
//      The stylesheet flips it with the rest of the page when the
//      flip is active, and the renderer stays in plain canvas-pixel
//      coords (top-left origin, +y is down).  If the caller hands in
//      a y that's already in visual viewport space (e.g. from
//      `getBoundingClientRect`), apply the mirror below once at the
//      entry boundary so the paint lands at the caller's visual
//      position rather than its mirror image; everything past that
//      boundary stays flip-blind.
//
//   2. Call `mirrorYWhenInverted` at the boundary where input
//      coordinates enter your module.  Use this when the surface
//      itself can't ride a CSS flip — e.g. when a single canvas
//      element is *itself* CSS-flipped and rendering code needs the
//      input mirrored to land in the right pixel row.

/**
 * True when the page is in an inverted presentation.  Prefer this over
 * an inline `body.classList.contains("upside-down")` so the predicate
 * lives in one place and other modules don't grow a direct coupling to
 * the theme's class name.
 *
 * @returns {boolean}
 */
export function isFlipped() {
  return document.body.classList.contains("upside-down");
}

/**
 * Mirror `y` across the page midline when the page is in an inverted
 * presentation.  Returns `y` unchanged when the page is upright, and
 * `height - y` when the page is inverted.
 *
 * @param {number} y       y-coordinate to mirror.
 * @param {number} height  Reference height (canvas height, viewport
 *                         height — whatever defines the mirror axis
 *                         for this caller).
 * @returns {number}
 */
export function mirrorYWhenInverted(y, height) {
  return isFlipped() ? height - y : y;
}
