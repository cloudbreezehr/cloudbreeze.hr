// ── Confetti ──
// A self-cleaning burst of small drifting pieces (confetti, snow). Each piece
// is a DOM element animated via the Web Animations API and removed on finish;
// skipped entirely under reduced motion. Rain across the top of the viewport
// (origin null) or burst from a point.

import { prefersReducedMotion } from "../motion.js";
import { playSfx } from "../audio/sfx.js";

const DEFAULT_COUNT = 36;
// Hard cap so a charge-scaled caller can't flood the DOM.
const MAX_PIECES = 220;
const DEFAULT_DURATION_MS = 2200;
const PIECE_MIN_PX = 6;
const PIECE_MAX_PX = 12;
const PIECE_ASPECT = 0.6; // rect height as a fraction of its width
const DRIFT_PX = 120; // horizontal sway each piece can wander
const SPIN_DEG = 540; // max rotation across the fall
const DURATION_JITTER_MIN = 0.7; // per-piece duration, as a fraction of base
const DURATION_JITTER_RANGE = 0.6;
const DEFAULT_COLORS = ["#5b9bf0", "#8fd3ff", "#ffd36a", "#ff7ea8", "#9affc4"];

function rand(range) {
  return (Math.random() - 0.5) * 2 * range; // centred in [-range, range]
}

export function confettiBurst({
  count = DEFAULT_COUNT,
  origin = null,
  colors = DEFAULT_COLORS,
  durationMs = DEFAULT_DURATION_MS,
  round = false, // circles (snow) instead of rects (confetti)
  sway = DRIFT_PX,
  spin = SPIN_DEG,
} = {}) {
  if (prefersReducedMotion()) return;
  playSfx("confetti");
  const w = window.innerWidth;
  const h = window.innerHeight;
  const n = Math.min(count, MAX_PIECES);
  for (let i = 0; i < n; i++) {
    const el = document.createElement("span");
    el.className = "confetti-piece";
    el.setAttribute("aria-hidden", "true");
    const size = PIECE_MIN_PX + Math.random() * (PIECE_MAX_PX - PIECE_MIN_PX);
    el.style.width = `${size}px`;
    el.style.height = `${round ? size : size * PIECE_ASPECT}px`;
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    if (round) el.style.borderRadius = "50%";
    const startX = origin ? origin.x : Math.random() * w;
    const startY = origin ? origin.y : -PIECE_MAX_PX;
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    document.body.appendChild(el);

    const dx = rand(sway);
    const dy = (origin ? h - origin.y : h) + PIECE_MAX_PX * 2;
    const rot = rand(spin);
    const dur =
      durationMs *
      (DURATION_JITTER_MIN + Math.random() * DURATION_JITTER_RANGE);
    el.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: dur,
        easing: "cubic-bezier(0.3, 0.6, 0.6, 1)",
        fill: "forwards",
      },
    ).onfinish = () => el.remove();
  }
}
