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
const CLICKED_CLASS = "logo-clicked";

export function initLogoBreathing() {
  const cloudSvg = document.querySelector(".cloud-svg");
  if (!cloudSvg) return;
  const navLogo = cloudSvg.closest(".nav-logo");

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

  // Click pulse confirms the logo registered the press.  Toggle the
  // class off first so back-to-back clicks restart the keyframe — the
  // browser collapses identical class adds into a no-op otherwise.
  if (navLogo) {
    navLogo.addEventListener("click", () => {
      cloudSvg.classList.remove(CLICKED_CLASS);
      void cloudSvg.offsetWidth;
      cloudSvg.classList.add(CLICKED_CLASS);
    });
    cloudSvg.addEventListener("animationend", (e) => {
      if (e.animationName === "logoClickPulse") {
        cloudSvg.classList.remove(CLICKED_CLASS);
      }
    });
  }

  idleTimer = setTimeout(startBreathing, BREATH.IDLE_MS);
}
