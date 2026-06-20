// ── Streak ──
// Bright tapered streaks that shoot across the viewport along an angle — a lone
// comet, a radial warp from centre, a gust of scattered streaks. Each is a DOM
// element animated via the Web Animations API and removed on finish; capped and
// skipped under reduced motion.

import { prefersReducedMotion } from "../motion.js";
import { playSfx } from "../audio/sfx.js";

const DEFAULT_COUNT = 1;
// Hard cap so a charge-scaled caller can't flood the DOM.
const MAX_STREAKS = 80;
const DEFAULT_LENGTH_PX = 160;
const DEFAULT_THICKNESS_PX = 3;
const DEFAULT_TRAVEL_PX = 420;
const DEFAULT_DURATION_MS = 700;
const DEFAULT_COLOR = "#dce8ff";
const ANGLE_JITTER_RAD = 0.2; // spread around the base angle
const TRAVEL_JITTER = 0.4; // per-streak travel as a fraction of base
const DEG_PER_RAD = 180 / Math.PI;

// origin given → all streaks fire from it (comet); null + radial → fan out from
// the viewport centre (warp); null otherwise → scattered start points (gust).
function startPoint(origin, radial) {
  if (origin) return [origin.x, origin.y];
  if (radial) return [window.innerWidth / 2, window.innerHeight / 2];
  return [
    Math.random() * window.innerWidth,
    Math.random() * window.innerHeight,
  ];
}

export function streak({
  origin = null,
  angle = 0, // radians; 0 points right (+x), positive sweeps downward
  count = DEFAULT_COUNT,
  length = DEFAULT_LENGTH_PX,
  thickness = DEFAULT_THICKNESS_PX,
  travel = DEFAULT_TRAVEL_PX,
  durationMs = DEFAULT_DURATION_MS,
  color = DEFAULT_COLOR,
  radial = false, // spread evenly around a full circle from a single centre
} = {}) {
  if (prefersReducedMotion()) return;
  playSfx("streak");
  const n = Math.min(count, MAX_STREAKS);
  for (let i = 0; i < n; i++) {
    const a = radial
      ? (i / n) * Math.PI * 2
      : angle + (Math.random() - 0.5) * 2 * ANGLE_JITTER_RAD;
    const [ox, oy] = startPoint(origin, radial);

    const el = document.createElement("div");
    el.className = "streak";
    el.setAttribute("aria-hidden", "true");
    el.style.width = `${length}px`;
    el.style.height = `${thickness}px`;
    // Anchor the head (right end) at the start point; the tail trails behind.
    el.style.left = `${ox - length}px`;
    el.style.top = `${oy - thickness / 2}px`;
    el.style.background = `linear-gradient(to right, transparent, ${color})`;
    el.style.transformOrigin = "100% 50%";
    document.body.appendChild(el);

    const dist = travel * (1 + (Math.random() - 0.5) * 2 * TRAVEL_JITTER);
    const deg = a * DEG_PER_RAD;
    el.animate(
      [
        { transform: `rotate(${deg}deg) translateX(0)`, opacity: 1 },
        { transform: `rotate(${deg}deg) translateX(${dist}px)`, opacity: 0 },
      ],
      {
        duration: durationMs,
        easing: "cubic-bezier(0.2, 0.7, 0.4, 1)",
        fill: "forwards",
      },
    ).onfinish = () => el.remove();
  }
}
