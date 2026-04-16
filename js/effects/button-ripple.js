// ── Button Click Ripple ──
// Material-style expanding circle from the click point, clipped to the
// button shape. Uses Web Animations API and self-removes.

import { defineConstants } from "../dev/registry.js";

const RIPPLE = defineConstants("effects.buttonRipple", {
  DURATION_MS: {
    value: 500,
    min: 200,
    max: 1200,
    step: 50,
    description: "Ripple expand + fade duration",
  },
  START_OPACITY: {
    value: 0.25,
    min: 0.05,
    max: 0.6,
    step: 0.05,
    description: "Initial ripple opacity",
  },
  SCALE_PADDING: {
    value: 2.5,
    min: 1.5,
    max: 4,
    step: 0.1,
    description: "Scale multiplier to ensure ripple covers full button",
  },
});

const SELECTOR =
  ".btn-primary, .nav-cta, .contact-link, .theme-toggle, .achievement-btn";

/**
 * Initialize click ripple on interactive buttons.
 * Spawns a circular overlay at the click position that expands
 * to fill the button and fades out, then self-removes.
 */
export function initButtonRipple() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(SELECTOR);
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Radius must cover the farthest corner from the click point
    const maxDist = Math.max(
      Math.hypot(x, y),
      Math.hypot(rect.width - x, y),
      Math.hypot(x, rect.height - y),
      Math.hypot(rect.width - x, rect.height - y),
    );
    const diameter = maxDist * RIPPLE.SCALE_PADDING;

    // Clip container inherits the button's border-radius so the ripple
    // stays inside the visible bounds without requiring overflow:hidden
    // on the button itself (which would clip tooltips).
    const clip = document.createElement("span");
    clip.className = "btn-ripple-clip";
    btn.appendChild(clip);

    const circle = document.createElement("span");
    circle.className = "btn-ripple";
    circle.style.width = diameter + "px";
    circle.style.height = diameter + "px";
    circle.style.left = x - diameter / 2 + "px";
    circle.style.top = y - diameter / 2 + "px";
    clip.appendChild(circle);

    circle.animate(
      [
        { transform: "scale(0)", opacity: RIPPLE.START_OPACITY },
        { transform: "scale(1)", opacity: 0 },
      ],
      {
        duration: RIPPLE.DURATION_MS,
        easing: "ease-out",
        fill: "forwards",
      },
    ).onfinish = () => clip.remove();
  });
}
