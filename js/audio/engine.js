// ── Audio Engine ──
// One Web Audio graph for the whole site: every voice connects through a shared
// master gain → limiter → destination, so a stack of overlapping sounds can't
// clip. Off by default — no autoplay, no surprise (also the reduced-motion-safe
// default) — and the choice is remembered across visits. Enabling resumes the
// context inside the user's gesture (autoplay policy); while sound is off the
// context is suspended so nothing is audible. Voices read `masterBus()` to find
// their output; it returns null when sound is unavailable, so callers no-op.

import { defineConstants } from "../dev/registry.js";

const STORAGE_KEY = "sound"; // "on" | "off"
const DEFAULT_PREFERENCE = "off";

const ENGINE = defineConstants("audio.engine", {
  MASTER_GAIN: {
    value: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Master output level",
  },
  // Brick-wall-ish limiter so a volley of overlapping effects never clips.
  LIMITER_THRESHOLD_DB: {
    value: -6,
    min: -40,
    max: 0,
    step: 1,
    description: "Limiter threshold (dB)",
  },
  LIMITER_RATIO: {
    value: 20,
    min: 1,
    max: 20,
    step: 1,
    description: "Limiter ratio",
  },
});

// Grace before muting suspends the context, so the power-down cue (or any other
// in-flight voice) rings out instead of being clipped mid-render. Must exceed
// the longest power-down cue's tail (toggleOff) or that cue clips silently.
export const SUSPEND_GRACE_MS = 360;

let ctx = null;
let master = null; // master gain node; the public output bus
let enabled = readPreference() === "on";
let armed = false; // global gesture/visibility listeners attached
let audioUnlocked = false; // a user gesture has authorized audio playback
const callbacks = [];

function readPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

function audioCtor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

export function isSoundSupported() {
  return !!audioCtor();
}

// Build the graph on first use (master gain → limiter → destination) and
// return the context. Created suspended; resume() lifts it once a gesture
// allows. Returns null when Web Audio is unavailable.
export function audioContext() {
  if (ctx) return ctx;
  const Ctor = audioCtor();
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = ENGINE.MASTER_GAIN;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = ENGINE.LIMITER_THRESHOLD_DB;
  limiter.knee.value = 0;
  limiter.ratio.value = ENGINE.LIMITER_RATIO;
  master.connect(limiter);
  limiter.connect(ctx.destination);
  return ctx;
}

// The node every voice connects to. Null when sound is unavailable.
export function masterBus() {
  audioContext();
  return master;
}

export function isSoundEnabled() {
  return enabled;
}

// True once a user gesture has resumed the context. The browser's autoplay
// policy only warns about audio started *before* a gesture, so callers skip
// playback until this flips — otherwise sounds attempted on load (a remembered
// "on" preference) each log an AudioContext warning.
export function isAudioUnlocked() {
  return audioUnlocked;
}

// Subscribe to enable/disable changes. Returns an unsubscribe function.
export function onSoundChange(cb) {
  callbacks.push(cb);
  return () => {
    const i = callbacks.indexOf(cb);
    if (i >= 0) callbacks.splice(i, 1);
  };
}

// iOS/WebKit parks the context in a non-standard "interrupted" state when
// audio focus is lost (phone call, Siri); it needs the same resume() nudge
// as "suspended", or sound stays dead for the rest of the session.
function needsResume(c) {
  return c.state === "suspended" || c.state === "interrupted";
}

export function setSoundEnabled(on) {
  const next = !!on;
  const was = enabled;
  enabled = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    /* ignore */
  }
  if (next) {
    const c = audioContext();
    if (c && needsResume(c)) c.resume();
    audioUnlocked = true; // enabling is a deliberate gesture
    // First-ever enable is the discovery moment; tryUnlock dedupes repeats.
    if (!was) {
      window.dispatchEvent(
        new CustomEvent("achievement", { detail: { type: "sound-enabled" } }),
      );
    }
  } else if (ctx && ctx.state === "running") {
    // Defer the suspend so a power-down cue isn't clipped; skip it if sound is
    // turned back on within the grace window.
    const c = ctx;
    setTimeout(() => {
      if (!enabled && c.state === "running") c.suspend();
    }, SUSPEND_GRACE_MS);
  }
  callbacks.forEach((cb) => cb(next));
}

export function toggleSound() {
  setSoundEnabled(!enabled);
}

// Attach the one-time global listeners: a gesture resume (so a remembered-on
// preference lifts the context on the visitor's first interaction) and a tab
// suspend (silence + spare CPU when hidden, like the render loop pausing).
export function initEngine() {
  if (armed) return;
  armed = true;
  const resumeOnGesture = () => {
    if (!enabled) return;
    const c = audioContext();
    if (c && needsResume(c)) c.resume();
    audioUnlocked = true;
  };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(ev, resumeOnGesture, { passive: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) {
      if (ctx.state === "running") ctx.suspend();
    } else if (enabled && needsResume(ctx)) {
      ctx.resume();
    }
  });
}

// Test hook — drop the graph + listeners-armed flag and re-read the pref.
export function _resetForTests() {
  ctx = null;
  master = null;
  armed = false;
  audioUnlocked = false;
  callbacks.length = 0;
  enabled = readPreference() === "on";
}
