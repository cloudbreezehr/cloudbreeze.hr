// ── FPS Counter ──
// Shows a real-time frames-per-second readout in the bottom-left corner.
// Activated when the dev console opens, hidden when it closes.

const UPDATE_INTERVAL_MS = 250;
const LOW_FPS = 30;
const MID_FPS = 50;
const COLOR_GOOD = "#4ade80";
const COLOR_MID = "#facc15";
const COLOR_LOW = "#f87171";

let el = null;
let rafId = null;
let frameCount = 0;
let lastSample = 0;

function tick() {
  frameCount++;
  const now = performance.now();
  if (now - lastSample >= UPDATE_INTERVAL_MS) {
    const fps = Math.round((frameCount / (now - lastSample)) * 1000);
    el.textContent = fps + " fps";
    el.style.color =
      fps < LOW_FPS ? COLOR_LOW : fps < MID_FPS ? COLOR_MID : COLOR_GOOD;
    frameCount = 0;
    lastSample = now;
  }
  rafId = requestAnimationFrame(tick);
}

function createEl() {
  el = document.createElement("div");
  el.className = "dev-fps";
  document.body.appendChild(el);
}

export function showFps() {
  if (rafId !== null) return;
  if (!el) createEl();
  el.style.display = "";
  frameCount = 0;
  lastSample = performance.now();
  rafId = requestAnimationFrame(tick);
}

export function hideFps() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (el) el.style.display = "none";
}
