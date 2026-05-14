// ── Appearance Pre-Paint Boot ──
// Loaded as a synchronous <script src> in <head> so it runs before
// first paint.  NOT a module — ES modules are deferred by spec, which
// would let the browser render dark-appearance colors for a few frames
// before light-appearance users get their preference applied.  The
// cost of blocking first paint on one tiny same-origin file is worth
// avoiding that flash.
//
// Matches the `initAppearance` logic in js/appearance.js: the stored
// preference wins when it's "dark" or "light"; "auto" defers to the
// OS preference.  No stored value defaults to dark — same fallback as
// `getAppearancePreference()` in appearance.js.  The result is a
// body.light-appearance class that the stylesheet reads on first
// paint.
//
// Kept deliberately small — anything this file does delays every
// render.  If future pre-paint work shows up (density toggle,
// reduced-motion snap, etc.), keep the same no-allocations,
// no-DOM-mutation discipline.

const stored = localStorage.getItem("appearance");
const isLight =
  stored === "light" ||
  (stored === "auto" &&
    window.matchMedia("(prefers-color-scheme: light)").matches);
if (isLight) document.body.classList.add("light-appearance");
