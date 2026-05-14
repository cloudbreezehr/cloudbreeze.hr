// ── Theme Pre-Paint Boot ──
// Loaded as a synchronous <script src> in <head> so it runs before
// first paint.  NOT a module — ES modules are deferred by spec, which
// would let the browser render dark-mode colors for a few frames
// before light-mode users get their preference applied.  The cost of
// blocking first paint on one tiny same-origin file is worth avoiding
// that flash.
//
// Matches the `initTheme` logic in js/theme.js: the stored preference
// wins when it's "dark" or "light"; "auto" defers to the OS
// preference.  No stored value defaults to dark — same fallback as
// `getThemePreference()` in theme.js.  The result is a body.light-mode
// class that the stylesheet reads on first paint.
//
// Kept deliberately small — anything this file does delays every
// render.  If future pre-paint work shows up (density mode, reduced-
// motion snap, etc.), keep the same no-allocations, no-DOM-mutation
// discipline.

const stored = localStorage.getItem("theme");
const isLight =
  stored === "light" ||
  (stored === "auto" &&
    window.matchMedia("(prefers-color-scheme: light)").matches);
if (isLight) document.body.classList.add("light-mode");
