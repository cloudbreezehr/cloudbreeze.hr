// ── Ripple Ring Effect ──
// Expanding concentric rings that emanate from a point and fade out.
// Used by mode triggers (deep-sea hold, frozen/rainy card clicks).
// CSS classes control the visual appearance (size, color, border).

/**
 * Spawn one or more expanding ripple rings at (x, y).
 * Each ring is a DOM element animated via Web Animations API and
 * self-removes on completion.
 *
 * @param {number} x - X coordinate relative to parent
 * @param {number} y - Y coordinate relative to parent
 * @param {object} opts
 * @param {string}      opts.className     - CSS class for the ring element
 * @param {HTMLElement} [opts.parent]      - Where to append (default: document.body)
 * @param {number}      [opts.count]       - Number of concentric rings (default: 1)
 * @param {number}      [opts.staggerMs]   - Delay between rings in ms (default: 150)
 * @param {number}      [opts.duration]    - Animation duration in ms (default: 600)
 * @param {number}      [opts.maxScale]    - Final scale multiplier (default: 4)
 * @param {number}      [opts.startOpacity] - Starting opacity (default: 0.6)
 */
export function spawnRipple(x, y, opts) {
  const parent = opts.parent || document.body;
  const count = opts.count || 1;
  const staggerMs = opts.staggerMs || 150;
  const duration = opts.duration || 600;
  const maxScale = opts.maxScale || 4;
  const startOpacity = opts.startOpacity != null ? opts.startOpacity : 0.6;

  for (let i = 0; i < count; i++) {
    const ring = document.createElement("div");
    ring.className = opts.className;
    ring.style.left = x + "px";
    ring.style.top = y + "px";
    parent.appendChild(ring);

    ring.animate(
      [
        { transform: "translate(-50%,-50%) scale(0)", opacity: startOpacity },
        {
          transform: `translate(-50%,-50%) scale(${maxScale})`,
          opacity: 0,
        },
      ],
      {
        duration,
        delay: i * staggerMs,
        easing: "ease-out",
        fill: "forwards",
      },
    ).onfinish = () => ring.remove();
  }
}
