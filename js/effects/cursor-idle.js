// ── Cursor Idle Animations ──
// Plays subtle idle animations on the cursor dot and ring when the
// user hasn't moved the mouse for a while. Randomly picks from a
// pool of animations, recurring with jitter while idle. Cancels
// instantly on any mouse movement.

import { defineConstants } from "../dev/registry.js";

// ── Constants ──

const C = defineConstants("cursor.idle", {
  IDLE_MS: {
    value: 15000,
    min: 1000,
    max: 30000,
    step: 1000,
    description: "Idle time before first animation",
  },
  RECUR_MS: {
    value: 15000,
    min: 3000,
    max: 30000,
    step: 1000,
    description: "Base interval between recurring animations",
  },
  RECUR_JITTER_MS: {
    value: 5000,
    min: 0,
    max: 10000,
    step: 500,
    description: "Max random jitter added to recurrence",
  },
});

// ── Animation Pool ──
// Each entry defines CSS classes to apply to the dot and/or ring.
// Either class can be null if the animation only targets one element.

const ANIMATIONS = [
  { name: "blink", dotClass: "idle-blink", ringClass: null },
  { name: "breathe", dotClass: null, ringClass: "idle-breathe" },
  { name: "drift", dotClass: "idle-drift", ringClass: "idle-drift" },
  {
    name: "hula-hoop",
    dotClass: "idle-hula-hoop",
    ringClass: "idle-hula-hoop",
  },
  { name: "orbit", dotClass: null, ringClass: "idle-orbit" },
];

export const IDLE_ANIMATION_NAMES = ANIMATIONS.map((a) => a.name);

// ── State ──

let dotEl = null;
let ringEl = null;
let idleTimer = null;
let lastAnimIndex = -1;
let currentAnim = null;

// ── Helpers ──

function pickAnimation() {
  const pool = ANIMATIONS.length;
  let idx;
  do {
    idx = Math.floor(Math.random() * pool);
  } while (idx === lastAnimIndex && pool > 1);
  lastAnimIndex = idx;
  return ANIMATIONS[idx];
}

function applyAnimation(anim) {
  if (anim.dotClass) dotEl.classList.add(anim.dotClass);
  if (anim.ringClass) ringEl.classList.add(anim.ringClass);
  currentAnim = anim;
}

function clearAnimation() {
  if (!currentAnim) return;
  if (currentAnim.dotClass) dotEl.classList.remove(currentAnim.dotClass);
  if (currentAnim.ringClass) ringEl.classList.remove(currentAnim.ringClass);
  currentAnim = null;
}

function playAnimation() {
  clearAnimation();
  const anim = pickAnimation();
  applyAnimation(anim);

  window.dispatchEvent(
    new CustomEvent("achievement", {
      detail: { type: "cursor-idle", animation: anim.name },
    }),
  );

  // Schedule next animation with jitter
  const delay = C.RECUR_MS + Math.random() * C.RECUR_JITTER_MS;
  idleTimer = setTimeout(playAnimation, delay);
}

function resetIdle() {
  clearAnimation();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(playAnimation, C.IDLE_MS);
}

// ── Init ──

export function initCursorIdle(dot, ring) {
  if (!dot || !ring) return;
  if (window.matchMedia("(hover: none)").matches) return;

  dotEl = dot;
  ringEl = ring;

  document.addEventListener("mousemove", resetIdle, { passive: true });
  document.addEventListener("mousedown", resetIdle, { passive: true });
  document.addEventListener("scroll", resetIdle, { passive: true });
  document.addEventListener("wheel", resetIdle, { passive: true });

  idleTimer = setTimeout(playAnimation, C.IDLE_MS);
}
