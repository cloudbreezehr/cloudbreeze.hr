// ── Critical Bootstrap ──
// First-paint subset of init.  Loaded as its own module (and
// modulepreloaded) so its imports can paint without waiting for the
// full bootstrap graph.
//
// Hands the appearance singleton off to the deferred bootstrap via
// `window.__cloudbreezeAppearance` — re-running `initAppearance`
// there would double-bind the toggle's click handler.

import { injectLayerVars } from "./layers.js";
import { initAppearance } from "./appearance.js";
import { initCanvas } from "./canvas.js";
import { initCursor } from "./cursor.js";

// Layer vars first — `var(--z-...)` rules resolve to `auto` until
// these are written, which is fine for elements present in the
// initial HTML (document order matches intended stacking) but matters
// for any overlay later DOM mutations append.  If injection fails,
// every var() falls through to `auto` — louder than hard-coded
// fallbacks would be, intentionally.
injectLayerVars();

const appearance = initAppearance(document.querySelector(".appearance-toggle"));
initCanvas(document.getElementById("bg-canvas"), appearance);
initCursor(
  document.getElementById("cursor"),
  document.getElementById("cursor-ring"),
);

window.__cloudbreezeAppearance = appearance;
