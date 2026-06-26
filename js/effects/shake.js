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

const SHAKE = defineConstants("effects.shake", {
  THRESHOLD: {
    value: 24,
    min: 8,
    max: 80,
    step: 1,
    description: "Acceleration change that counts as a shake (m/s² summed)",
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

// Pure detector: feed accelerometer readings; returns true on a shake (a large
// change since the last reading), then stays quiet until the cooldown passes so
// one vigorous shake fires once rather than a burst.
export function createShakeDetector({
  threshold = SHAKE.THRESHOLD,
  cooldownMs = SHAKE.COOLDOWN_MS,
} = {}) {
  let last = null;
  let lastFire = -Infinity;
  return {
    feed(x, y, z, now) {
      if (x == null || y == null || z == null) return false;
      let fired = false;
      if (last) {
        const delta =
          Math.abs(x - last.x) + Math.abs(y - last.y) + Math.abs(z - last.z);
        if (delta > threshold && now - lastFire > cooldownMs) {
          lastFire = now;
          fired = true;
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
 * where motion is permission-gated, the prompt must follow a user gesture, so
 * it's requested once on the first tap.
 */
export function initShake() {
  const DM = window.DeviceMotionEvent;
  if (!DM) return;

  const detector = createShakeDetector();
  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a) return;
    if (detector.feed(a.x, a.y, a.z, performance.now())) shakeEffect();
  }
  function listen() {
    window.addEventListener("devicemotion", onMotion);
  }

  if (typeof DM.requestPermission !== "function") {
    listen(); // no permission needed (Android, older iOS)
    return;
  }
  // iOS 13+: ask once, on the first tap (a gesture is required).
  function requestOnce() {
    window.removeEventListener("pointerdown", requestOnce);
    DM.requestPermission()
      .then((state) => {
        if (state === "granted") listen();
      })
      .catch(() => {});
  }
  window.addEventListener("pointerdown", requestOnce, { once: true });
}
