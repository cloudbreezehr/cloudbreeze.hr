// ── Logo Idle Breathing ──
// Adds a gentle scale pulse to the cloud logo when the user
// hasn't interacted for a while, drawing attention to it as
// a clickable element. Stops immediately on any interaction.

import { defineConstants } from "../dev/registry.js";

const BREATH = defineConstants("logo.breathing", {
  IDLE_MS: {
    value: 6000,
    min: 2000,
    max: 15000,
    step: 500,
    description: "Idle time before breathing starts",
  },
});

const IDLE_EVENTS = ["pointerdown", "pointermove", "scroll", "keydown"];
const BREATHING_CLASS = "logo-breathing";

export function initLogoBreathing() {
  const cloudSvg = document.querySelector(".cloud-svg");
  if (!cloudSvg) return;

  let idleTimer = null;

  function startBreathing() {
    cloudSvg.classList.add(BREATHING_CLASS);
  }

  function resetIdle() {
    cloudSvg.classList.remove(BREATHING_CLASS);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(startBreathing, BREATH.IDLE_MS);
  }

  IDLE_EVENTS.forEach((evt) => {
    window.addEventListener(evt, resetIdle, { passive: true });
  });

  idleTimer = setTimeout(startBreathing, BREATH.IDLE_MS);
}
