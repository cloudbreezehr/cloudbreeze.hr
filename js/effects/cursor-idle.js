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
// Animations can optionally define intro/outro phases:
// intro: { dotClass, ringClass, durationMs } — played before the main loop
// outro: { dotClass, ringClass, durationMs } — played when interrupted by user movement

const ANIMATIONS = [
  { name: "blink", dotClass: "idle-blink", ringClass: null },
  { name: "breathe", dotClass: null, ringClass: "idle-breathe" },
  { name: "coin-spin", dotClass: null, ringClass: "idle-coin-spin" },
  { name: "drift", dotClass: "idle-drift", ringClass: "idle-drift" },
  {
    name: "fidget-spinner",
    dotClass: null,
    ringClass: "idle-fidget-spinner",
    intro: {
      dotClass: null,
      ringClass: "idle-fidget-spinner-intro",
      durationMs: 500,
    },
    outro: {
      dotClass: null,
      ringClass: "idle-fidget-spinner-outro",
      durationMs: 300,
    },
  },
  {
    name: "hula-hoop",
    dotClass: "idle-hula-hoop",
    ringClass: "idle-hula-hoop",
  },
  {
    name: "metronome",
    dotClass: "idle-metronome",
    ringClass: "idle-metronome",
    intro: {
      dotClass: "idle-metronome-intro",
      ringClass: "idle-metronome-intro",
      durationMs: 400,
    },
    outro: {
      dotClass: "idle-metronome-outro",
      ringClass: "idle-metronome-outro",
      durationMs: 300,
    },
  },
  { name: "orbit", dotClass: null, ringClass: "idle-orbit" },
  {
    name: "pendulum",
    dotClass: "idle-pendulum",
    ringClass: "idle-pendulum",
    intro: {
      dotClass: "idle-pendulum-intro",
      ringClass: "idle-pendulum-intro",
      durationMs: 400,
    },
    outro: {
      dotClass: "idle-pendulum-outro",
      ringClass: "idle-pendulum-outro",
      durationMs: 300,
    },
  },
  {
    name: "yo-yo",
    dotClass: "idle-yo-yo",
    ringClass: "idle-yo-yo",
    intro: {
      dotClass: null,
      ringClass: "idle-yo-yo-intro",
      durationMs: 700,
    },
    outro: {
      dotClass: null,
      ringClass: "idle-yo-yo-outro",
      durationMs: 300,
    },
  },
];

export const IDLE_ANIMATION_NAMES = ANIMATIONS.map((a) => a.name);

// ── State ──

let dotEl = null;
let ringEl = null;
let idleTimer = null;
let phaseTimer = null;
let lastAnimIndex = -1;
let currentAnim = null;
let phase = null; // "intro", "main", or "outro"

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

function applyClasses(dotClass, ringClass) {
  if (dotClass) dotEl.classList.add(dotClass);
  if (ringClass) ringEl.classList.add(ringClass);
}

function removeClasses(dotClass, ringClass) {
  if (dotClass) dotEl.classList.remove(dotClass);
  if (ringClass) ringEl.classList.remove(ringClass);
}

function removeAllAnimClasses() {
  if (!currentAnim) return;
  const a = currentAnim;
  removeClasses(a.dotClass, a.ringClass);
  if (a.intro) removeClasses(a.intro.dotClass, a.intro.ringClass);
  if (a.outro) removeClasses(a.outro.dotClass, a.outro.ringClass);
}

function clearAnimation() {
  clearTimeout(phaseTimer);
  phaseTimer = null;

  if (!currentAnim) return;

  // If the animation has an outro and we're not already in it, play it
  if (currentAnim.outro && phase !== "outro") {
    const anim = currentAnim;
    removeAllAnimClasses();
    applyClasses(anim.outro.dotClass, anim.outro.ringClass);
    phase = "outro";
    phaseTimer = setTimeout(() => {
      removeClasses(anim.outro.dotClass, anim.outro.ringClass);
      currentAnim = null;
      phase = null;
    }, anim.outro.durationMs);
    return;
  }

  removeAllAnimClasses();
  currentAnim = null;
  phase = null;
}

function startMainPhase(anim) {
  applyClasses(anim.dotClass, anim.ringClass);
  phase = "main";

  window.dispatchEvent(
    new CustomEvent("achievement", {
      detail: { type: "cursor-idle", animation: anim.name },
    }),
  );

  // Schedule next animation with jitter
  const delay = C.RECUR_MS + Math.random() * C.RECUR_JITTER_MS;
  idleTimer = setTimeout(playAnimation, delay);
}

function playAnimation() {
  clearTimeout(phaseTimer);
  removeAllAnimClasses();
  phase = null;

  const anim = pickAnimation();
  currentAnim = anim;

  if (anim.intro) {
    applyClasses(anim.intro.dotClass, anim.intro.ringClass);
    phase = "intro";
    phaseTimer = setTimeout(() => {
      removeClasses(anim.intro.dotClass, anim.intro.ringClass);
      startMainPhase(anim);
    }, anim.intro.durationMs);
  } else {
    startMainPhase(anim);
  }
}

function resetIdle() {
  clearTimeout(idleTimer);
  clearAnimation();
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
