// ── Canvas Bootstrap ──
// Separate entry point so the canvas's import graph downloads in
// parallel with the rest of the page but evaluates as soon as its own
// imports resolve, without waiting for the deferred bootstrap.

import { initCanvas } from "./canvas.js";

const appearance = window.__cloudbreezeAppearance;
initCanvas(document.getElementById("bg-canvas"), appearance);
