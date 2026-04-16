// ── Nav Link Hover Sparkle ──
// Tiny particles drift upward from nav links while the cursor
// moves over them, adding a subtle trail of sparkle.
// Uses Web Animations API and self-removes.

import { defineConstants } from "../dev/registry.js";

const SPARK = defineConstants("effects.navSparkle", {
  THROTTLE_MS: {
    value: 60,
    min: 20,
    max: 200,
    step: 10,
    description: "Minimum ms between particle spawns",
  },
  SIZE_MIN: {
    value: 2,
    min: 1,
    max: 6,
    step: 0.5,
    description: "Minimum particle diameter in px",
  },
  SIZE_RANGE: {
    value: 2,
    min: 0,
    max: 6,
    step: 0.5,
    description: "Particle size variation",
  },
  DRIFT_Y: {
    value: -20,
    min: -50,
    max: 0,
    step: 5,
    description: "Vertical drift distance (negative = upward)",
  },
  DRIFT_X: {
    value: 10,
    min: 0,
    max: 30,
    step: 2,
    description: "Maximum horizontal scatter",
  },
  DURATION_MS: {
    value: 600,
    min: 200,
    max: 1200,
    step: 50,
    description: "Particle lifetime in ms",
  },
  START_OPACITY: {
    value: 0.7,
    min: 0.2,
    max: 1,
    step: 0.1,
    description: "Initial particle opacity",
  },
});

const SELECTOR = ".nav-links a:not(.nav-cta)";

export function initNavSparkle() {
  if (matchMedia("(hover: none)").matches) return;

  let lastSpawn = 0;

  document.addEventListener(
    "mousemove",
    (e) => {
      const link = e.target.closest(SELECTOR);
      if (!link) return;

      const now = performance.now();
      if (now - lastSpawn < SPARK.THROTTLE_MS) return;
      lastSpawn = now;

      const rect = link.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const size = SPARK.SIZE_MIN + Math.random() * SPARK.SIZE_RANGE;
      const driftX = (Math.random() - 0.5) * SPARK.DRIFT_X;

      const dot = document.createElement("span");
      dot.className = "nav-sparkle";
      dot.style.width = size + "px";
      dot.style.height = size + "px";
      dot.style.left = x + "px";
      dot.style.top = y + "px";
      link.appendChild(dot);

      dot.animate(
        [
          { transform: "translate(-50%, -50%)", opacity: SPARK.START_OPACITY },
          {
            transform: `translate(calc(-50% + ${driftX}px), calc(-50% + ${SPARK.DRIFT_Y}px))`,
            opacity: 0,
          },
        ],
        {
          duration: SPARK.DURATION_MS,
          easing: "ease-out",
          fill: "forwards",
        },
      ).onfinish = () => dot.remove();
    },
    { passive: true },
  );
}
