// ── Canvas Bootstrap ──
// Separate entry point so the canvas's import graph downloads in
// parallel with the rest of the page but evaluates as soon as its own
// imports resolve, without waiting for the deferred bootstrap.
//
// Must run after critical-boot.js — reads the appearance singleton
// from `window.__cloudbreezeAppearance` set there.  The <script> tag
// order in index.html enforces this; the assert below traps any
// future reordering loudly instead of letting `undefined` propagate.

import { initCanvas } from "./canvas.js";

const appearance = window.__cloudbreezeAppearance;
if (!appearance) {
  throw new Error(
    "[canvas-boot] window.__cloudbreezeAppearance missing — critical-boot.js must run first",
  );
}
initCanvas(document.getElementById("bg-canvas"), appearance);
