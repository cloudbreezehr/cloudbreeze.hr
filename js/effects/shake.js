// ── Shake gesture ──
// On mobile, a physical shake triggers a celebratory jolt — a screen quake and
// a themed confetti burst (tinted to the active theme). Touch users have fewer
// discovery gestures than keyboard users; this gives them one.
//
// Detection is a pure accelerometer reader (testable); the wiring handles the
// DeviceMotion plumbing and iOS's permission gate. The effects self-skip under
// reduced motion, so a shake is silent there.

import { screenShake } from "./screen-shake.js";
import { confettiBurst } from "./confetti.js";
import { defineConstants } from "../dev/registry.js";
import { onSoundChange, isSoundEnabled } from "../audio/engine.js";

const SHAKE = defineConstants("effects.shake", {
  THRESHOLD: {
    value: 26,
    min: 8,
    max: 80,
    step: 1,
    description: "Acceleration change (m/s² summed) that counts as one jerk",
  },
  JERK_GAP_MS: {
    value: 100,
    min: 40,
    max: 400,
    step: 10,
    description: "Min gap between counted jerks, so one swing isn't many",
  },
  JERKS_REQUIRED: {
    value: 4,
    min: 2,
    max: 10,
    step: 1,
    description: "Distinct jerks within the window for a deliberate shake",
  },
  WINDOW_MS: {
    value: 1200,
    min: 400,
    max: 4000,
    step: 100,
    description: "Window the required jerks must fall within",
  },
  COOLDOWN_MS: {
    value: 1400,
    min: 200,
    max: 5000,
    step: 100,
    description: "Minimum gap between shake triggers",
  },
  QUAKE_AMPLITUDE: {
    value: 9,
    min: 2,
    max: 30,
    step: 1,
    description: "Screen-shake amplitude on a shake",
  },
  CONFETTI: {
    value: 44,
    min: 10,
    max: 150,
    step: 2,
    description: "Confetti pieces flung on a shake",
  },
});

// Pure detector: feed accelerometer readings; returns true only for a
// deliberate shake — several distinct jerks within a short window, not a single
// jolt. A jolt is what tilting or lifting the phone produces (gravity shifts
// across axes and spikes the delta once); requiring repeated, separated jerks
// keeps ordinary handling from triggering. Fires once, then waits out the
// cooldown so one shake doesn't burst.
export function createShakeDetector({
  threshold = SHAKE.THRESHOLD,
  cooldownMs = SHAKE.COOLDOWN_MS,
  jerkGapMs = SHAKE.JERK_GAP_MS,
  jerksRequired = SHAKE.JERKS_REQUIRED,
  windowMs = SHAKE.WINDOW_MS,
} = {}) {
  let last = null;
  let lastFire = -Infinity;
  let lastJerk = -Infinity;
  let jerks = []; // timestamps of recent distinct jerks, pruned to the window
  return {
    feed(x, y, z, now) {
      if (x == null || y == null || z == null) return false;
      let fired = false;
      if (last) {
        const delta =
          Math.abs(x - last.x) + Math.abs(y - last.y) + Math.abs(z - last.z);
        // Count a jerk only when it's separated from the previous one, so the
        // many readings inside a single swing collapse to one jerk.
        if (delta > threshold && now - lastJerk >= jerkGapMs) {
          lastJerk = now;
          jerks.push(now);
          while (jerks.length && now - jerks[0] > windowMs) jerks.shift();
          if (jerks.length >= jerksRequired && now - lastFire > cooldownMs) {
            lastFire = now;
            jerks = []; // consume — the next shake needs a fresh run of jerks
            fired = true;
          }
        }
      }
      last = { x, y, z };
      return fired;
    },
  };
}

function shakeEffect() {
  screenShake({ amplitude: SHAKE.QUAKE_AMPLITUDE, sound: "quake" });
  confettiBurst({
    count: SHAKE.CONFETTI,
    origin: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  });
}

/**
 * Wire the shake gesture. No-op where there's no motion sensor. On iOS 13+,
 * where motion is permission-gated, the request must run inside a user gesture
 * — so it's tied to *enabling sound*: a deliberate "full experience" opt-in
 * (and shake's quake needs sound on anyway), rather than nagging on the first
 * incidental tap. A returning visitor who already granted it gets re-armed on
 * their first gesture, since iOS replays the remembered grant with no prompt.
 */
export function initShake() {
  const DM = window.DeviceMotionEvent;
  if (!DM) return;

  const detector = createShakeDetector();
  let listening = false;
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    if (detector.feed(a.x, a.y, a.z, performance.now())) shakeEffect();
  }
  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener("devicemotion", onMotion);
  }

  if (typeof DM.requestPermission !== "function") {
    listen(); // no permission gate (Android, older iOS)
    return;
  }

  let requested = false;
  function request() {
    if (requested) return;
    requested = true;
    DM.requestPermission()
      .then((state) => {
        if (state === "granted") listen();
      })
      .catch(() => {});
  }

  // Enabling sound is the deliberate trigger.
  onSoundChange((on) => {
    if (on) request();
  });
  // Already on from a past visit: ask on the first gesture, where the prior
  // grant replays silently (only a never-decided device would see a prompt,
  // and enabling sound here would have prompted then).
  if (isSoundEnabled()) {
    window.addEventListener("pointerdown", request, { once: true });
  }
}
