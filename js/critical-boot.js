// ── Critical Bootstrap ──
// First-paint subset of init.  Loaded as its own module (and
// modulepreloaded) so its imports can paint without waiting for the
// full bootstrap graph.
//
// Hands the appearance singleton off to the other boot entry points
// via `window.__cloudbreezeAppearance` — they run in separate module
// realms (one per <script type="module">) and can't share state via
// imports, so a window global is the only seam.  The underscore
// prefix marks it as private to the boot pipeline.  Re-running
// `initAppearance` in a consumer would double-bind the toggle's
// click handler.

import { injectLayerVars } from "./layers.js";
import { initAppearance } from "./appearance.js";
import { initCursor } from "./cursor.js";
import { initReveal } from "./reveal.js";

// Layer vars first — `var(--z-...)` rules resolve to `auto` until
// these are written, which is fine for elements present in the
// initial HTML (document order matches intended stacking) but matters
// for any overlay later DOM mutations append.  If injection fails,
// every var() falls through to `auto` — louder than hard-coded
// fallbacks would be, intentionally.
injectLayerVars();

const appearance = initAppearance(document.querySelector(".appearance-toggle"));
initCursor(
  document.getElementById("cursor"),
  document.getElementById("cursor-ring"),
);
initReveal();

window.__cloudbreezeAppearance = appearance;
