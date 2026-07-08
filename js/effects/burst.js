// ── Radial DOM Burst ──
// A one-shot scatter of small DOM particles from a point: each flies out on a
// random angle, shrinks, and fades, self-removing when done. Themes supply the
// class and the count/size/distance/duration ranges; the motion shape (fly-out
// + scale-down + fade) is shared. Durations pass through reducedDuration, so
// under reduced motion the particles snap to their end state instantly.

import { reducedDuration } from "../motion.js";

/**
 * @param {object} opts
 * @param {number} opts.x, opts.y         origin (viewport px)
 * @param {string} opts.className         class for each particle element
 * @param {number} opts.countMin, opts.countRange  particle count = min + rand·range
 * @param {number} opts.sizeMin, opts.sizeRange     diameter (px)
 * @param {number} opts.distMin, opts.distRange     fly-out distance (px)
 * @param {number} opts.durMin, opts.durRange        lifetime (ms)
 * @param {number} [opts.startOpacity=1]  opacity at spawn
 */
export function spawnRadialBurst({
  x,
  y,
  className,
  countMin,
  countRange,
  sizeMin,
  sizeRange,
  distMin,
  distRange,
  durMin,
  durRange,
  startOpacity = 1,
}) {
  const count = countMin + Math.floor(Math.random() * countRange);
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = className;
    const size = sizeMin + Math.random() * sizeRange;
    el.style.width = size + "px";
    el.style.height = size + "px";
    el.style.left = x + "px";
    el.style.top = y + "px";
    document.body.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const dist = distMin + Math.random() * distRange;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const dur = durMin + Math.random() * durRange;

    el.animate(
      [
        { transform: "translate(-50%,-50%) scale(1)", opacity: startOpacity },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)`,
          opacity: 0,
        },
      ],
      { duration: reducedDuration(dur), easing: "ease-out", fill: "forwards" },
    ).onfinish = () => el.remove();
  }
}
