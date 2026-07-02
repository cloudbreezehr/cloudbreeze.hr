// ── World Space ──
// Desktop-anchored coordinates for the shared sky. The world is the plane
// of the OS desktop, measured in CSS pixels from the screen origin; a
// browser window is a viewport slice of it. The sky's arrangement lives in
// one fixed-size tile repeated across that plane, so any viewport anywhere
// on any monitor samples a consistent, continuous field.
//
// Tile size is the raw arrangement space the daily sky is laid out in. Not
// dev-tunable: windows that disagreed on the tile would disagree on where
// every star sits.

export const WORLD_W = 1920;
export const WORLD_H = 1080;

/** Modulo that stays in [0, m) for negative inputs — desktop coordinates
 *  go negative on monitors left of or above the primary screen. */
export function floorMod(v, m) {
  return ((v % m) + m) % m;
}

/**
 * Best-effort desktop-space rect of a window's *viewport* (not the OS
 * window). Browsers don't expose the viewport's screen position directly;
 * this assumes the window chrome splits its horizontal extent evenly into
 * side borders and stacks the rest (tab strip, toolbars) on top. Exact
 * enough for cross-window effects, which tolerate a few px of drift.
 */
export function viewportDesktopRect(win = window) {
  const sideChrome = (win.outerWidth - win.innerWidth) / 2;
  const topChrome = win.outerHeight - win.innerHeight - sideChrome;
  return {
    x: win.screenX + sideChrome,
    y: win.screenY + topChrome,
    w: win.innerWidth,
    h: win.innerHeight,
  };
}

/** World-space position of this window's viewport origin, right now. */
export function worldOrigin(win = window) {
  const rect = viewportDesktopRect(win);
  return { x: rect.x, y: rect.y };
}
